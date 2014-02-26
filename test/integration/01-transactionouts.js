#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';



var assert          = require('assert'),
  fs              = require('fs'),
  util            = require('util'),
  TransactionDb = require('../../lib/TransactionDb').class();

var txItemsValid = JSON.parse(fs.readFileSync('test/integration/txitems.json'));
var txDb;

describe('TransactionDb fromIdWithInfo', function(){

  before(function(c) {
    txDb = new TransactionDb();
    return c();
  });


  var txid = '7e621eeb02874ab039a8566fd36f4591e65eca65313875221842c53de6907d6c';
  it('tx info ' + txid, function(done) {
    txDb.fromIdWithInfo(txid, function(err, tx) {

      if (err) done(err);
      assert.equal(tx.txid, txid);
      assert(!tx.info.isCoinBase);

      for(var i=0; i<20; i++)
        assert(parseFloat(tx.info.vin[i].value) === parseFloat(50), 'input '+i);
      assert(tx.info.vin[0].addr === 'msGKGCy2i8wbKS5Fo1LbWUTJnf1GoFFG59', 'addr 0');
      assert(tx.info.vin[1].addr === 'mfye7oHsdrHbydtj4coPXCasKad2eYSv5P', 'addr 1');
      done();
    });
  });

  it('tx info', function(done) {
    var txid = '21798ddc9664ac0ef618f52b151dda82dafaf2e26d2bbef6cdaf55a6957ca237';
    txDb.fromIdWithInfo(txid, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.txid, txid);
      assert(!tx.info.isCoinBase);
      done();
    });
  });

  it('should pool tx\'s info from bitcoind', function(done) {
    var txid = '21798ddc9664ac0ef618f52b151dda82dafaf2e26d2bbef6cdaf55a6957ca237';
    txDb.fromIdWithInfo(txid, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.info.txid, txid);
      assert.equal(tx.info.blockhash, '000000000185678d3d7ecc9962c96418174431f93fe20bf216d5565272423f74');
      assert.equal(tx.info.valueOut, 1.66174);
      assert.equal(tx.info.fees, 0.0005 );
      assert.equal(tx.info.size, 226 );
      assert(!tx.info.isCoinBase);
      done();
    });
  });

  var txid1 = '2a104bab1782e9b6445583296d4a0ecc8af304e4769ceb64b890e8219c562399';
  it('test a coinbase TX ' + txid1, function(done) {
    txDb.fromIdWithInfo(txid1, function(err, tx) {
      if (err) done(err);
      assert(tx.info.isCoinBase);
      assert.equal(tx.info.txid, txid1);
      assert(!tx.info.feeds);
      done();
    });
  });
  var txid22 = '666';
  it('test invalid TX ' + txid22, function(done) {
    txDb.fromIdWithInfo(txid22, function(err, tx) {
      if (err && err.message.match(/must.be.hexadecimal/))  {
          return done();
      }
      else {
        return done(err);
      }
    });
  });

  var txid23 = '21798ddc9664ac0ef618f52b151dda82dafaf2e26d2bbef6cdaf55a6957ca227';
  it('test unexisting TX ' + txid23, function(done) {

    txDb.fromIdWithInfo(txid23, function(err, tx) {
      assert(!err);
      assert(!tx);
      return done();
    });
  });



  var txid2 = '64496d005faee77ac5a18866f50af6b8dd1f60107d6795df34c402747af98608';
  it('create TX on the fly ' + txid2, function(done) {
    txDb.fromIdWithInfo(txid2, function(err, tx) {
      if (err) return done(err);
      assert.equal(tx.info.txid, txid2);
      done();
    });
  });

  txid2 = '64496d005faee77ac5a18866f50af6b8dd1f60107d6795df34c402747af98608';
  it('test a broken TX ' + txid2, function(done) {
    txDb.fromIdWithInfo(txid2, function(err, tx) {
      if (err) return done(err);
      assert.equal(tx.info.txid, txid2);
      assert.equal(tx.info.vin[0].addr, 'n1JagbRWBDi6VMvG7HfZmXX74dB9eiHJzU');
      done();
    });
  });
});

describe('TransactionDb Outs', function(){

  before(function(c) {
    txDb = new TransactionDb();
    return c();
  });

  txItemsValid.forEach( function(v) {
    if (v.disabled) return;
    it('test a processing tx ' + v.txid, function(done) {
      this.timeout(60000);

      // Remove first
      txDb.removeFromTxId(v.txid, function() {

        txDb.fromTxId( v.txid, function(err, readItems) {
          assert.equal(readItems.length,0);

          var unmatch=[];
          txDb.createFromArray([v.txid], null, function(err) {
            if (err) return done(err);

            txDb.fromTxId( v.txid, function(err, readItems) {

              v.items.forEach(function(validItem){ 
                unmatch[validItem.addr] =1;
              });
              assert.equal(readItems.length,v.items.length);

              v.items.forEach(function(validItem){ 
                var readItem = readItems.shift();

                assert.equal(readItem.addr,validItem.addr);
                assert.equal(readItem.value_sat,validItem.value_sat);
                assert.equal(readItem.index,validItem.index);
                assert.equal(readItem.spendIndex, null);
                assert.equal(readItem.spendTxIdBuf, null);
                delete unmatch[validItem.addr];
              });

              var valid = util.inspect(v.items, { depth: null });
              assert(!Object.keys(unmatch).length,'\n\tUnmatchs:' + Object.keys(unmatch) + "\n\n" +valid + '\nvs.\n' + readItems);
              return done();

            });
          });
        });
      });
    });
  });
});


