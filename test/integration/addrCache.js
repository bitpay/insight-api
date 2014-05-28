#!/usr/bin/env node

'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var assert = require('assert'),
  fs = require('fs'),
  Address = require('../../app/models/Address'),
  TransactionDb = require('../../lib/TransactionDb').default(),
  addrValid = JSON.parse(fs.readFileSync('test/integration/addr.json')),
  utxoValid = JSON.parse(fs.readFileSync('test/integration/utxo.json'));

var should = require('chai');

var txDb;


describe('Address cache ', function() {
  this.timeout(5000);

  before(function(c) {
    txDb = TransactionDb;
    txDb.deleteCacheForAddress('muAt5RRqDarPFCe6qDXGZc54xJjXYUyepG',function(){
     txDb.deleteCacheForAddress('mt2AzeCorSf7yFckj19HFiXJgh9aNyc4h3',c);
    });
  });



  it('cache case 1 w/o cache', function(done) {
    var a = new Address('muAt5RRqDarPFCe6qDXGZc54xJjXYUyepG', txDb);
    a.update(function(err) {
      if (err) done(err);
      a.balance.should.equal(0, 'balance');
      a.totalReceived.should.equal(19175, 'totalReceived');
      a.txApperances.should.equal(2, 'txApperances');
      return done();
    });
  });
   it('cache case 1 w cache', function(done) {
    var a = new Address('muAt5RRqDarPFCe6qDXGZc54xJjXYUyepG', txDb);
    a.update(function(err) {
      if (err) done(err);
      a.balance.should.equal(0, 'balance');
      a.totalReceived.should.equal(19175, 'totalReceived');
      a.txApperances.should.equal(2, 'txApperances');
      return done();
    });
  });
 


  it('cache case unspent w/o cache', function(done) {
    var a = new Address('2N7zvqQTUYFfhYvFs1NEzureMLvhwk5FSsk', txDb);
    a.update(function(err) {
      if (err) done(err);
      a.balance.should.equal(0.23, 'balance');
      a.totalReceived.should.equal(0.23, 'totalReceived');
      a.txApperances.should.equal(1, 'txApperances');
      return done();
    });
  });
 

  it('cache case unspent w cache', function(done) {
    var a = new Address('2N7zvqQTUYFfhYvFs1NEzureMLvhwk5FSsk', txDb);
    a.update(function(err) {
      if (err) done(err);
      a.balance.should.equal(0.23, 'balance');
      a.totalReceived.should.equal(0.23, 'totalReceived');
      a.txApperances.should.equal(1, 'txApperances');
      return done();
    });
  });
  it('cache case 2 w/o cache', function(done) {
    var a = new Address('mt2AzeCorSf7yFckj19HFiXJgh9aNyc4h3', txDb);
    a.update(function(err) {
      if (err) done(err);
      a.balance.should.equal(0, 'balance');
      a.totalReceived.should.equal(1376000, 'totalReceived');
      a.txApperances.should.equal(8003, 'txApperances');
      return done();
    });
  },1);
  it('cache case 2 w cache', function(done) {
    var a = new Address('mt2AzeCorSf7yFckj19HFiXJgh9aNyc4h3', txDb);
    a.update(function(err) {
      if (err) done(err);
      a.balance.should.equal(0, 'balance');
      a.totalReceived.should.equal(1376000, 'totalReceived');
      a.txApperances.should.equal(8003, 'txApperances');
      return done();
    },{noTxList:1});
  });
});


