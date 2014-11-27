(function() {
  'use strict';

  var _ = require('lodash');
  var async = require('async');
  var levelup = require('levelup');
  var request = require('request');
  var preconditions = require('preconditions').singleton();

  var logger = require('../lib/logger').logger;
  var globalConfig = require('../config/config');

  var currencyRatesPlugin = {};

  function getCurrentTs() {
    return Math.floor(new Date() / 1000);
  };

  function getKey(sourceId, code, ts) {
    var key = sourceId + '-' + code.toUpperCase();
    if (ts) {
      key += '-' + ts;
    }
    return key;
  };

  function returnError(error, res) {
    res.status(error.code).json({
      error: error.message,
    }).end();
  };

  currencyRatesPlugin.init = function(config) {
    logger.info('Using currencyrates plugin');
    
    config = config || {};

    var path = globalConfig.leveldb + '/currencyRates' + (globalConfig.name ? ('-' + globalConfig.name) : '');
    currencyRatesPlugin.db = config.db || globalConfig.db || levelup(path);
    
    if (_.isArray(config.sources)) {
      currencyRatesPlugin.sources = config.sources;
    } else {
      currencyRatesPlugin.sources = [
        require('./currencyRates/bitpay'),
        require('./currencyRates/bitstamp'),
      ];
    }
    currencyRatesPlugin.request = config.request || request;
    currencyRatesPlugin.defaultSource = config.defaultSource || globalConfig.defaultSource;

    currencyRatesPlugin.initialized = true;

    var interval = config.fetchIntervalInMinutes || globalConfig.fetchIntervalInMinutes;
    if (interval) {
      currencyRatesPlugin._fetch();
      setInterval(function() {
        currencyRatesPlugin._fetch();
      }, interval * 60 * 1000);
    }
  };

  currencyRatesPlugin._retrieve = function(source, cb) {
    logger.debug('Fetching data for ' + source.id);
    currencyRatesPlugin.request.get({
      url: source.url,
      json: true
    }, function(err, res, body) {
      if (err || !body) {
        logger.warn('Error fetching data for ' + source.id, err);
        return cb(err);
      }

      logger.debug('Data for ' + source.id + ' fetched successfully');

      if (!source.parseFn) {
        return cb('No parse function for source ' + source.id);
      }
      var rates = source.parseFn(body);

      return cb(null, rates);
    });
  };

  currencyRatesPlugin._store = function(source, rates, cb) {
    logger.debug('Storing data for ' + source.id);
    var ts = getCurrentTs();
    var ops = _.map(rates, function(r) {
      return {
        type: 'put',
        key: getKey(source.id, r.code, ts),
        value: r.rate,
      };
    });

    currencyRatesPlugin.db.batch(ops, function(err) {
      if (err) {
        logger.warn('Error storing data for ' + source.id, err);
        return cb(err);
      }
      logger.debug('Data for ' + source.id + ' stored successfully');
      return cb();
    });
  };

  currencyRatesPlugin._dump = function(opts) {
    var all = [];
    currencyRatesPlugin.db.readStream(opts)
      .on('data', console.log);
  };

  currencyRatesPlugin._fetch = function(cb) {
    cb = cb || function() {};

    preconditions.shouldNotBeFalsey(currencyRatesPlugin.initialized);

    async.each(currencyRatesPlugin.sources, function(source, cb) {
      currencyRatesPlugin._retrieve(source, function(err, res) {
        if (err) {
          logger.warn(err);
          return cb();
        }
        currencyRatesPlugin._store(source, res, function(err, res) {
          return cb();
        });
      });
    }, function(err) {
      return cb(err);
    });
  };

  currencyRatesPlugin._getOneRate = function(sourceId, code, ts, cb) {
    var result = null;

    currencyRatesPlugin.db.createValueStream({
      lte: getKey(sourceId, code, ts),
      gte: getKey(sourceId, code) + '!',
      reverse: true,
      limit: 1,
    })
      .on('data', function(data) {
        var num = parseFloat(data);
        result = _.isNumber(num) && !_.isNaN(num) ? num : null;
      })
      .on('error', function(err) {
        return cb(err);
      })
      .on('end', function() {
        return cb(null, result);
      });
  };

  currencyRatesPlugin._getRate = function(sourceId, code, ts, cb) {
    preconditions.shouldNotBeFalsey(currencyRatesPlugin.initialized);
    preconditions.shouldNotBeEmpty(code);
    preconditions.shouldBeFunction(cb);

    ts = ts || getCurrentTs();

    if (!_.isArray(ts)) {
      return currencyRatesPlugin._getOneRate(sourceId, code, ts, function(err, rate) {
        if (err) return cb(err);
        return cb(null, {
          rate: rate
        });
      });
    }

    async.map(ts, function(ts, cb) {
      currencyRatesPlugin._getOneRate(sourceId, code, ts, function(err, rate) {
        if (err) return cb(err);
        return cb(null, {
          ts: parseInt(ts),
          rate: rate
        });
      });
    }, function(err, res) {
      if (err) return cb(err);
      return cb(null, res);
    });
  };

  currencyRatesPlugin.getRate = function(req, res) {
    var source = req.param('source') || currencyRatesPlugin.defaultSource;
    var ts = req.param('ts');
    if (_.isString(ts) && ts.indexOf(',') !== -1) {
      ts = ts.split(',');
    }
    currencyRatesPlugin._getRate(source, req.param('code'), ts, function(err, result) {
      if (err) returnError({
        code: 500,
        message: err,
      });
      res.json(result);
    });
  };

  module.exports = currencyRatesPlugin;
})();
