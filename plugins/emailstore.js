/**
 * GIST: https://gist.github.com/eordano/3e80ee3383554e94a08e
 */
(function() {

  'use strict';

  var _ = require('lodash');
  var async = require('async');
  var bitcore = require('bitcore');
  var crypto = require('crypto');
  var fs = require('fs');
  var levelup = require('levelup');
  var nodemailer = require('nodemailer');
  var querystring = require('querystring');
  var moment = require('moment');

  var logger = require('../lib/logger').logger;
  var globalConfig = require('../config/config');

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
      message: 'Email already confirmed or credentials not found'
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
    },
    OVER_QUOTA: {
      code: 406,
      message: 'User quota exceeded',
    },
    ERROR_SENDING_EMAIL: {
      code: 501,
      message: 'Could not send verification email',
    },
  };

  var EMAIL_TO_PASSPHRASE = 'email-to-passphrase-';
  var STORED_VALUE = 'emailstore-';
  var ITEMS_COUNT = 'itemscount-';
  var PENDING = 'pending-';
  var VALIDATED = 'validated-';

  var SEPARATOR = '#';

  var UNCONFIRMED_PER_ITEM_QUOTA = 1024 * 150; /*  150 kb */
  var CONFIRMED_PER_ITEM_QUOTA = 1024 * 300; /* 300 kb */

  var UNCONFIRMED_ITEMS_LIMIT = 6;
  var CONFIRMED_ITEMS_LIMIT = 11;

  var POST_LIMIT = 1024 * 300 /* Max POST 300 kb */ ;

  var valueKey = function(email, key) {
    return STORED_VALUE + bitcore.util.twoSha256(email + SEPARATOR + key).toString('hex');
  };


  var countKey = function(email) {
    return ITEMS_COUNT + bitcore.util.twoSha256(email).toString('hex');
  };

  var pendingKey = function(email) {
    return PENDING + email;
  };

  var validatedKey = function(email) {
    return VALIDATED + bitcore.util.twoSha256(email).toString('hex');
  };

  var emailToPassphrase = function(email) {
    return EMAIL_TO_PASSPHRASE + bitcore.util.twoSha256(email).toString('hex');
  };

  /**
   * Initializes the plugin
   *
   * @param {Object} config
   */
  emailPlugin.init = function(config) {
    logger.info('Using emailstore plugin');

    var path = globalConfig.leveldb + '/emailstore' + (globalConfig.name ? ('-' + globalConfig.name) : '');
    emailPlugin.db = config.db || globalConfig.db || levelup(path);

    emailPlugin.email = config.emailTransport || nodemailer.createTransport(config.email);

    emailPlugin.textTemplate = config.textTemplate || 'copay.plain';
    emailPlugin.htmlTemplate = config.htmlTemplate || 'copay.html';

    emailPlugin.crypto = config.crypto || crypto;

    emailPlugin.confirmUrl = (
      process.env.INSIGHT_EMAIL_CONFIRM_HOST || config.confirmUrl || 'https://insight.bitpay.com'
    ) + globalConfig.apiPrefix + '/email/validate';

    emailPlugin.redirectUrl = (
      config.redirectUrl || 'https://copay.io/in/app#!/confirmed'
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
  emailPlugin.returnError = function(error, response) {
    response.status(error.code).json({
      error: error.message
    }).end();
  };

  /**
   * Helper that sends a verification email.
   *
   * @param {string} email - the user's email
   * @param {string} secret - the verification secret
   */
  emailPlugin.sendVerificationEmail = function(email, secret, callback) {
    var confirmUrl = emailPlugin.makeConfirmUrl(email, secret);

    logger.debug('ConfirmUrl:',confirmUrl);

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
      emailPlugin.email.sendMail(mailOptions, function(err, info) {
        if (err) {
          logger.error('An error occurred when trying to send email to ' + email, err);
          return callback(err);
        }
        logger.info('Message sent: ', info ? info : '');
        return callback(err, info);
      });
    });
  };

  emailPlugin.makeConfirmUrl = function(email, secret) {
    return emailPlugin.confirmUrl + (
      '?email=' + encodeURIComponent(email) + '&verification_code=' + secret
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
    emailPlugin.db.get(emailToPassphrase(email), function(err, value) {
      if (err && err.notFound) {
        return callback(null, false);
      } else if (err) {
        return callback(emailPlugin.errors.INTERNAL_ERROR);
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
    emailPlugin.db.get(emailToPassphrase(email), function(err, retrievedPassphrase) {
      if (err) {
        if (err.notFound) {
          return callback(emailPlugin.errors.INVALID_CODE);
        }
        logger.error('error checking passphrase', email, err);
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
    emailPlugin.db.put(emailToPassphrase(email), passphrase, function(err) {
      if (err) {
        logger.error('error saving passphrase', err);
        return callback(emailPlugin.errors.INTERNAL_ERROR);
      }
      return callback(null);
    });
  };


  /**
   * checkSizeQuota
   *
   * @param email
   * @param size
   * @param isConfirmed
   * @param callback
   */
  emailPlugin.checkSizeQuota = function(email, size, isConfirmed, callback) {
    var err;

    if (size > (isConfirmed ? CONFIRMED_PER_ITEM_QUOTA : UNCONFIRMED_PER_ITEM_QUOTA))
      err = emailPlugin.errors.OVER_QUOTA;

    logger.info('Storage size:', size);
    return callback(err);
  };


  emailPlugin.checkAndUpdateItemCounter = function(email, isConfirmed, isAdd, callback) {
    // this is a new item... Check User's Items quota.
    emailPlugin.db.get(countKey(email), function(err, counter) {
      if (err && !err.notFound) {
        return callback(emailPlugin.errors.INTERNAL_ERROR);
      }
      counter = (parseInt(counter) || 0)

      if (isAdd) {
        counter++;
        logger.info('User counter quota:', counter);
        if (counter > (isConfirmed ? CONFIRMED_ITEMS_LIMIT : UNCONFIRMED_ITEMS_LIMIT)) {
          return callback(emailPlugin.errors.OVER_QUOTA);
        }
      } else {
        if (counter > 0) counter--;
      }


      emailPlugin.db.put(countKey(email), counter, function(err) {
        if (err) {
          logger.error('error saving counter');
          return callback(emailPlugin.errors.INTERNAL_ERROR);
        }
        return callback();
      });
    });
  };


  /**
   * @param {string} email
   * @param {string} key
   * @param {Function(err)} callback
   */
  emailPlugin.checkAndUpdateItemQuota = function(email, key, isConfirmed, callback) {

    emailPlugin.db.get(valueKey(email, key), function(err) {

      //existing item?
      if (!err)
        return callback();

      if (err.notFound) {
        //new item
        return emailPlugin.checkAndUpdateItemCounter(email, isConfirmed, 1, callback);
      } else {
        return callback(emailPlugin.errors.INTERNAL_ERROR);
      }
    });
  };


  /**
   * @param {string} email
   * @param {string} key
   * @param {string} record
   * @param {Function(err)} callback
   */
  emailPlugin.saveEncryptedData = function(email, key, record, callback) {
    emailPlugin.db.put(valueKey(email, key), record, function(err) {
      if (err) {
        logger.error('error saving encrypted data', email, key, record, err);
        return callback(emailPlugin.errors.INTERNAL_ERROR);
      }
      return callback();
    });
  };

  emailPlugin.createVerificationSecretAndSendEmail = function(email, callback) {
    emailPlugin.createVerificationSecret(email, function(err, secret) {
      if (err || !secret) {
        logger.error('error saving verification secret', email, secret, err);
        return callback(emailPlugin.errors.INTERNAL_ERROR);
      }
      emailPlugin.sendVerificationEmail(email, secret, function (err, res) {
        if (err) {
          logger.error('error sending verification email', email, secret, err);
          return callback(emailPlugin.errors.ERROR_SENDING_EMAIL);
        }
        return callback();
      });
    });
  };

  /**
   * Creates and stores a verification secret in the database.
   *
   * @param {string} email - the user's email
   * @param {Function} callback - will be called with params (err, secret)
   */
  emailPlugin.createVerificationSecret = function(email, callback) {
    emailPlugin.db.get(pendingKey(email), function(err, value) {
      if (err && err.notFound) {
        var secret = emailPlugin.crypto.randomBytes(16).toString('hex');
        var value = {
          secret: secret,
          created: moment().unix(),
        };
        emailPlugin.db.put(pendingKey(email), JSON.stringify(value), function(err) {
          if (err) {
            logger.error('error saving pending data:', email, value);
            return callback(emailPlugin.errors.INTERNAL_ERROR);
          }
          return callback(null, secret);
        });
      } else {
        return callback(err);
      }
    });
  };

  /**
   * @param {string} email
   * @param {Function(err)} callback
   */
  emailPlugin.retrieveByEmailAndKey = function(email, key, callback) {
    emailPlugin.db.get(valueKey(email, key), function(error, value) {
      if (error) {
        if (error.notFound) {
          return callback(emailPlugin.errors.NOT_FOUND);
        }
        return callback(emailPlugin.errors.INTERNAL_ERROR);
      }
      return callback(null, value);
    });
  };

  emailPlugin.deleteByEmailAndKey = function deleteByEmailAndKey(email, key, callback) {
    emailPlugin.db.del(valueKey(email, key), function(error) {
      if (error) {
        logger.error(error);
        if (error.notFound) {
          return callback(emailPlugin.errors.NOT_FOUND);
        }
        return callback(emailPlugin.errors.INTERNAL_ERROR);
      }
      return emailPlugin.checkAndUpdateItemCounter(email, null, null, callback);
    });
  };

  emailPlugin.deleteWholeProfile = function deleteWholeProfile(email, callback) {
    async.parallel([

      function(cb) {
        emailPlugin.db.del(emailToPassphrase(email), cb);
      },
      function(cb) {
        emailPlugin.db.del(pendingKey(email), cb);
      },
      function(cb) {
        emailPlugin.db.del(validatedKey(email), cb);
      }
    ], function(err) {
      if (err && !err.notFound) {
        logger.error(err);
        return callback(emailPlugin.errors.INTERNAL_ERROR);
      }
      return callback();
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
  emailPlugin.save = function(request, response) {

    var queryData = '';
    var credentials = emailPlugin.getCredentialsFromRequest(request);
    if (credentials.code) {
      return emailPlugin.returnError(credentials, response);
    }
    var email = credentials.email;
    var passphrase = credentials.passphrase;

    request.on('data', function(data) {
      queryData += data;
      if (queryData.length > POST_LIMIT) {
        queryData = '';
        response.writeHead(413, {
          'Content-Type': 'text/plain'
        });
        response.end();
        request.connection.destroy();
      }
    }).on('end', function() {
      var params = querystring.parse(queryData);
      var key = params.key;
      var record = params.record;
      if (!email || !passphrase || !record || !key) {
        return emailPlugin.returnError(emailPlugin.errors.MISSING_PARAMETER, response);
      }

      emailPlugin.processPost(request, response, email, key, passphrase, record);
    });
  };

  emailPlugin.processPost = function(request, response, email, key, passphrase, record) {
    var isNewProfile = false;
    var isConfirmed = true;
    var errorCreating = false;

    async.series([
        /**
         * Try to fetch this user's email. If it exists, check the secret is the same.
         */
        function(callback) {
          emailPlugin.exists(email, function(err, exists) {
            if (err) return callback(err);
            
            if (exists) {
              emailPlugin.checkPassphrase(email, passphrase, function(err, match) {
                if (err) return callback(err);
                if (!match) return callback(emailPlugin.errors.EMAIL_TAKEN);
                return callback();
              });
            } else {
              isNewProfile = true;
              emailPlugin.savePassphrase(email, passphrase, function(err) {
                return callback(err);
              });
            }
          });
        },
        function(callback) {
          emailPlugin.isConfirmed(email, function(err, inIsConfirmed) {
            if (err) return callback(err);
            isConfirmed = inIsConfirmed;
            return callback();
          });
        },
        function(callback) {
          emailPlugin.checkSizeQuota(email, record.length, isConfirmed, function(err) {
            return callback(err);
          });
        },
        function(callback) {
          emailPlugin.checkAndUpdateItemQuota(email, key, isConfirmed, function(err) {
            return callback(err);
          });
        },
        /**
         * Save the encrypted private key in the storage.
         */
        function(callback) {
          emailPlugin.saveEncryptedData(email, key, record, function(err) {
            return callback(err);
          });
        },
        /**
         * Create and store the verification secret. If successful, send a verification email.
         */
        function(callback) {
          if (!isNewProfile || isConfirmed) return callback();

          emailPlugin.createVerificationSecretAndSendEmail(email, function(err) {
            if (err) {
              errorCreating = true;
            }
            return callback(err);
          });
        },
      ],
      function(err) {
        if (err) {
          if (isNewProfile && !isConfirmed && errorCreating) {
            emailPlugin.deleteWholeProfile(email, function() {
              return emailPlugin.returnError(err, response);
            });
          }

          emailPlugin.returnError(err, response);
        } else {
          response.json({
            success: true
          }).end();
        }
      });
  };

  emailPlugin.getCredentialsFromRequest = function(request) {
    var auth = request.header('authorization');
    if (!auth) {
      return emailPlugin.errors.INVALID_REQUEST;
    }
    var authHeader = new Buffer(auth, 'base64').toString('utf8');
    var splitIndex = authHeader.indexOf(':');
    if (splitIndex === -1) {
      return emailPlugin.errors.INVALID_REQUEST;
    }
    var email = authHeader.substr(0, splitIndex);
    var passphrase = authHeader.substr(splitIndex + 1);

    return {
      email: email,
      passphrase: passphrase
    };
  };


  /**
   * @param {string} email
   * @param {Function(err, boolean)} callback
   */
  emailPlugin.isConfirmed = function(email, callback) {
    emailPlugin.db.get(validatedKey(email), function(err, isConfirmed) {
      if (err && err.notFound) {
        return callback(null, false);
      } else if (err) {
        return callback(emailPlugin.errors.INTERNAL_ERROR);
      }
      return callback(null, !!isConfirmed);
    });
  };


  /**
   * addValidationAndQuotaHeader
   *
   * @param response
   * @param email
   * @param {Function(err, boolean)} callback
   */
  emailPlugin.addValidationAndQuotaHeader = function(response, email, callback) {
    emailPlugin.isConfirmed(email, function(err, isConfirmed) {
      if (err) return callback(err);

      if (!isConfirmed) {
        response.set('X-Email-Needs-Validation', 'true');
      }

      response.set('X-Quota-Per-Item', isConfirmed ? CONFIRMED_PER_ITEM_QUOTA : UNCONFIRMED_PER_ITEM_QUOTA);
      response.set('X-Quota-Items-Limit', isConfirmed ? CONFIRMED_ITEMS_LIMIT : UNCONFIRMED_ITEMS_LIMIT);
      return callback();
    });
  };

  emailPlugin.authorizeRequest = function(request, withKey, callback) {
    var credentialsResult = emailPlugin.getCredentialsFromRequest(request);
    if (_.contains(emailPlugin.errors, credentialsResult)) {
      return callback(credentialsResult);
    }

    var email = credentialsResult.email;
    var passphrase = credentialsResult.passphrase;
    var key;
    if (withKey) {
      key = request.param('key');
    }

    if (!passphrase || !email || (withKey && !key)) {
      return callback(emailPlugin.errors.MISSING_PARAMETER);
    }

    emailPlugin.checkPassphrase(email, passphrase, function(err, matches) {
      if (err) {
        return callback(err);
      }

      if (!matches) {
        return callback(emailPlugin.errors.INVALID_CODE);
      }

      return callback(null, email, key);
    });
  };

  emailPlugin.authorizeRequestWithoutKey = function(request, callback) {
    emailPlugin.authorizeRequest(request, false, callback);
  };

  emailPlugin.authorizeRequestWithKey = function(request, callback) {
    emailPlugin.authorizeRequest(request, true, callback);
  };

  /**
   * Retrieve a record from the database
   */
  emailPlugin.retrieve = function(request, response) {
    emailPlugin.authorizeRequestWithKey(request, function(err, email, key) {
      if (err)
        return emailPlugin.returnError(err, response);

      emailPlugin.retrieveByEmailAndKey(email, key, function(err, value) {
        if (err)
          return emailPlugin.returnError(err, response);


        emailPlugin.addValidationAndQuotaHeader(response, email, function(err) {
          if (err)
            return emailPlugin.returnError(err, response);

          response.send(value).end();
        });
      });
    });
  };

  /**
   * Remove a record from the database
   */
  emailPlugin.erase = function(request, response) {
    emailPlugin.authorizeRequestWithKey(request, function(err, email, key) {
      if (err) {
        return emailPlugin.returnError(err, response);
      }
      emailPlugin.deleteByEmailAndKey(email, key, function(err, value) {
        if (err) {
          return emailPlugin.returnError(err, response);
        } else {
          return response.json({
            success: true
          }).end();
        };
      });
    });
  };

  /**
   * Remove a whole profile from the database
   *
   * @TODO: This looks very similar to the method above
   */
  emailPlugin.eraseProfile = function(request, response) {
    emailPlugin.authorizeRequestWithoutKey(request, function(err, email) {
      if (err) {
        return emailPlugin.returnError(err, response);
      }

      emailPlugin.deleteWholeProfile(email, function(err, value) {
        if (err) {
          return emailPlugin.returnError(err, response);
        } else {
          return response.json({
            success: true
          }).end();
        };
      });
    });
  };

  emailPlugin._parseSecret = function (value) {
    var obj = null;
    try {
      obj = JSON.parse(value);
    } catch (e) {}

    if (obj && _.isObject(obj)) {
      return obj.secret;
    }

    return value;
  };

  emailPlugin.resendEmail = function(request, response) {
    emailPlugin.authorizeRequestWithoutKey(request, function(err, email) {
      if (err) {
        return emailPlugin.returnError(err, response);
      }
      emailPlugin.db.get(pendingKey(email), function(err, value) {
        if (err) {
          logger.error('error retrieving secret for email', email, err);
          return emailPlugin.returnError(err, response);
        }

        var secret = emailPlugin._parseSecret(value);

        emailPlugin.sendVerificationEmail(email, secret, function (err) {
          if (err) {
            logger.error('error resending verification email', email, secret, err);
            return emailPlugin.returnError(emailPlugin.errors.ERROR_SENDING_EMAIL, response);
          }
          return response.json({
              success: true
            }).end();

        });
      });
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
      return emailPlugin.returnError(emailPlugin.errors.MISSING_PARAMETER, response);
    }

    emailPlugin.db.get(pendingKey(email), function(err, value) {
      if (err) {
        if (err.notFound) {
          return emailPlugin.returnError(emailPlugin.errors.NOT_FOUND, response);
        }
        return emailPlugin.returnError({
          code: 500,
          message: err
        }, response);
      }

      value = emailPlugin._parseSecret(value);

      if (value !== secret) {
        return emailPlugin.returnError(emailPlugin.errors.INVALID_CODE, response);
      }

      emailPlugin.db.put(validatedKey(email), true, function(err, value) {
        if (err) {
          return emailPlugin.returnError({
            code: 500,
            message: err
          }, response);
        } else {
          emailPlugin.db.del(pendingKey(email), function(err, value) {
            if (err) {
              return emailPlugin.returnError({
                code: 500,
                message: err
              }, response);
            } else {
              response.redirect(emailPlugin.redirectUrl);
            }
          });
        }
      });
    });
  };

  /**
   * Changes an user's passphrase
   *
   * @param {Express.Request} request
   * @param {Express.Response} response
   */
  emailPlugin.changePassphrase = function(request, response) {

    emailPlugin.authorizeRequestWithoutKey(request, function(err, email) {

      if (err) {
        return emailPlugin.returnError(err, response);
      }

      var queryData = '';
      request.on('data', function(data) {
        queryData += data;
        if (queryData.length > POST_LIMIT) {
          queryData = '';
          response.writeHead(413, {
            'Content-Type': 'text/plain'
          }).end();
          request.connection.destroy();
        }
      }).on('end', function() {
        var params = querystring.parse(queryData);
        var newPassphrase = params.newPassphrase;
        if (!newPassphrase) {
          return emailPlugin.returnError(emailPlugin.errors.INVALID_REQUEST, response);
        }
        emailPlugin.savePassphrase(email, newPassphrase, function(error) {
          if (error) {
            return emailPlugin.returnError(error, response);
          }
          return response.json({
            success: true
          }).end();
        });
      });
    });
  };


  //
  // Backwards compatibility
  //

  emailPlugin.oldRetrieveDataByEmailAndPassphrase = function(email, key, passphrase, callback) {
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


  emailPlugin.oldRetrieve = function(request, response) {
    var email = request.param('email');
    var key = request.param('key');
    var secret = request.param('secret');
    if (!secret) {
      return emailPlugin.returnError(emailPlugin.errors.MISSING_PARAMETER, response);
    }

    emailPlugin.oldRetrieveDataByEmailAndPassphrase(email, key, secret, function(err, value) {
      if (err) {
        return emailPlugin.returnError(err, response);
      }
      response.send(value).end();
    });
  };

  emailPlugin.oldSave = function(request, response) {
    var queryData = '';

    request.on('data', function(data) {
      queryData += data;
      if (queryData.length > UNCONFIRMED_PER_ITEM_QUOTA) {
        queryData = '';
        response.writeHead(413, {
          'Content-Type': 'text/plain'
        }).end();
        request.connection.destroy();
      }
    }).on('end', function() {
      var params = querystring.parse(queryData);
      var email = params.email;
      var passphrase = params.secret;
      var key = params.key;
      var record = params.record;
      if (!email || !passphrase || !record || !key) {
        return emailPlugin.returnError(emailPlugin.errors.MISSING_PARAMETER, response);
      }

      emailPlugin.processPost(request, response, email, key, passphrase, record);
    });
  };

  module.exports = emailPlugin;

})();
