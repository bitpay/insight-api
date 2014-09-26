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
(function() {

'use strict';

var     logger = require('../lib/logger').logger,
       levelup = require('levelup'),
         async = require('async'),
        crypto = require('crypto'),
   querystring = require('querystring'),
    nodemailer = require('nodemailer'),
  globalConfig = require('../config/config');

var emailPlugin = {};

/**
 * Constant enum with the errors that the application may return
 */
var errors = {
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
  EMAIL_TAKEN: {
    code: 409,
    message: 'That email is already registered'
  },
  INVALID_CODE: {
    code: 400,
    message: 'The provided code is invalid'
  }
};

var NAMESPACE = 'credentials-store-';
var VALIDATION_NAMESPACE = 'validation-code-';
var EMAIL_NAMESPACE = 'validated-email-';
var MAX_ALLOWED_STORAGE = 1024 /* no more than 1 kb */;

/**
 * Initializes the plugin
 *
 * @param {Express} expressApp
 * @param {Object} config
 */
emailPlugin.init = function(expressApp, config) {
  logger.info('Using emailstore plugin');

  var path = globalConfig.leveldb + '/emailstore' + (globalConfig.name ? ('-' + globalConfig.name) : '');
  emailPlugin.db = config.db || globalConfig.db || levelup(path);

  emailPlugin.email = config.emailTransport || nodemailer.createTransport(config.email);

  expressApp.post(globalConfig.apiPrefix + '/email/register', emailPlugin.post);
  expressApp.get(globalConfig.apiPrefix + '/email/retrieve/:email', emailPlugin.get);
  expressApp.post(globalConfig.apiPrefix + '/email/validate', emailPlugin.validate);
  expressApp.get(globalConfig.apiPrefix + '/email/validate', emailPlugin.validate);
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
var returnError = function(error, response) {
  response.status(error.code).json({error: error.message}).end();
};

/**
 * Helper that sends a verification email.
 *
 * @param {string} email - the user's email
 * @param {string} secret - the verification secret
 */
var sendVerificationEmail = function(email, secret) {

  var emailBody = 'Activation code is ' + secret; // TODO: Use a template!
  var emailBodyHTML = '<h1>Activation code is ' + secret + '</h1>'; // TODO: Use a template!

  var mailOptions = {
      from: 'Insight Services <insight@bitpay.com>',
      to: email,
      subject: 'Your Insight account has been created',
      text: emailBody,
      html: emailBodyHTML
  };

  // send mail with defined transport object
  emailPlugin.email.sendMail(mailOptions, function (err, info) {
    if (err) {
      logger.error('An error occurred when trying to send email to ' + email, err);
    } else {
      logger.debug('Message sent: ' + info.response);
    }
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
emailPlugin.post = function(request, response) {

  var queryData = '';

  request.on('data', function(data) {
    queryData += data;
    if (queryData.length > MAX_ALLOWED_STORAGE) {
      queryData = '';
      response.writeHead(413, {'Content-Type': 'text/plain'}).end();
      request.connection.destroy();
    }
  }).on('end', function() {
    var params = querystring.parse(queryData);
    var email = params.email;
    var secret = params.secret;
    var record = params.record;
    if (!email || !secret || !record) {
      return returnError(errors.MISSING_PARAMETER, response);
    }

    async.series([
      /**
       * Try to fetch this user's email. If it exists, fail.
       */
      function (callback) {
        emailPlugin.db.get(VALIDATION_NAMESPACE + email, function(err, dbValue) {
          if (!dbValue) {
            emailPlugin.db.get(EMAIL_NAMESPACE + email, function(err, dbValue) {
              if (!dbValue) {
                callback();
              } else {
                callback(errors.EMAIL_TAKEN);
              }
            });
          } else {
            callback(errors.EMAIL_TAKEN);
          }
        });
      },
      /**
       * Save the encrypted private key in the storage.
       */
      function (callback) {
        emailPlugin.db.put(NAMESPACE + secret, record, function (err) {
          if (err) {
            callback({code: 500, message: err});
          } else {
            callback();
          }
        });
      },
      /**
       * Create and store the verification secret. If successful, send a verification email.
       */
      function(callback) {
        emailPlugin.createVerificationSecret(email, function(err, secret) {
          if (err) {
            callback({code: 500, message: err});
          } else {
            sendVerificationEmail(email, secret);
            callback();
          }
        });
      }
    ], function(err) {
        if (err) {
          returnError(err, response);
        } else {
          response.json({success: true}).end();
        }
      }
    );
  });
};

/**
 * Creates and stores a verification secret in the database.
 *
 * @param {string} email - the user's email
 * @param {Function} callback - will be called with params (err, secret)
 */
emailPlugin.createVerificationSecret = function(email, callback) {
  var secret = crypto.randomBytes(16).toString('hex');
  emailPlugin.db.put(VALIDATION_NAMESPACE + email, secret, function(err, value) {
    if (err) {
      return callback(err);
    }
    callback(err, secret);
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
emailPlugin.get = function(request, response) {
  var secret = request.param('secret');
  if (!secret) {
    return returnError(errors.MISSING_PARAMETER, response);
  }

  emailPlugin.db.get(NAMESPACE + secret, function (err, value) {
    if (err) {
      if (err.notFound) {
        return returnError(errors.NOT_FOUND, response);
      }
      return returnError({code: 500, message: err}, response);
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
emailPlugin.validate = function(request, response) {
  var email = request.param('email');
  var secret = request.param('verification_code');
  if (!email || !secret) {
    return returnError(errors.MISSING_PARAMETER, response);
  }

  emailPlugin.db.get(VALIDATION_NAMESPACE + email, function (err, value) {
    logger.info('Recibido: ' + value);
    if (err) {
      if (err.notFound) {
        return returnError(errors.NOT_FOUND, response);
      }
      return returnError({code: 500, message: err}, response);
    } else if (value !== secret) {
      return returnError(errors.INVALID_CODE, response);
    } else {
      emailPlugin.db.put(EMAIL_NAMESPACE + email, true, function(err, value) {
        if (err) {
          return returnError({code: 500, message: err}, response);
        } else {
          response.json({success: true}).end();
        }
      });
    }
  });
};

module.exports = emailPlugin;

})();
