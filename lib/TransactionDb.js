'use strict';

var imports       = require('soop').imports();


// to show tx outs
var OUTS_PREFIX = 'txo-'; //txo-<txid>-<n> => [addr, btc_sat]
var SPENT_PREFIX = 'txs-'; //txs-<txid(out)>-<n(out)>-<txid(in)>-<n(in)> = ts

// to sum up addr balance (only outs, spents are gotten later)
var ADDR_PREFIX = 'txa-'; //txa-<addr>-<txid>-<n> => + btc_sat:ts [:<txid>-<n>](spent)

// TODO: use bitcore networks module
var genesisTXID = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';
var CONCURRENCY = 10;

var MAX_OPEN_FILES    = 500;
//  var CONFIRMATION_NR_TO_NOT_CHECK = 10;  //Spend
/**
  * Module dependencies.
  */

var bitcore  = require('bitcore'),
    Rpc      = imports.rpc || require('./Rpc'),
    util     = bitcore.util,
    networks = bitcore.networks,
    levelup  = require('levelup'),
    async    = require('async'),
    config   = require('../config/config'),
    assert   = require('assert');

var logger = require('./logger').logger;
var d      = logger.log;
var info   = logger.info;
var warn   = logger.warn;
var db           = imports.db || levelup(config.leveldb + '/txs',{maxOpenFiles: MAX_OPEN_FILES} );

var PoolMatch     = imports.poolMatch || require('soop').load('./PoolMatch',config);

var TransactionDb = function() {
  TransactionDb.super(this, arguments);
  this.network = config.network === 'testnet' ? networks.testnet : networks.livenet;
  this.poolMatch = new PoolMatch();
};

TransactionDb.prototype.close = function(cb) {
  db.close(cb);
};

TransactionDb.prototype.drop = function(cb) {
  var path = config.leveldb + '/txs';
  db.close(function() {
    require('leveldown').destroy(path, function() {
      db = levelup(path, {maxOpenFiles: 500});
      return cb();
    });
  });
};


TransactionDb.prototype.has = function(txid, cb) {

  var k = OUTS_PREFIX + txid;
  db.get(k, function(err, val) {

    var ret;

    if (err && err.notFound) {
      err = null;
      ret = false;
    }
    if (typeof val !== undefined) {
      ret = true;
    }
    return cb(err, ret);
  });
};

TransactionDb.prototype._addSpentInfo = function(r, txid, index, ts) {
  if (r.spentTxId) {
    if (!r.multipleSpentAttempts) {
      r.multipleSpentAttempts = [{
        txid: r.spentTxId,
        index: r.index,
      }];
    }
    r.multipleSpentAttempts.push({
      txid: txid,
      index: parseInt(index),
    });
  } else {
    r.spentTxId = txid;
    r.spentIndex = parseInt(index);
    r.spentTs = parseInt(ts);
  }
};


// This is not used now
TransactionDb.prototype.fromTxId = function(txid, cb) {
  var self = this;
  var k = OUTS_PREFIX + txid;
  var ret = [];
  var idx = {};
  var i = 0;

  // outs.
  db.createReadStream({
    start: k,
    end: k + '~'
  })
    .on('data', function(data) {
      var k = data.key.split('-');
      var v = data.value.split(':');
      ret.push({
        addr: v[0],
        value_sat: parseInt(v[1]),
        index: parseInt(k[2]),
      });
      idx[parseInt(k[2])] = i++;
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {

      var k = SPENT_PREFIX + txid + '-';
      db.createReadStream({
        start: k,
        end: k + '~'
      })
        .on('data', function(data) {
          var k = data.key.split('-');
          var j = idx[parseInt(k[2])];

          assert(typeof j !== 'undefined', 'Spent could not be stored: tx ' + txid +
            'spent in TX:' + k[1] + ',' + k[2] + ' j:' + j);

          self._addSpentInfo(ret[j], k[3], k[4], data.value);
        })
        .on('error', function(err) {
          return cb(err);
        })
        .on('end', function(err) {
          return cb(err, ret);
        });
    });
};


TransactionDb.prototype._fillSpent = function(info, cb) {
  var self = this;

  if (!info) return cb();

  var k = SPENT_PREFIX + info.txid + '-';
  db.createReadStream({
    start: k,
    end: k + '~'
  })
    .on('data', function(data) {
      var k = data.key.split('-');
      self._addSpentInfo(info.vout[k[2]], k[3], k[4], data.value);
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function(err) {
      return cb(err);
    });
};


TransactionDb.prototype._fillOutpoints = function(info, cb) {
  var self = this;

  if (!info || info.isCoinBase) return cb();

  var valueIn = 0;
  var incompleteInputs = 0;

  async.eachLimit(info.vin, CONCURRENCY, function(i, c_in) {
      self.fromTxIdN(i.txid, i.vout, info.confirmations, function(err, ret) {
        if (!ret || !ret.addr || !ret.valueSat) {
          info('Could not get TXouts in %s,%d from %s ', i.txid, i.vout, info.txid);
          if (ret) i.unconfirmedInput = ret.unconfirmedInput;
          incompleteInputs = 1;
          return c_in(); // error not scalated
        }

        info.firstSeenTs = ret.spentTs;
        i.unconfirmedInput = i.unconfirmedInput;
        i.addr = ret.addr;
        i.valueSat = ret.valueSat;
        i.value = ret.valueSat / util.COIN;
        valueIn += i.valueSat;

/*        
*        If confirmed by bitcoind, we could not check for double spents
*        but we prefer to keep the flag of double spent attempt
*
        if (info.confirmations
            && info.confirmations >= CONFIRMATION_NR_TO_NOT_CHECK)
          return c_in();
isspent
*/
        // Double spent?
        if (ret.multipleSpentAttempt || !ret.spentTxId ||
          (ret.spentTxId && ret.spentTxId !== info.txid)
        ) {
          if (ret.multipleSpentAttempts) {
            ret.multipleSpentAttempts.forEach(function(mul) {
              if (mul.spentTxId !== info.txid) {
                i.doubleSpentTxID = ret.spentTxId;
                i.doubleSpentIndex = ret.spentIndex;
              }
            });
          } else if (!ret.spentTxId) {
            i.dbError = 'Input spent not registered';
          } else {
            i.doubleSpentTxID = ret.spentTxId;
            i.doubleSpentIndex = ret.spentIndex;
          }
        } else {
          i.doubleSpentTxID = null;
        }
        return c_in();
      });
    },
    function() {
      if (!incompleteInputs) {
        info.valueIn = valueIn / util.COIN;
        info.fees = (valueIn - (info.valueOut * util.COIN)).toFixed(0) / util.COIN;
      } else {
        info.incompleteInputs = 1;
      }
      return cb();
    });
};

TransactionDb.prototype._getInfo = function(txid, next) {
  var self = this;

  Rpc.getTxInfo(txid, function(err, info) {
    if (err) return next(err);
    self._fillOutpoints(info, function() {
      self._fillSpent(info, function() {
        return next(null, info);
      });
    });
  });
};


// Simplified / faster Info version: No spent / outpoints info.
TransactionDb.prototype.fromIdInfoSimple = function(txid, cb) {
  Rpc.getTxInfo(txid, true, function(err, info) {
    if (err) return cb(err);
    if (!info) return cb();
    return cb(err, info);
  });
};

TransactionDb.prototype.fromIdWithInfo = function(txid, cb) {
  var self = this;

  self._getInfo(txid, function(err, info) {
    if (err) return cb(err);
    if (!info) return cb();
    return cb(err, {
      txid: txid,
      info: info
    });
  });
};

TransactionDb.prototype.fromTxIdN = function(txid, n, confirmations, cb) {
  var self = this;
  var k = OUTS_PREFIX + txid + '-' + n;

  db.get(k, function(err, val) {
    if (!val || (err && err.notFound)) {
      return cb(null, {
        unconfirmedInput: 1
      });
    }

    var a = val.split(':');
    var ret = {
      addr: a[0],
      valueSat: parseInt(a[1]),
    };

    /* 
      * If this TxID comes from an RPC request 
      * the .confirmations value from bitcoind is available
      * so we could avoid checking if the input was  double spent
      *
      * This speed up address calculations by ~30%
      *
      if (confirmations >= CONFIRMATION_NR_TO_NOT_CHECK) {
        return cb(null, ret);
      }
    */

    // spent?
    var k = SPENT_PREFIX + txid + '-' + n + '-';
    db.createReadStream({
      start: k,
      end: k + '~'
    })
      .on('data', function(data) {
        var k = data.key.split('-');
        self._addSpentInfo(ret, k[3], k[4], data.value);
      })
      .on('error', function(error) {
        return cb(error);
      })
      .on('end', function() {
        return cb(null, ret);
      });
  });
};

TransactionDb.prototype.fillConfirmations = function(o, cb) {
  var self = this;

console.log('[TransactionDb.js.339]'); //TODO
  self.getBlock(o.txid, function(err, hash) {

console.log('[TransactionDb.js.342]'); //TODO
    if (err) return cb(err);

    o.isConfirmed = hash?1:0;
    if (!o.spentTxId) return cb();

    if (o.multipleSpentAttempts) {

      //TODO save it for later is height > 6
      async.eachLimit(o.multipleSpentAttempts, CONCURRENCY,
        function(oi, e_c) {
          self.getBlock(oi.spentTxId, function(err, hash) {
            if (err) return;
            if (hash) {
              o.spentTxId = oi.spentTxId;
              o.index = oi.index;
              o.spentIsConfirmed = 1;
            }
            return e_c();
          });
        }, cb);
    } else {
      self.getBlock(o.spentTxId, function(err, hash) {
        if (err) return cb(err);
        o.spentIsConfirmed = hash?1:0;
        return cb();
      });
    }
  });
};

TransactionDb.prototype.fromAddr = function(addr, cb) {
  var self = this;

  var k = ADDR_PREFIX + addr + '-';
  var ret = [];

  db.createReadStream({
    start: k,
    end: k + '~'
  })
    .on('data', function(data) {
      var k = data.key.split('-');
      var v = data.value.split(':');
      ret.push({
        txid: k[2],
        index: parseInt(k[3]),
        value_sat: parseInt(v[0]),
        ts: parseInt(v[1]),
      });
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {

      //TODO is spent, and conf > 6, save it on ADDR_PREFIX for later
      //and skip all the rest
      async.eachLimit(ret, CONCURRENCY, function(o, e_c) {
          var k = SPENT_PREFIX + o.txid + '-' + o.index + '-';
          db.createReadStream({
            start: k,
            end: k + '~'
          })
            .on('data', function(data) {
              var k = data.key.split('-');
              self._addSpentInfo(o, k[3], k[4], data.value);
            })
            .on('error', function(err) {
              return e_c(err);
            })
            .on('end', function(err) {
              return e_c(err);
            });
        },
        function() {
          async.eachLimit(ret, CONCURRENCY, function(o, e_c) {
            self.fillConfirmations(o, e_c);
          }, function(err) {
            return cb(err, ret);
          });
        });
    });
};


TransactionDb.prototype.removeFromTxId = function(txid, cb) {

  async.series([

      function(c) {
        db.createReadStream({
          start: OUTS_PREFIX + txid + '-',
          end: OUTS_PREFIX + txid + '~',
        }).pipe(
          db.createWriteStream({
            type: 'del'
          })
        ).on('close', c);
      },
      function(c) {
        db.createReadStream({
          start: SPENT_PREFIX + txid + '-',
          end: SPENT_PREFIX + txid + '~'
        })
          .pipe(
            db.createWriteStream({
              type: 'del'
            })
        ).on('close', c);
      }
    ],
    function(err) {
      cb(err);
    });

};


TransactionDb.prototype._addScript = function(tx) {
  var relatedAddrs = [];
  var dbScript  = [];
  var ts        = tx.time;
  var txid      = tx.txid;

  // Input Outpoints (mark them as spent)
  if (!tx.isCoinBase){
    for(var ii in tx.vin) {
      var i = tx.vin[ii];
      dbScript.push({
        type: 'put',
        key: SPENT_PREFIX + i.txid + '-' + i.vout + '-' + txid + '-' + i.n,
        value: ts || 0,
      });
    }
  }

  for(var ii in tx.vout) {
    var o = tx.vout[ii];
    if ((o.value||o.valueSat) &&
        o.scriptPubKey &&
          o.scriptPubKey.addresses &&
            o.scriptPubKey.addresses[0] && !o.scriptPubKey.addresses[1] // TODO : not supported=> standard multisig
       ) {
         var addr = o.scriptPubKey.addresses[0];
         var sat = o.valueSat || (o.value * util.COIN).toFixed(0);

         relatedAddrs[addr]=1;
         var k = OUTS_PREFIX + txid + '-' + o.n;
         dbScript.push({
           type: 'put',
           key: k,
           value: addr + ':' + sat,
         },{
           type: 'put',
           key: ADDR_PREFIX + addr + '-' + txid + '-' + o.n,
           value: sat + ':' + ts,
         });
       }
  }
  tx.relatedAddrs=relatedAddrs;
  return dbScript;
};


TransactionDb.prototype.add = function(tx, blockhash, cb) {
  var dbScript = this._addScript(tx, blockhash);
  db.batch(dbScript, cb);
};

TransactionDb.prototype._addManyFromObjs = function(txs, next) {
  var dbScript = [];

  for(var ii in txs){
    var s = this._addScript(txs[ii]);
    dbScript = dbScript.concat(s);
  }
  db.batch(dbScript, next);
};

TransactionDb.prototype._addManyFromHashes = function(txs, next) {
  var self=this;
  var dbScript = [];
  async.eachLimit(txs, CONCURRENCY, function(tx, each_cb) {
    if (tx === genesisTXID)
      return each_cb();

    Rpc.getTxInfo(tx, function(err, inInfo) {
      if (!inInfo) return each_cb(err);
      dbScript = dbScript.concat(self._addScript(inInfo));
      return each_cb();
    });
    },
    function(err) {
      if (err) return next(err);
      db.batch(dbScript,next);
    });
};


TransactionDb.prototype.addMany = function(txs, next) {
  if (!txs) return next();

  var fn = (typeof txs[0] ==='string') ? 
    this._addManyFromHashes : this._addManyFromObjs;

  return fn.apply(this,[txs, next]);
};


TransactionDb.prototype.getPoolInfo = function(tx, cb) {
  var self = this;
  self._getInfo(tx, function(e, a) {
    if (e) return cb(false);

    if (a && a.isCoinBase) {
      var coinbaseHexBuffer = new Buffer(a.vin[0].coinbase, 'hex');
      var aa = self.poolMatch.match(coinbaseHexBuffer);
      
      return cb(aa);
    }
    else {
      return cb();
    }
  });
};


module.exports = require('soop')(TransactionDb);
