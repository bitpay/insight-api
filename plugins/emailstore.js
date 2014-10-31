/**
 * Email-credentials-storage service
 *
 * Allows users to store encrypted data on the server, useful to store the user's credentials.
 *
 * Triggers an email to the user's provided email account. Note that the service may decide to
 * remove information associated with unconfirmed email addresses!
 *
 * Steps for the user would be:
 *
 *   1. Select an email to use
 *   2. Choose a password
 *   3. Create a strong key for encryption using PBKDF2 or scrypt with the email and password
 *   4. Use that key to AES-CRT encrypt the private key
 *   5. Take the double SHA256 hash of "salt"+"email"+"password" and use that as a secret
 *   6. Send a POST request to resource /email/register with the params:
 *          email=johndoe@email.com
 *          secret=2413fb3709b05939f04cf2e92f7d0897fc2596f9ad0b8a9ea855c7bfebaae892
 *          record=YjU1MTI2YTM5ZjliMTE3MGEzMmU2ZjYxZTRhNjk0YzQ1MjM1ZTVhYzExYzA1ZWNkNmZm
 *          NjM5NWRlNmExMTE4NzIzYzYyYWMwODU1MTdkNWMyNjRiZTVmNmJjYTMxMGQyYmFiNjc4YzdiODV
 *          lZjg5YWIxYzQ4YjJmY2VkYWJjMDQ2NDYzODhkODFiYTU1NjZmMzgwYzhiODdiMzlmYjQ5ZTc1Nz
 *          FjYzQzYjk1YTEyYWU1OGMxYmQ3OGFhOTZmNGMz
 *
 * To verify an email:
 *
 *   1. Check the email sent by the insight server
 *   2. Click on the link provided, or take the verification secret to make a request
 *   3. The request done can be a POST or GET request to /email/validate with the params:
 *          email=johndoe@email.com
 *          verification_code=M5NWRlNmExMTE4NzIzYzYyYWMwODU1MT
 *
 * To retrieve data:
 *
 *   1. Recover the secret from the double sha256 of the salt, email, and password
 *   2. Send a GET request to resource /email/retrieve?secret=......
 *   3. Decrypt the data received
 */
(function () {

'use strict';

var logger = require('../lib/logger').logger;
var levelup = require('levelup');
var async = require('async');
var crypto = require('crypto');
var querystring = require('querystring');
var nodemailer = require('nodemailer');
var globalConfig = require('../config/config');
var _ = require('lodash');
var fs = require('fs');

var emailPlugin = {};

/**
 * Constant enum with the errors that the application may return
 */
emailPlugin.errors = {
  MISSING_PARAMETER: {
    code: 400,
    message: 'Missing required parameter'
  },
  INVALID_REQUEST: {
    code: 400,
    message: 'Invalid request parameter'
  },
  NOT_FOUND: {
    code: 404,
    message: 'Credentials were not found'
  },
  INTERNAL_ERROR: {
    code: 500,
    message: 'Unable to save to database'
  },
  EMAIL_TAKEN: {
    code: 409,
    message: 'That email is already registered'
  },
  INVALID_CODE: {
    code: 403,
    message: 'The provided code is invalid'
  }
};

var NAMESPACE = 'credentials-store-';
var SEPARATOR = '#';
var VALIDATION_NAMESPACE = 'validation-code-';
var MAP_EMAIL_TO_SECRET = 'map-email-';
var EMAIL_NAMESPACE = 'validated-email-';
var MAX_ALLOWED_STORAGE = 1024 * 100 /* no more than 100 kb */;

var makeKey = function(email, key) {
  return NAMESPACE + email + SEPARATOR + key;
}

/**
 * Initializes the plugin
 *
 * @param {Object} config
 */
emailPlugin.init = function (config) {
  logger.info('Using emailstore plugin');

  var path = globalConfig.leveldb + '/emailstore' + (globalConfig.name ? ('-' + globalConfig.name) : '');
  emailPlugin.db = config.db || globalConfig.db || levelup(path);

  emailPlugin.email = config.emailTransport || nodemailer.createTransport(config.email);

  emailPlugin.textTemplate = config.textTemplate || 'copay.plain';
  emailPlugin.htmlTemplate = config.htmlTemplate || 'copay.html';

  emailPlugin.confirmUrl = (
    process.env.INSIGHT_EMAIL_CONFIRM_HOST
    || config.confirmUrl
    || 'https://insight.bitpay.com'
  ) + globalConfig.apiPrefix + '/email/validate';

  emailPlugin.redirectUrl = (
    config.redirectUrl
    || 'https://copay.io/in/app?confirmed=true'
  );
};

/**
 * Helper function that ends a requests showing the user an error. The response body will be a JSON
 * encoded object with only one property with key "error" and value <tt>error.message</tt>, one of
 * the parameters of the function
 *
 * @param {Object} error - The error that caused the request to be terminated
 * @param {number} error.code - the HTTP code to return
 * @param {string} error.message - the message to send in the body
 * @param {Express.Response} response - the express.js response. the methods status, json, and end
 *                                      will be called, terminating the request.
 */
emailPlugin.returnError = function (error, response) {
  response.status(error.code).json({error: error.message}).end();
};

/**
 * Helper that sends a verification email.
 *
 * @param {string} email - the user's email
 * @param {string} secret - the verification secret
 */
emailPlugin.sendVerificationEmail = function (email, secret) {
  var confirmUrl = emailPlugin.makeConfirmUrl(email, secret);
  async.series([
    function(callback) {
      emailPlugin.makeEmailBody({
        email: email,
        confirm_url: confirmUrl
      }, callback);
    },
    function(callback) {
      emailPlugin.makeEmailHTMLBody({
        email: email,
        confirm_url: confirmUrl,
        title: 'Your wallet backup needs confirmation'
      }, callback);
    }
  ], function(err, results) {
    var emailBody = results[0];
    var emailBodyHTML = results[1];
    var mailOptions = {
        from: 'copay@copay.io',
        to: email,
        subject: '[Copay] Your wallet backup needs confirmation',
        text: emailBody,
        html: emailBodyHTML
    };

    // send mail with defined transport object
    emailPlugin.email.sendMail(mailOptions, function (err, info) {
      if (err) {
        logger.error('An error occurred when trying to send email to ' + email, err);
      } else {
        logger.info('Message sent: ', info ? info : '');
      }
    });
  });
};

emailPlugin.makeConfirmUrl = function(email, secret) {
  return emailPlugin.confirmUrl + (
    '?email=' + encodeURIComponent(email) + '&verification_code='+secret
  );
};

/**
 * Returns a function that reads an underscore template and uses the `opts` param
 * to build an email body
 */
var applyTemplate = function(templateFilename) {
  return function(opts, callback) {
    fs.readFile(__dirname + '/emailTemplates/' + emailPlugin[templateFilename],
      function(err, template) {
        return callback(err, _.template(template, opts));
      }
    );
  };
};

emailPlugin.makeEmailBody = applyTemplate('textTemplate');
emailPlugin.makeEmailHTMLBody = applyTemplate('htmlTemplate');

/**
 * @param {string} email
 * @param {Function(err, boolean)} callback
 */
emailPlugin.exists = function(email, callback) {
  emailPlugin.db.get(MAP_EMAIL_TO_SECRET + email, function(err, value) {
    if (err && err.notFound) {
      return callback(null, false);
    } else if (err) {
      return callback(err);
    }
    return callback(null, true);
  });
};

/**
 * @param {string} email
 * @param {string} passphrase
 * @param {Function(err, boolean)} callback
 */
emailPlugin.checkPassphrase = function(email, passphrase, callback) {
  emailPlugin.db.get(MAP_EMAIL_TO_SECRET + email, function(err, retrievedPassphrase) {
    if (err) {
      if (err.notFound) {
        return callback(emailPlugin.errors.INVALID_CODE);
      }
      return callback(emailPlugin.errors.INTERNAL_ERROR);
    }
    return callback(err, passphrase === retrievedPassphrase);
  });
};

/**
 * @param {string} email
 * @param {string} passphrase
 * @param {Function(err)} callback
 */
emailPlugin.savePassphrase = function(email, passphrase, callback) {
  emailPlugin.db.put(MAP_EMAIL_TO_SECRET + email, passphrase, callback);
};

/**
 * @param {string} email
 * @param {string} key
 * @param {string} record
 * @param {Function(err)} callback
 */
emailPlugin.saveEncryptedData = function(email, key, record, callback) {
  emailPlugin.db.put(makeKey(email, key), record, callback);
};

emailPlugin.createVerificationSecretAndSendEmail = function (email, callback) {
  emailPlugin.createVerificationSecret(email, function(err, secret) {
    if (err) {
      return callback(err);
    }
    if (secret) {
      emailPlugin.sendVerificationEmail(email, secret);
    }
    callback();
  });
};

/**
 * Store a record in the database. The underlying database is merely a levelup instance (a key
 * value store) that uses the email concatenated with the secret as a key to store the record.
 * The request is expected to contain the parameters:
 * * email
 * * secret
 * * record
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 */
emailPlugin.post = function (request, response) {

  var queryData = '';

  request.on('data', function (data) {
    queryData += data;
    if (queryData.length > MAX_ALLOWED_STORAGE) {
      queryData = '';
      response.writeHead(413, {'Content-Type': 'text/plain'}).end();
      request.connection.destroy();
    }
  }).on('end', function () {
    var params = querystring.parse(queryData);
    var email = params.email;
    var key = params.key;
    var secret = params.secret;
    var record = params.record;
    if (!email || !secret || !record || !key) {
      return emailPlugin.returnError(emailPlugin.errors.MISSING_PARAMETER, response);
    }

    emailPlugin.processPost(request, response, email, key, secret, record);
  });
};

emailPlugin.processPost = function(request, response, email, key, secret, record) {
  async.series([
    /**
     * Try to fetch this user's email. If it exists, check the secret is the same.
     */
    function (callback) {
      emailPlugin.exists(email, function(err, exists) {
        if (err) {
          return callback(err);
        } else if (exists) {
          emailPlugin.checkPassphrase(email, secret, function(err, match) {
            if (err) {
              return callback(err);
            }
            if (match) {
              return callback();
            } else {
              return callback(emailPlugin.errors.EMAIL_TAKEN);
            }
          });
        } else {
          emailPlugin.savePassphrase(email, secret, function(err) {
            if (err) {
              return callback({code: 500, message: err});
            }
            return callback();
          });
        }
      });
    },
    /**
     * Save the encrypted private key in the storage.
     */
    function (callback) {
      emailPlugin.saveEncryptedData(email, key, record, function(err) {
        if (err) {
          return callback(err);
        }
        return callback();
      });
    },
    /**
     * Create and store the verification secret. If successful, send a verification email.
     */
    function (callback) {
      emailPlugin.createVerificationSecretAndSendEmail(email, function (err) {
        if (err) {
          callback({code: 500, message: err});
        } else {
          callback();
        }
      });
    }
  ], function (err) {
      if (err) {
        emailPlugin.returnError(err, response);
      } else {
        response.json({success: true}).end();
      }
    }
  );
};

/**
 * Creates and stores a verification secret in the database.
 *
 * @param {string} email - the user's email
 * @param {Function} callback - will be called with params (err, secret)
 */
emailPlugin.createVerificationSecret = function (email, callback) {
  emailPlugin.db.get(VALIDATION_NAMESPACE + email, function(err, value) {
    if (err && err.notFound) {
      var secret = crypto.randomBytes(16).toString('hex');
      emailPlugin.db.put(VALIDATION_NAMESPACE + email, secret, function (err, value) {
        if (err) {
          return callback(err);
        }
        callback(err, secret);
      });
    } else {
      callback(err, null);
    }
  });
};

/**
 * @param {string} email
 * @param {Function(err)} callback
 */
emailPlugin.retrieveByEmailAndKey = function(email, key, callback) {
  emailPlugin.db.get(makeKey(email, key), function(error, value) {
    if (error) {
      if (error.notFound) {
        return callback(emailPlugin.errors.NOT_FOUND);
      }
      return callback(emailPlugin.errors.INTERNAL_ERROR);
    }
    return callback(null, value);
  });
};

emailPlugin.retrieveDataByEmailAndPassphrase = function(email, key, passphrase, callback) {
  emailPlugin.checkPassphrase(email, passphrase, function(err, matches) {
    if (err) {
      return callback(err);
    }
    if (matches) {
      return emailPlugin.retrieveByEmailAndKey(email, key, callback);
    } else {
      return callback(emailPlugin.errors.INVALID_CODE);
    }
  });
};

/**
 * Retrieve a record from the database.
 *
 * The request is expected to contain the parameters:
 * * secret
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 */
emailPlugin.get = function (request, response) {
  var email = request.param('email');
  var key = request.param('key');
  var secret = request.param('secret');
  if (!secret) {
    return emailPlugin.returnError(emailPlugin.errors.MISSING_PARAMETER, response);
  }

  emailPlugin.retrieveDataByEmailAndPassphrase(email, key, secret, function (err, value) {
    if (err) {
      return emailPlugin.returnError(err, response);
    }
    response.send(value).end();
  });
};

/**
 * Marks an email as validated
 *
 * The two expected params are:
 * * email
 * * verification_code
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 */
emailPlugin.validate = function (request, response) {
  var email = request.param('email');
  var secret = request.param('verification_code');
  if (!email || !secret) {
    return emailPlugin.returnError(emailPlugin.errors.MISSING_PARAMETER, response);
  }

  emailPlugin.db.get(VALIDATION_NAMESPACE + email, function (err, value) {
    if (err) {
      if (err.notFound) {
        return emailPlugin.returnError(emailPlugin.errors.NOT_FOUND, response);
      }
      return emailPlugin.returnError({code: 500, message: err}, response);
    } else if (value !== secret) {
      return emailPlugin.returnError(emailPlugin.errors.INVALID_CODE, response);
    } else {
      emailPlugin.db.put(EMAIL_NAMESPACE + email, true, function (err, value) {
        if (err) {
          return emailPlugin.returnError({code: 500, message: err}, response);
        } else {
          response.redirect(emailPlugin.redirectUrl);
        }
      });
    }
  });
};

module.exports = emailPlugin;

})();
