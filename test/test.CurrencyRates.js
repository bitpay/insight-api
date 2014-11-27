'use strict';

var chai = require('chai');
var assert = require('assert');
var sinon = require('sinon');
var should = chai.should;
var expect = chai.expect;

var levelup = require('levelup');
var memdown = require('memdown');
var logger = require('../lib/logger').logger;
logger.transports.console.level = 'non';

var rates = require('../plugins/currencyrates');

var db;

describe('Rates service', function() {
  beforeEach(function() {
    db = levelup(memdown);
  });

  describe('#getRate', function() {
    beforeEach(function() {
      rates.init({
        db: db,
      });
    });
    it('should get rate with exact ts', function(done) {
      db.batch([{
        type: 'put',
        key: 'bitpay-USD-10',
        value: 123.45
      }, ]);
      rates._getRate('bitpay', 'USD', 10, function(err, res) {
        expect(err).to.not.exist;
        res.rate.should.equal(123.45);
        done();
      });
    });
    it('should get rate with approximate ts', function(done) {
      db.batch([{
        type: 'put',
        key: 'bitpay-USD-10',
        value: 123.45,
      }, {
        type: 'put',
        key: 'bitpay-USD-20',
        value: 200.00,
      }]);
      rates._getRate('bitpay', 'USD', 25, function(err, res) {
        res.rate.should.equal(200.00);
        done();
      });
    });
    it('should return null when no rate found', function(done) {
      db.batch([{
        type: 'put',
        key: 'bitpay-USD-20',
        value: 123.45,
      }, {
        type: 'put',
        key: 'bitpay-USD-30',
        value: 200.00,
      }]);
      rates._getRate('bitpay', 'USD', 10, function(err, res) {
        expect(res.rate).to.be.null;
        done();
      });
    });
    it('should get rate from specified source', function(done) {
      db.batch([{
        type: 'put',
        key: 'bitpay-USD-10',
        value: 123.45,
      }, {
        type: 'put',
        key: 'bitstamp-USD-10',
        value: 200.00,
      }]);
      rates._getRate('bitpay', 'USD', 12, function(err, res) {
        res.rate.should.equal(123.45);
        done();
      });
    });
    it('should get rate for specified currency', function(done) {
      db.batch([{
        type: 'put',
        key: 'bitpay-USD-10',
        value: 123.45,
      }, {
        type: 'put',
        key: 'bitpay-EUR-10',
        value: 200.00,
      }]);
      rates._getRate('bitpay', 'EUR', 12, function(err, res) {
        res.rate.should.equal(200.00);
        done();
      });
    });
    it('should get multiple rates', function(done) {
      db.batch([{
        type: 'put',
        key: 'bitpay-USD-10',
        value: 100.00,
      }, {
        type: 'put',
        key: 'bitpay-USD-20',
        value: 200.00,
      }, {
        type: 'put',
        key: 'bitstamp-USD-30',
        value: 300.00,
      }, {
        type: 'put',
        key: 'bitpay-USD-30',
        value: 400.00,
      }]);
      rates._getRate('bitpay', 'USD', [10, 20, 35], function(err, res) {
        expect(err).to.not.exist;
        res.length.should.equal(3);
        res[0].ts.should.equal(10);
        res[1].ts.should.equal(20);
        res[2].ts.should.equal(35);
        res[0].rate.should.equal(100.00);
        res[1].rate.should.equal(200.00);
        res[2].rate.should.equal(400.00);
        done();
      });
    });
  });

  describe('#fetch', function() {
    it('should fetch from all sources', function(done) {
      var sources = [];
      sources.push({
        id: 'id1',
        url: 'http://dummy1',
        parseFn: function(raw) {
          return raw;
        },
      });
      sources.push({
        id: 'id2',
        url: 'http://dummy2',
        parseFn: function(raw) {
          return raw;
        },
      });

      var ds1 = [{
        code: 'USD',
        rate: 123.45,
      }, {
        code: 'EUR',
        rate: 200.00,
      }];
      var ds2 = [{
        code: 'USD',
        rate: 126.39,
      }];

      var request = sinon.stub();
      request.get = sinon.stub();
      request.get.withArgs({
        url: 'http://dummy1',
        json: true
      }).yields(null, null, ds1);
      request.get.withArgs({
        url: 'http://dummy2',
        json: true
      }).yields(null, null, ds2);

      rates.init({
        db: db,
        sources: sources,
        request: request,
      });

      var clock = sinon.useFakeTimers(1400000000 * 1000);

      rates._fetch(function(err, res) {
        clock.restore();

        expect(err).to.not.exist;

        var result = [];
        db.readStream()
          .on('data', function(data) {
            result.push(data);
          })
          .on('close', function() {
            result.length.should.equal(3);
            result[0].key.should.equal('id1-EUR-1400000000');
            result[1].key.should.equal('id1-USD-1400000000');
            result[2].key.should.equal('id2-USD-1400000000');
            parseFloat(result[0].value).should.equal(200.00);
            parseFloat(result[1].value).should.equal(123.45);
            parseFloat(result[2].value).should.equal(126.39);
            done();
          });
      });
    });

    it('should not stop when failing to fetch source', function(done) {
      var sources = [];
      sources.push({
        id: 'id1',
        url: 'http://dummy1',
        parseFn: function(raw) {
          return raw;
        },
      });
      sources.push({
        id: 'id2',
        url: 'http://dummy2',
        parseFn: function(raw) {
          return raw;
        },
      });

      var ds2 = [{
        code: 'USD',
        rate: 126.39,
      }];

      var request = sinon.stub();
      request.get = sinon.stub();
      request.get.withArgs({
        url: 'http://dummy1',
        json: true
      }).yields('dummy error', null, null);
      request.get.withArgs({
        url: 'http://dummy2',
        json: true
      }).yields(null, null, ds2);

      rates.init({
        db: db,
        sources: sources,
        request: request,
      });

      var clock = sinon.useFakeTimers(1400000000 * 1000);

      rates._fetch(function(err, res) {
        clock.restore();

        expect(err).to.not.exist;

        var result = [];
        db.readStream()
          .on('data', function(data) {
            result.push(data);
          })
          .on('close', function() {
            result.length.should.equal(1);
            result[0].key.should.equal('id2-USD-1400000000');
            parseFloat(result[0].value).should.equal(126.39);
            done();
          });
      });
    });
  });
});
