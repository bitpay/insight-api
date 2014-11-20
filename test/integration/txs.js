#!/usr/bin/env node

'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var _ = require('lodash');
var async = require('async');
var assert = require('assert');
var fs = require('fs');
var Address = require('../../app/models/Address');
var addresses = require('../../app/controllers/addresses');
var TransactionDb = require('../../lib/TransactionDb').default();
var fixture = JSON.parse(fs.readFileSync('test/integration/txs.json'));
var should = require('chai');
var sinon = require('sinon');

var txDb;
describe('Transactions for multiple addresses', function() {
  this.timeout(5000);

  var req, res;
  before(function(c) {
    txDb = TransactionDb;

    var i = 0;
    _.each(_.flatten(_.pluck(fixture, 'addrs')), function(addr) {
      TransactionDb.deleteCacheForAddress(addr, function() {
        if (++i === fixture.length) return c();
      });
    });
  });

  beforeEach(function(c) {
    req = {};
    res = {};
    return c();
  });

  describe('Transactions from multiple addresses', function () {
    _.each(fixture, function (f) {
      it(f.test, function (done) {
        var checkResult = function(txs) {
          var paginated = !_.isUndefined(f.from) || !_.isUndefined(f.to);
          txs.should.exist;
          if (paginated) {
            txs.totalItems.should.equal(f.totalTransactions);
            txs.items.length.should.equal(f.returnedTransactions);
            if (f.transactions) {
              JSON.stringify(_.pluck(txs.items, 'txid')).should.equal(JSON.stringify(f.transactions));
            }
          } else {
            txs.should.be.instanceof(Array);
            txs.length.should.equal(f.returnedTransactions);
          }
          done();
        };

        res.jsonp = checkResult;
        req.param = sinon.stub();
        req.param.withArgs('addrs').returns(f.addrs.join(','));
        req.param.withArgs('from').returns(f.from);
        req.param.withArgs('to').returns(f.to);

        addresses.multitxs(req, res);
      });
    });
  });
});
