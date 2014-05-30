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

    var l =addrValid.length;
    var i =0;
    addrValid.forEach(function(v) {
      TransactionDb.deleteCacheForAddress(v.addr, function() {
        if (++i===l) return c();
      });
    });
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

          if (v.unconfirmedTxApperances)
            a.unconfirmedTxApperances.should.equal(v.unconfirmedTxApperances || 0, 'unconfirmedTxApperances'); 
          if (v.unconfirmedBalanceSat)
            a.unconfirmedBalanceSat.should.equal(v.unconfirmedBalanceSat || 0, 'unconfirmedBalanceSat');
          if (v.txApperances)
            a.txApperances.should.equal(v.txApperances, 'txApperances');

          if (v.totalReceived) a.totalReceived.should.equal(v.totalReceived,'totalReceived');
          if (v.totalSent) assert.equal(v.totalSent, a.totalSent, 'send: ' + a.totalSent);

          if (v.balance) assert.equal(v.balance, a.balance, 'balance: ' + a.balance);

          if (v.transactions) {

            v.transactions.forEach(function(tx) {
              a.transactions.should.include(tx);
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
        },{txLimit:0});
      });
    }
  });

});

//tested against https://api.biteasy.com/testnet/v1/addresses/2N1pLkosf6o8Ciqs573iwwgVpuFS6NbNKx5/unspent-outputs?per_page=40
describe('Address unspent', function() {

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
      it('Address unspent for: ' + v.addr, function(done) {
        this.timeout(2000);
        var a = new Address(v.addr, txDb);
        a.update(function(err) {
          if (err) done(err);
          assert.equal(v.addr, a.addrStr);
          if (v.length) a.unspent.length.should.equal(v.length, 'Unspent count');
          if (v.tx0id) {
            var x=a.unspent.filter(function(x){
                return x.txid === v.tx0id;
            });
            assert(x,'found output');
            x.length.should.equal(1,'found output');
            x[0].scriptPubKey.should.equal(v.tx0scriptPubKey,'scriptPubKey');
            x[0].amount.should.equal(v.tx0amount,'amount');
          }
          done();
        }, {onlyUnspent:1});
      });
      it('Address unspent (cached) for: ' + v.addr, function(done) {
        this.timeout(2000);
        var a = new Address(v.addr, txDb);
        a.update(function(err) {
          if (err) done(err);
          assert.equal(v.addr, a.addrStr);
          if (v.length) a.unspent.length.should.equal(v.length, 'Unspent count');
          if (v.tx0id) {
            var x=a.unspent.filter(function(x){
                return x.txid === v.tx0id;
            });
            assert(x,'found output');
            x.length.should.equal(1,'found output');
            x[0].scriptPubKey.should.equal(v.tx0scriptPubKey,'scriptPubKey');
            x[0].amount.should.equal(v.tx0amount,'amount');
          }
          done();
        }, {onlyUnspent:1});
      });
    }
  });
});
