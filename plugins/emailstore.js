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
    config = config || {};

    var path = globalConfig.leveldb + '/emailstore' + (globalConfig.name ? ('-' + globalConfig.name) : '');
    emailPlugin.db = config.db || globalConfig.db || levelup(path);
    emailPlugin.crypto = config.crypto || crypto;
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

        response.send(value).end();
      });
    });
  };

  module.exports = emailPlugin;

})();
