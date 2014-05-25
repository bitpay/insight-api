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
describe('Address balances', function() {
  this.timeout(5000);

  before(function(c) {
    txDb = TransactionDb;
    return c();
  });

  addrValid.forEach(function(v) {
    if (v.disabled) {
      console.log(v.addr + ' => disabled in JSON');
    } else {
      it('Address info for: ' + v.addr, function(done) {
        var a = new Address(v.addr, txDb);
        a.update(function(err) {
          if (err) done(err);
          v.addr.should.equal(a.addrStr);
          a.unconfirmedTxApperances.should.equal(v.unconfirmedTxApperances || 0, 'unconfirmedTxApperances'); 
          a.unconfirmedBalanceSat.should.equal(v.unconfirmedBalanceSat || 0, 'unconfirmedBalanceSat');
          if (v.txApperances)
            a.txApperances.should.equal(v.txApperances, 'txApperances');

          if (v.totalReceived) a.totalReceived.should.equal(v.totalReceived,'totalReceived');
          if (v.totalSent) assert.equal(v.totalSent, a.totalSent, 'send: ' + a.totalSent);

          if (v.balance) assert.equal(v.balance, a.balance, 'balance: ' + a.balance);

          if (v.transactions) {

            v.transactions.forEach(function(tx) {
              assert(a.transactions.indexOf(tx) > -1, 'have tx ' + tx);
            });
          }
          done();
        });
      });

      it('Address info (cache) for: ' + v.addr, function(done) {
        var a = new Address(v.addr, txDb);
        a.update(function(err) {
          if (err) done(err);
          v.addr.should.equal(a.addrStr);
          a.unconfirmedTxApperances.should.equal(v.unconfirmedTxApperances || 0, 'unconfirmedTxApperances'); 
          a.unconfirmedBalanceSat.should.equal(v.unconfirmedBalanceSat || 0, 'unconfirmedBalanceSat');
          if (v.txApperances)
            a.txApperances.should.equal(v.txApperances, 'txApperances');

          if (v.totalReceived) a.totalReceived.should.equal(v.totalReceived,'totalReceived');
          if (v.totalSent) assert.equal(v.totalSent, a.totalSent, 'send: ' + a.totalSent);
          if (v.balance) assert.equal(v.balance, a.balance, 'balance: ' + a.balance);
          done();
        },1);
      });
    }
  });

});

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
    },1);
  });
});

//tested against https://api.biteasy.com/testnet/v1/addresses/2N1pLkosf6o8Ciqs573iwwgVpuFS6NbNKx5/unspent-outputs?per_page=40
describe('Address utxo', function() {

  before(function(c) {
    txDb = TransactionDb;
    var l = utxoValid.length;
    var d=0;

    utxoValid.forEach(function(v) {
      //console.log('Deleting cache for', v.addr); //TODO
      txDb.deleteCacheForAddress(v.addr,function(){
        if (d++ == l-1) return c();
      });
    });
  });


  utxoValid.forEach(function(v) {
    if (v.disabled) {
      console.log(v.addr + ' => disabled in JSON');
    } else {
      it('Address utxo for: ' + v.addr, function(done) {
        this.timeout(2000);
        var a = new Address(v.addr, txDb);
        a.getUtxo(function(err, utxo) {
          if (err) done(err);
          assert.equal(v.addr, a.addrStr);
          if (v.length) utxo.length.should.equal(v.length, 'Unspent count');
          if (v.tx0id) {
            var x=utxo.filter(function(x){
                return x.txid === v.tx0id;
            });
            assert(x,'found output');
            x.length.should.equal(1,'found output');
            x[0].scriptPubKey.should.equal(v.tx0scriptPubKey,'scriptPubKey');
            x[0].amount.should.equal(v.tx0amount,'amount');
          }
          done();
        });
      });
      it('Address utxo (cached) for: ' + v.addr, function(done) {
        this.timeout(2000);
        var a = new Address(v.addr, txDb);
        a.getUtxo(function(err, utxo) {
          if (err) done(err);
          assert.equal(v.addr, a.addrStr);
          if (v.length) utxo.length.should.equal(v.length, 'Unspent count');
          if (v.tx0id) {
            var x=utxo.filter(function(x){
                return x.txid === v.tx0id;
            });
            assert(x,'found output');
            x.length.should.equal(1,'found output');
            x[0].scriptPubKey.should.equal(v.tx0scriptPubKey,'scriptPubKey');
            x[0].amount.should.equal(v.tx0amount,'amount');
          }
          done();
        });
      });
    }
  });
});
