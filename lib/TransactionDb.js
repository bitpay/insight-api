'use strict';

var imports = require('soop').imports();



// to show tx outs
var OUTS_PREFIX = 'txo-'; //txo-<txid>-<n> => [addr, btc_sat]
var SPENT_PREFIX = 'txs-'; //txs-<txid(out)>-<n(out)>-<txid(in)>-<n(in)> = ts

// to sum up addr balance (only outs, spents are gotten later)
var ADDR_PREFIX = 'txa2-'; //txa-<addr>-<tsr>-<txid>-<n> 
// tsr = 1e13-js_timestamp
// => + btc_sat [:isConfirmed:[scriptPubKey|isSpendConfirmed:SpentTxid:SpentVout:SpentTs]
// |balance:txApperances


// TODO: use bitcore networks module
var genesisTXID = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';
var CONCURRENCY = 10;
var DEFAULT_SAFE_CONFIRMATIONS = 6;

var MAX_OPEN_FILES = 500;
var END_OF_WORLD_TS = 1e13;
//  var CONFIRMATION_NR_TO_NOT_CHECK = 10;  //Spend
/**
 * Module dependencies.
 */

var bitcore = require('bitcore'),
  Rpc = imports.rpc || require('./Rpc'),
  util = bitcore.util,
  networks = bitcore.networks,
  levelup = require('levelup'),
  async = require('async'),
  config = require('../config/config'),
  assert = require('assert'),
  Script = bitcore.Script,
  bitcoreUtil = bitcore.util,
  buffertools = require('buffertools');

var logger = require('./logger').logger;

var db = imports.db || levelup(config.leveldb + '/txs', {
  maxOpenFiles: MAX_OPEN_FILES
});
var PoolMatch = imports.poolMatch || require('soop').load('./PoolMatch', config);
// This is 0.1.2 = > c++ version of base58-native
var base58 = require('base58-native').base58Check;
var encodedData = require('soop').load('bitcore/util/EncodedData', {
  base58: base58
});
var versionedData = require('soop').load('bitcore/util/VersionedData', {
  parent: encodedData
});

var Address = require('soop').load('bitcore/lib/Address', {
  parent: versionedData
});



var TransactionDb = function() {
  TransactionDb.super(this, arguments);
  this.network = config.network === 'testnet' ? networks.testnet : networks.livenet;
  this.poolMatch = new PoolMatch();
  this.safeConfirmations = config.safeConfirmations || DEFAULT_SAFE_CONFIRMATIONS;

  this._db = db; // this is only exposed for migration script
};

TransactionDb.prototype.close = function(cb) {
  db.close(cb);
};

TransactionDb.prototype.drop = function(cb) {
  var path = config.leveldb + '/txs';
  db.close(function() {
    require('leveldown').destroy(path, function() {
      db = levelup(path, {
        maxOpenFiles: 500
      });
      return cb();
    });
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


TransactionDb.prototype._fillOutpoints = function(txInfo, cb) {
  var self = this;

  if (!txInfo || txInfo.isCoinBase) return cb();

  var valueIn = 0;
  var incompleteInputs = 0;

  async.eachLimit(txInfo.vin, CONCURRENCY, function(i, c_in) {
      self.fromTxIdN(i.txid, i.vout, function(err, ret) {
        if (!ret || !ret.addr || !ret.valueSat) {
          logger.info('Could not get TXouts in %s,%d from %s ', i.txid, i.vout, txInfo.txid);
          if (ret) i.unconfirmedInput = ret.unconfirmedInput;
          incompleteInputs = 1;
          return c_in(); // error not scalated
        }

        txInfo.firstSeenTs = ret.ts;
        i.unconfirmedInput = i.unconfirmedInput;
        i.addr = ret.addr;
        i.valueSat = ret.valueSat;
        i.value = ret.valueSat / util.COIN;
        valueIn += i.valueSat;

        if (ret.multipleSpentAttempt || !ret.spentTxId ||
          (ret.spentTxId && ret.spentTxId !== txInfo.txid)
        ) {
          if (ret.multipleSpentAttempts) {
            ret.multipleSpentAttempts.forEach(function(mul) {
              if (mul.spentTxId !== txInfo.txid) {

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
        txInfo.valueIn = valueIn / util.COIN;
        txInfo.fees = (valueIn - (txInfo.valueOut * util.COIN)).toFixed(0) / util.COIN;
      } else {
        txInfo.incompleteInputs = 1;
      }
      return cb();
    });
};

TransactionDb.prototype._getInfo = function(txid, next) {
  var self = this;

  Rpc.getTxInfo(txid, function(err, txInfo) {
    if (err) return next(err);
    self._fillOutpoints(txInfo, function() {
      self._fillSpent(txInfo, function() {
        return next(null, txInfo);
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

// Gets address info from an outpoint
TransactionDb.prototype.fromTxIdN = function(txid, n, cb) {
  var self = this;
  var k = OUTS_PREFIX + txid + '-' + n;

  db.get(k, function(err, val) {
    var ret;

    if (!val || (err && err.notFound)) {
      err = null;
      ret = {
        unconfirmedInput: 1
      };
    } else {
      var a = val.split(':');
      ret = {
        addr: a[0],
        valueSat: parseInt(a[1]),
      };
    }

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


TransactionDb.prototype.deleteCacheForAddress = function(addr, cb) {
  var k = ADDR_PREFIX + addr + '-';
  var dbScript = [];
  db.createReadStream({
    start: k,
    end: k + '~'
  })
    .on('data', function(data) {
      var v = data.value.split(':');
      dbScript.push({
        type: 'put',
        key: data.key,
        value: v[0],
      });
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {
      db.batch(dbScript, cb);
    });
};

TransactionDb.prototype.cacheConfirmations = function(txouts, cb) {
  var self = this;

  var dbScript = [];
  for (var ii in txouts) {
    var txout = txouts[ii];

    //everything already cached?
    if (txout.spentIsConfirmedCached) {
      continue;
    }

    var infoToCache = [];
    if (txout.confirmations >= self.safeConfirmations) {

      if (txout.spentConfirmations >= self.safeConfirmations) {
        // if spent, we overwrite scriptPubKey cache (not needed anymore)
        // First 1 = txout.isConfirmedCached (must be equal to 1 at this point)
        infoToCache = [1, 1, txout.spentTxId, txout.spentIndex, txout.spentTs];
      } else {
        if (!txout.isConfirmedCached) {
          infoToCache.push(1);
          txout.confirmedWillBeCached = 1;
        }
      }
      //console.log('[TransactionDb.js.352:infoToCache:]',infoToCache); //TODO
      if (infoToCache.length) {

        infoToCache.unshift(txout.value_sat);
        dbScript.push({
          type: 'put',
          key: txout.key,
          value: infoToCache.join(':'),
        });
      }
    }
  }

  //console.log('[TransactionDb.js.339:dbScript:]',dbScript); //TODO
  db.batch(dbScript, cb);
};


TransactionDb.prototype.cacheScriptPubKey = function(txouts, cb) {
  //  console.log('[TransactionDb.js.381:cacheScriptPubKey:]'); //TODO
  var self = this;
  var dbScript = [];
  for (var ii in txouts) {
    var txout = txouts[ii];
    //everything already cached?
    if (txout.scriptPubKeyCached || txout.spentTxId) {
      continue;
    }

    if (txout.scriptPubKey) {
      var infoToCache = [txout.value_sat, (txout.isConfirmedCached || txout.confirmedWillBeCached) ? 1 : 0, txout.scriptPubKey];
      dbScript.push({
        type: 'put',
        key: txout.key,
        value: infoToCache.join(':'),
      });
    }
  }
  db.batch(dbScript, cb);
};




TransactionDb.prototype._parseAddrData = function(k, data, ignoreCache) {
  var v = data.value.split(':');
  // console.log('[TransactionDb.js.375]',data.key,data.value);
  var item = {
    key: data.key,
    ts: END_OF_WORLD_TS - parseInt(k[2]),
    txid: k[3],
    index: parseInt(k[4]),
    value_sat: parseInt(v[0]),
  };

  if (ignoreCache)
    return item;

  // Cache: 
  //  v[1]== isConfirmedCached
  //  v[2]=== '1' -> is SpendCached -> [4]=spendTxId [5]=spentIndex [6]=spendTs
  //  v[2]!== '1' -> is ScriptPubkey -> [[2] = scriptPubkey
  if (v[1] === '1') {
    item.isConfirmed = 1;
    item.isConfirmedCached = 1;
    // console.log('[TransactionDb.js.356] CACHE HIT CONF:', item.key);
    // Sent, confirmed
    if (v[2] === '1') {
      // console.log('[TransactionDb.js.356] CACHE HIT SPENT:', item.key); 
      item.spentIsConfirmed = 1;
      item.spentIsConfirmedCached = 1;
      item.spentTxId = v[3];
      item.spentIndex = parseInt(v[4]);
      item.spentTs = parseInt(v[5]);
    }
    // Scriptpubkey cached
    else if (v[2]) {
      item.scriptPubKey = v[2];
      item.scriptPubKeyCached = 1;
      //  console.log('[TransactionDb.js.356] CACHE HIT SCRIPTPUBKEY:', item.key, v, item.scriptPubKey);
    }
  }
  return item;
};

TransactionDb.prototype.fromAddr = function(addr, opts, cb) {
  opts = opts || {};
  var self = this;
  var k = ADDR_PREFIX + addr + '-';
  var ret = [];
  var unique = {};

  db.createReadStream({
    start: k,
    end: k + '~',
    limit: opts.txLimit > 0 ? opts.txLimit : -1, // -1 means not limit
  })
    .on('data', function(data) {
      var k = data.key.split('-');
      var index = k[3] + k[4];
      if (!unique[index]) {
        unique[index] = 1;
        ret.push(self._parseAddrData(k, data, opts.ignoreCache));
      }
    })
    .on('error', cb)
    .on('end', function() {
      async.eachLimit(ret.filter(function(x) {
          return !x.spentIsConfirmed;
        }), CONCURRENCY, function(o, e_c) {
          var k = SPENT_PREFIX + o.txid + '-' + o.index + '-';
          db.createReadStream({
            start: k,
            end: k + '~'
          })
            .on('data', function(data) {
              var k = data.key.split('-');
              self._addSpentInfo(o, k[3], k[4], data.value);
            })
            .on('error', e_c)
            .on('end', e_c);
        },
        function(err) {
          return cb(err, ret);
        });
    });
};

TransactionDb.prototype._fromBuffer = function(buf) {
  var buf2 = buffertools.reverse(buf);
  return parseInt(buf2.toString('hex'), 16);
};

TransactionDb.prototype.getStandardizedTx = function(tx, time, isCoinBase) {
  var self = this;
  tx.txid = bitcoreUtil.formatHashFull(tx.getHash());
  var ti = 0;

  tx.vin = tx.ins.map(function(txin) {
    var ret = {
      n: ti++
    };
    if (isCoinBase) {
      ret.isCoinBase = true;
    } else {
      ret.txid = buffertools.reverse(new Buffer(txin.getOutpointHash())).toString('hex');
      ret.vout = txin.getOutpointIndex();
    }
    return ret;
  });

  var to = 0;
  tx.vout = tx.outs.map(function(txout) {
    var val;
    if (txout.s) {
      var s = new Script(txout.s);
      var addrs = new Address.fromScriptPubKey(s, config.network);
      // support only for p2pubkey p2pubkeyhash and p2sh
      if (addrs && addrs.length === 1) {
        val = {
          addresses: [addrs[0].toString()]
        };
      }
    }
    return {
      valueSat: self._fromBuffer(txout.v),
      scriptPubKey: val,
      n: to++,
    };
  });
  tx.time = time;
  return tx;
};


TransactionDb.prototype.fillScriptPubKey = function(txouts, cb) {
  var self = this;
  // Complete utxo info
  async.eachLimit(txouts, CONCURRENCY, function(txout, a_c) {
    self.fromIdInfoSimple(txout.txid, function(err, info) {
      if (!info || !info.vout) return a_c(err);

      txout.scriptPubKey = info.vout[txout.index].scriptPubKey.hex;
      return a_c();
    });
  }, function() {
    self.cacheScriptPubKey(txouts, cb);
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


// relatedAddrs is an optional hash, to collect related addresses in the transaction 
TransactionDb.prototype._addScript = function(tx, relatedAddrs) {
  var dbScript = [];
  var ts = tx.time;
  var txid = tx.txid || tx.hash;
  // var u=require('util');
  // console.log('[TransactionDb.js.518]', u.inspect(tx,{depth:10})); //TODO
  // Input Outpoints (mark them as spent)
  for (var ii in tx.vin) {
    var i = tx.vin[ii];
    if (i.txid) {
      var k = SPENT_PREFIX + i.txid + '-' + i.vout + '-' + txid + '-' + i.n;
      dbScript.push({
        type: 'put',
        key: k,
        value: ts || 0,
      });
    }
  }

  for (var ii in tx.vout) {
    var o = tx.vout[ii];
    if (o.scriptPubKey && o.scriptPubKey.addresses &&
      o.scriptPubKey.addresses[0] && !o.scriptPubKey.addresses[1] // TODO : not supported=> standard multisig
    ) {
      var addr = o.scriptPubKey.addresses[0];
      var sat = o.valueSat || ((o.value || 0) * util.COIN).toFixed(0);

      if (relatedAddrs) relatedAddrs[addr] = 1;
      var k = OUTS_PREFIX + txid + '-' + o.n;
      var tsr = END_OF_WORLD_TS - ts;
      dbScript.push({
        type: 'put',
        key: k,
        value: addr + ':' + sat,
      }, {
        type: 'put',
        key: ADDR_PREFIX + addr + '-' + tsr + '-' + txid + '-' + o.n,
        value: sat,
      });
    }
  }
  return dbScript;
};

// adds an unconfimed TX
TransactionDb.prototype.add = function(tx, cb) {
  var relatedAddrs = {};
  var dbScript = this._addScript(tx, relatedAddrs);
  db.batch(dbScript, function(err) {
    return cb(err, relatedAddrs);
  });
};

TransactionDb.prototype._addManyFromObjs = function(txs, next) {
  var dbScript = [];
  for (var ii in txs) {
    var s = this._addScript(txs[ii]);
    dbScript = dbScript.concat(s);
  }
  db.batch(dbScript, next);
};

TransactionDb.prototype._addManyFromHashes = function(txs, next) {
  var self = this;
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
      db.batch(dbScript, next);
    });
};


TransactionDb.prototype.addMany = function(txs, next) {
  if (!txs) return next();

  var fn = (typeof txs[0] === 'string') ?
    this._addManyFromHashes : this._addManyFromObjs;

  return fn.apply(this, [txs, next]);
};


TransactionDb.prototype.getPoolInfo = function(txid, cb) {
  var self = this;

  Rpc.getTxInfo(txid, function(err, txInfo) {
    if (err) return cb(false);
    var ret;

    if (txInfo && txInfo.isCoinBase)
      ret = self.poolMatch.match(new Buffer(txInfo.vin[0].coinbase, 'hex'));

    return cb(ret);
  });
};


TransactionDb.prototype.checkVersion02 = function(cb) {
  var k = 'txa-';
  var isV2 = 1;
  db.createReadStream({
    start: k,
    end: k + '~',
    limit: 1,
  })
    .on('data', function(data) {
      isV2 = 0;
    })
    .on('end', function() {
      return cb(isV2);
    });
};

TransactionDb.prototype.migrateV02 = function(cb) {
  var k = 'txa-';
  var dbScript = [];
  var c = 0;
  var c2 = 0;
  var N = 50000;
  db.createReadStream({
    start: k,
    end: k + '~'
  })
    .on('data', function(data) {
      var k = data.key.split('-');
      var v = data.value.split(':');
      dbScript.push({
        type: 'put',
        key: ADDR_PREFIX + k[1] + '-' + (END_OF_WORLD_TS - parseInt(v[1])) + '-' + k[2] + '-' + k[3],
        value: v[0],
      });
      if (c++ > N) {
        console.log('\t%dM txs outs processed', ((c2 += N) / 1e6).toFixed(3)); //TODO
        db.batch(dbScript, function() {
          c = 0;
          dbScript = [];
        });
      }
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {
      return cb();
    });
};



module.exports = require('soop')(TransactionDb);
