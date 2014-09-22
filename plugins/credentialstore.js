/**
 * Credentials storage service
 *
 * Allows users to store encrypted data on the server, useful to store the user's credentials.
 *
 * Steps for the user would be:
 *
 *   1. Choose an username
 *   2. Choose a password
 *   3. Create a strong key for encryption using PBKDF2 or scrypt with the username and password
 *   4. Use that key to AES-CRT encrypt the private key
 *   5. Take the double SHA256 hash of "salt"+"username"+"password" and use that as a secret
 *   6. Send a POST request to resource /credentials with the params:
 *          username=johndoe
 *          secret=2413fb3709b05939f04cf2e92f7d0897fc2596f9ad0b8a9ea855c7bfebaae892
 *          record=YjU1MTI2YTM5ZjliMTE3MGEzMmU2ZjYxZTRhNjk0YzQ1MjM1ZTVhYzExYzA1ZWNkNmZm
 *          NjM5NWRlNmExMTE4NzIzYzYyYWMwODU1MTdkNWMyNjRiZTVmNmJjYTMxMGQyYmFiNjc4YzdiODV
 *          lZjg5YWIxYzQ4YjJmY2VkYWJjMDQ2NDYzODhkODFiYTU1NjZmMzgwYzhiODdiMzlmYjQ5ZTc1Nz
 *          FjYzQzYjk1YTEyYWU1OGMxYmQ3OGFhOTZmNGMz
 *
 * To retrieve data:
 *
 *   1. Recover the secret from the double sha256 of the salt, username, and password
 *   2. Send a GET request to resource /credentials/username?secret=......
 *   3. Decrypt the data received
 */
(function() {

'use strict';

var    logger = require('../lib/logger').logger,
      levelup = require('levelup'),
  querystring = require('querystring');

var storePlugin = {};

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
  }
};

var NAMESPACE = 'credentials-store-';
var MAX_ALLOWED_STORAGE = 1024 /* no more than 1 kb */;

/**
 * Initializes the plugin
 *
 * @param {Express} expressApp
 * @param {Object} config
 */
storePlugin.init = function(expressApp, config) {
  var globalConfig = require('../config/config');
  logger.info('Using credentialstore plugin');

  var path = globalConfig.leveldb + '/credentialstore' + (globalConfig.name ? ('-' + globalConfig.name) : '');
  storePlugin.db = config.db || globalConfig.db || levelup(path);

  expressApp.post(globalConfig.apiPrefix + '/credentials', storePlugin.post);
  expressApp.get(globalConfig.apiPrefix + '/credentials/:username', storePlugin.get);
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
 * Store a record in the database. The underlying database is merely a levelup instance (a key
 * value store) that uses the username concatenated with the secret as a key to store the record.
 * The request is expected to contain the parameters:
 * * username
 * * secret
 * * record
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 */
storePlugin.post = function(request, response) {

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
    var username = params.username;
    var secret = params.secret;
    var record = params.record;
    if (!username || !secret || !record) {
      return returnError(errors.MISSING_PARAMETER, response);
    }

    storePlugin.db.put(NAMESPACE + username + secret, record, function (err) {
      if (err) {
        return returnError({code: 500, message: err}, response);
      }
      response.json({success: true}).end();
    });
  });
};

/**
 * Retrieve a record from the database.
 *
 * The request is expected to contain the parameters:
 * * username
 * * secret
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 */
storePlugin.get = function(request, response) {
  var username = request.param('username');
  var secret = request.param('secret');
  if (!username || !secret) {
    return returnError(errors.MISSING_PARAMETER, response);
  }

  storePlugin.db.get(NAMESPACE + username + secret, function (err, value) {
    if (err) {
      if (err.notFound) {
        return returnError(errors.NOT_FOUND, response);
      }
      return returnError({code: 500, message: err}, response);
    }
    response.send(value).end();
  });
};

module.exports = storePlugin;

})();
