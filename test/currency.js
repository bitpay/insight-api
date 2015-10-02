'use strict';

var should = require('should');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var CurrencyController = require('../lib/currency');

describe('Currency', function() {

  var bitstampData = {
    high: 239.44,
    last: 237.90,
    timestamp: 1443798711,
    bid: 237.61,
    vwap: 237.88,
    volume: 21463.27736401,
    low: 235.00,
    ask: 237.90
  };

  it.skip('will make live request to bitstamp', function(done) {
    var currency = new CurrencyController({});
    var req = {};
    var res = {
      jsonp: function(response) {
        response.status.should.equal(200);
        should.exist(response.data.bitstamp);
        (typeof response.data.bitstamp).should.equal('number');
        done();
      }
    };
    currency.index(req, res);
  });

  it('will retrieve a fresh value', function(done) {
    var TestCurrencyController = proxyquire('../lib/currency', {
      request: sinon.stub().callsArgWith(1, null, {statusCode: 200}, JSON.stringify(bitstampData))
    });
    var node = {
      log: {
        error: sinon.stub()
      }
    };
    var currency = new TestCurrencyController({node: node});
    currency.bitstampRate = 220.20;
    currency.timestamp = Date.now() - 61000 * CurrencyController.DEFAULT_CURRENCY_DELAY;
    var req = {};
    var res = {
      jsonp: function(response) {
        response.status.should.equal(200);
        should.exist(response.data.bitstamp);
        response.data.bitstamp.should.equal(237.90);
        done();
      }
    };
    currency.index(req, res);
  });

  it('will log an error from request', function(done) {
    var TestCurrencyController = proxyquire('../lib/currency', {
      request: sinon.stub().callsArgWith(1, new Error('test'))
    });
    var node = {
      log: {
        error: sinon.stub()
      }
    };
    var currency = new TestCurrencyController({node: node});
    currency.bitstampRate = 237.90;
    currency.timestamp = Date.now() - 65000 * CurrencyController.DEFAULT_CURRENCY_DELAY;
    var req = {};
    var res = {
      jsonp: function(response) {
        response.status.should.equal(200);
        should.exist(response.data.bitstamp);
        response.data.bitstamp.should.equal(237.90);
        node.log.error.callCount.should.equal(1);
        done();
      }
    };
    currency.index(req, res);
  });

  it('will retrieve a cached value', function(done) {
    var request = sinon.stub();
    var TestCurrencyController = proxyquire('../lib/currency', {
      request: request
    });
    var node = {
      log: {
        error: sinon.stub()
      }
    };
    var currency = new TestCurrencyController({node: node});
    currency.bitstampRate = 237.90;
    currency.timestamp = Date.now();
    var req = {};
    var res = {
      jsonp: function(response) {
        response.status.should.equal(200);
        should.exist(response.data.bitstamp);
        response.data.bitstamp.should.equal(237.90);
        request.callCount.should.equal(0);
        done();
      }
    };
    currency.index(req, res);
  });

});
