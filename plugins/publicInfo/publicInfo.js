/**
 * Module to allow Copay users to publish public information about themselves
 *
 * It uses BitAuth to verify the authenticity of the request.
 *
 */
(function() {

'use strict';

var     logger = require('../../lib/logger').logger,
       levelup = require('levelup'),
       bitauth = require('bitauth'),
  globalConfig = require('../../config/config'),
   querystring = require('querystring');

var publicInfo = {};

/**
 * Constant enum with the errors that the application may return
 */
var errors = {
  MISSING_PARAMETER: {
    code: 400,
    message: 'Missing required parameter'
  },
  UNAUTHENTICATED: {
    code: 401,
    message: 'SIN validation error'
  },
  NOT_FOUND: {
    code: 404,
    message: 'There\'s no record of public information for the public key requested'
  }
};

var NAMESPACE = 'public-info-';
var MAX_ALLOWED_STORAGE = 64 * 1024 /* no more than 64 kb of data is allowed to be stored */;

/**
 * Initializes the plugin
 *
 * @param {Express} expressApp
 * @param {Object} config
 */
publicInfo.init = function(expressApp, config) {
  logger.info('Using publicInfo plugin');

  var path = globalConfig.leveldb + '/publicinfo' + (globalConfig.name ? ('-' + globalConfig.name) : '');
  publicInfo.db = config.db || globalConfig.db || levelup(path);

  expressApp.post(globalConfig.apiPrefix + '/public', publicInfo.post);
  expressApp.get(globalConfig.apiPrefix + '/public/:sin', publicInfo.get);
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
 * value store) that uses the SIN to store the body of the message.
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 */
publicInfo.post = function(request, response) {

  var record = '';
  request.on('data', function(data) {
    record += data;
    if (record.length > MAX_ALLOWED_STORAGE) {
      record = '';
      response.writeHead(413, {'Content-Type': 'text/plain'}).end();
      request.connection.destroy();
    }
  }).on('end', function() {
    var fullUrl = request.protocol + '://' + request.get('host') + request.url;
    var data = fullUrl + record;

    bitauth.verifySignature(data, request.headers['x-identity'], request.headers['x-signature'],
      function(err, result) {
        if(err || !result) {
          return returnError(errors.UNAUTHENTICATED, response);
        }

        // Get the SIN from the public key
        var sin = bitauth.getSinFromPublicKey(request.headers['x-identity']);
        if (!sin) {
          return returnError(errors.UNAUTHENTICATED, response);
        }
        publicInfo.db.put(NAMESPACE + sin, record, function (err) {
          if (err) {
            return returnError({code: 500, message: err}, response);
          }
          response.json({success: true}).end();
          if (request.testCallback) {
            request.testCallback();
          }
        });
      }
    );
  });
};

/**
 * Retrieve a record from the database.
 *
 * The request is expected to contain the parameter "sin"
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 */
publicInfo.get = function(request, response) {
  var sin = request.param('sin');
  if (!sin) {
    return returnError(errors.MISSING_PARAMETER, response);
  }

  publicInfo.db.get(NAMESPACE + sin, function (err, value) {
    if (err) {
      if (err.notFound) {
        return returnError(errors.NOT_FOUND, response);
      }
      return returnError({code: 500, message: err}, response);
    }
    response.send(value).end();
  });
};

module.exports = publicInfo;

})();
