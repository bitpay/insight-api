'use strict';
var imports = require('soop').imports();
var TIMESTAMP_PREFIX = 'bts-'; // bts-<ts> => <hash>
var PREV_PREFIX = 'bpr-'; // bpr-<hash> => <prev_hash> 
var NEXT_PREFIX = 'bne-'; // bne-<hash> => <next_hash> 
var MAIN_PREFIX = 'bma-'; // bma-<hash> =>    <height> (0 is unconnected)
var TIP = 'bti-'; // bti = <hash>:<height> last block on the chain
var LAST_FILE_INDEX = 'file-'; // last processed file index

// txid - blockhash mapping  (only for confirmed txs, ONLY FOR BEST BRANCH CHAIN)
var IN_BLK_PREFIX = 'btx-'; //btx-<txid> = <block> 


var MAX_OPEN_FILES = 500;
var CONCURRENCY = 5;
var DFLT_REQUIRED_CONFIRMATIONS = 1;

/**
 * Module dependencies.
 */
var levelup = require('levelup'),
  config = require('../config/config');
var db = imports.db || levelup(config.leveldb + '/blocks', {
  maxOpenFiles: MAX_OPEN_FILES
});
var Rpc = imports.rpc || require('./Rpc');
var async = require('async');


var logger = require('./logger').logger;
var info = logger.info;

var BlockDb = function(opts) {
  this.txDb = require('./TransactionDb').default();
  this.safeConfirmations = config.safeConfirmations || DEFAULT_SAFE_CONFIRMATIONS;
  BlockDb.super(this, arguments);
};

BlockDb.prototype.close = function(cb) {
  db.close(cb);
};

BlockDb.prototype.drop = function(cb) {
  var path = config.leveldb + '/blocks';
  db.close(function() {
    require('leveldown').destroy(path, function() {
      db = levelup(path, {
        maxOpenFiles: MAX_OPEN_FILES
      });
      return cb();
    });
  });
};


BlockDb.prototype._addBlockScript = function(b, height) {
  var time_key = TIMESTAMP_PREFIX +
    (b.time || Math.round(new Date().getTime() / 1000));

  return [{
    type: 'put',
    key: time_key,
    value: b.hash,
  }, {
    type: 'put',
    key: MAIN_PREFIX + b.hash,
    value: height,
  }, {
    type: 'put',
    key: PREV_PREFIX + b.hash,
    value: b.previousblockhash,
  }, ];
};

BlockDb.prototype._delTxsScript = function(txs) {
  var dbScript = [];

  for (var ii in txs) {
    dbScript.push({
      type: 'del',
      key: IN_BLK_PREFIX + txs[ii],
    });
  }
  return dbScript;
};

BlockDb.prototype._addTxsScript = function(txs, hash, height) {
  var dbScript = [];

  for (var ii in txs) {
    dbScript.push({
      type: 'put',
      key: IN_BLK_PREFIX + txs[ii],
      value: hash + ':' + height,
    });
  }
  return dbScript;
};

// Returns blockHash and height for a given txId (If the tx is on the MAIN chain).
BlockDb.prototype.getBlockForTx = function(txId, cb) {
  db.get(IN_BLK_PREFIX + txId, function(err, val) {
    if (err && err.notFound) return cb();
    if (err) return cb(err);

    var v = val.split(':');
    return cb(err, v[0], parseInt(v[1]));
  });
};

BlockDb.prototype._changeBlockHeight = function(hash, height, cb) {
  var self = this;
  var dbScript1 = this._setHeightScript(hash, height);

  logger.log('Getting TXS FROM %s to set it Main', hash);
  this.fromHashWithInfo(hash, function(err, bi) {
    if (!bi || !bi.info || !bi.info.tx)
      throw new Error('unable to get info for block:' + hash);

    var dbScript2;
    if (height >= 0) {
      dbScript2 = self._addTxsScript(bi.info.tx, hash, height);
      logger.info('\t%s %d Txs', 'Confirming', bi.info.tx.length);
    } else {
      dbScript2 = self._delTxsScript(bi.info.tx);
      logger.info('\t%s %d Txs', 'Unconfirming', bi.info.tx.length);
    }
    db.batch(dbScript2.concat(dbScript1), cb);
  });
};

BlockDb.prototype.setBlockMain = function(hash, height, cb) {
  this._changeBlockHeight(hash, height, cb);
};

BlockDb.prototype.setBlockNotMain = function(hash, cb) {
  this._changeBlockHeight(hash, -1, cb);
};

// adds a block (and its txs). Does not update Next pointer in 
// the block prev to the new block, nor TIP pointer
//
BlockDb.prototype.add = function(b, height, cb) {
  var txs = typeof b.tx[0] === 'string' ? b.tx : b.tx.map(function(o) {
    return o.txid;
  });

  var dbScript = this._addBlockScript(b, height);
  dbScript = dbScript.concat(this._addTxsScript(txs, b.hash, height));
  this.txDb.addMany(b.tx, function(err) {
    if (err) return cb(err);
    db.batch(dbScript, cb);
  });
};

BlockDb.prototype.getTip = function(cb) {

  if (this.cachedTip) {
    var v = this.cachedTip.split(':');
    return cb(null, v[0], parseInt(v[1]));
  }

  var self = this;
  db.get(TIP, function(err, val) {
    if (!val) return cb();
    self.cachedTip = val;
    var v = val.split(':');
    return cb(err, v[0], parseInt(v[1]));
  });
};

BlockDb.prototype.setTip = function(hash, height, cb) {
  this.cachedTip = hash + ':' + height;
  db.put(TIP, this.cachedTip, function(err) {
    return cb(err);
  });
};

BlockDb.prototype.getDepth = function(hash, cb) {
  var v = this.cachedTip.split(':');
  if (!v) throw new Error('getDepth called with not cachedTip');
  this.getHeight(hash, function(err, h) {
    return cb(err, parseInt(v[1]) - h);
  });
};

//mainly for testing
BlockDb.prototype.setPrev = function(hash, prevHash, cb) {
  db.put(PREV_PREFIX + hash, prevHash, function(err) {
    return cb(err);
  });
};

BlockDb.prototype.getPrev = function(hash, cb) {
  db.get(PREV_PREFIX + hash, function(err, val) {
    if (err && err.notFound) {
      err = null;
      val = null;
    }
    return cb(err, val);
  });
};


BlockDb.prototype.setLastFileIndex = function(idx, cb) {
  var self = this;
  if (this.lastFileIndexSaved === idx) return cb();

  db.put(LAST_FILE_INDEX, idx, function(err) {
    self.lastFileIndexSaved = idx;
    return cb(err);
  });
};

BlockDb.prototype.getLastFileIndex = function(cb) {
  db.get(LAST_FILE_INDEX, function(err, val) {
    if (err && err.notFound) {
      err = null;
      val = null;
    }
    return cb(err, val);
  });
};

BlockDb.prototype.getNext = function(hash, cb) {
  db.get(NEXT_PREFIX + hash, function(err, val) {
    if (err && err.notFound) {
      err = null;
      val = null;
    }
    return cb(err, val);
  });
};

BlockDb.prototype.getHeight = function(hash, cb) {
  db.get(MAIN_PREFIX + hash, function(err, val) {
    if (err && err.notFound) {
      err = null;
      val = 0;
    }
    return cb(err, parseInt(val));
  });
};

BlockDb.prototype._setHeightScript = function(hash, height) {
  logger.log('setHeight: %s #%d', hash, height);
  return ([{
    type: 'put',
    key: MAIN_PREFIX + hash,
    value: height,
  }]);
};

BlockDb.prototype.setNext = function(hash, nextHash, cb) {
  db.put(NEXT_PREFIX + hash, nextHash, function(err) {
    return cb(err);
  });
};

// Unused
BlockDb.prototype.countConnected = function(cb) {
  var c = 0;
  console.log('Counting connected blocks. This could take some minutes');
  db.createReadStream({
      start: MAIN_PREFIX,
      end: MAIN_PREFIX + '~'
    })
    .on('data', function(data) {
      if (data.value !== 0) c++;
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {
      return cb(null, c);
    });
};

// .has() return true orphans also
BlockDb.prototype.has = function(hash, cb) {
  var k = PREV_PREFIX + hash;
  db.get(k, function(err) {
    var ret = true;
    if (err && err.notFound) {
      err = null;
      ret = false;
    }
    return cb(err, ret);
  });
};

BlockDb.prototype.fromHashWithInfo = function(hash, cb) {
  var self = this;

  Rpc.getBlock(hash, function(err, info) {
    if (err || !info) return cb(err);

    //TODO can we get this from RPC .height?
    self.getHeight(hash, function(err, height) {
      if (err) return cb(err);

      info.isMainChain = height >= 0 ? true : false;

      return cb(null, {
        hash: hash,
        info: info,
      });
    });
  });
};

BlockDb.prototype.getBlocksByDate = function(start_ts, end_ts, limit, cb) {
  var list = [];
  var opts = {
    start: TIMESTAMP_PREFIX + end_ts, //Inverted since list is reversed
    end: TIMESTAMP_PREFIX + start_ts,
    limit: limit,
    reverse: 1,
  };

  db.createReadStream(opts)
    .on('data', function(data) {
      var k = data.key.split('-');
      list.push({
        ts: k[1],
        hash: data.value,
      });
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {
      return cb(null, list.reverse());
    });
};

BlockDb.prototype.blockIndex = function(height, cb) {
  return Rpc.blockIndex(height, cb);
};

BlockDb.prototype._fillConfirmationsOneSpent = function(o, chainHeight, cb) {
  var self = this;
  if (!o.spentTxId) return cb();

  if (o.multipleSpentAttempts) {
    async.eachLimit(o.multipleSpentAttempts, CONCURRENCY,
      function(oi, e_c) {
        // Only one will be confirmed
        self.getBlockForTx(oi.txid, function(err, hash, height) {
          if (err) return;
          if (height >= 0) {
            o.spentTxId = oi.txid;
            o.index = oi.index;
            o.spentIsConfirmed = chainHeight >= height;
            o.spentConfirmations = chainHeight - height + 1;
          }
          return e_c();
        });
      }, cb);
  } else {
    self.getBlockForTx(o.spentTxId, function(err, hash, height) {
      if (err) return cb(err);
      if (height >= 0) {
        o.spentIsConfirmed = chainHeight >= height;
        o.spentConfirmations = chainHeight - height + 1;
      }
      return cb();
    });
  }
};


BlockDb.prototype._fillConfirmationsOneVin = function(o, chainHeight, cb) {
  var self = this;

  self.getBlockForTx(o.txid, function(err, hash, height) {
    if (err) return cb(err);
    o.isConfirmed = false;
    o.confirmations = 0;
    if (height >= 0) {
      o.isConfirmed = chainHeight >= height;
      o.confirmations = chainHeight - height + 1;
    }
    o.unconfirmedInput = ! o.isConfirmed;
    o.confirmedIn = height;
    return cb();
  });
};


BlockDb.prototype._fillConfirmationsOne = function(o, chainHeight, cb) {
  var self = this;
  self.getBlockForTx(o.txid, function(err, hash, height) {
    if (err) return cb(err);
    if (height >= 0) {
      o.isConfirmed = chainHeight >= height;
      o.confirmations = chainHeight - height + 1;
      return self._fillConfirmationsOneSpent(o, chainHeight, cb);
    } else return cb();
  });
};

BlockDb.prototype.fillConfirmations = function(txouts, cb) {
  var self = this;
  this.getTip(function(err, hash, height) {
    var txs = txouts.filter(function(x) {
      return !x.spentIsConfirmedCached // not 100%cached
        && !(x.isConfirmedCached && !x.spentTxId); // and not partial cached but not spent 
    });
    //console.log('[BlockDb.js.373:txs:]',txs.length, txs.slice(0,5)); //TODO

    async.eachLimit(txs, CONCURRENCY, function(txout, e_c) {
      if (txout.isConfirmedCached) {
        self._fillConfirmationsOneSpent(txout, height, e_c);
      } else {
        self._fillConfirmationsOne(txout, height, e_c);
      }

    }, cb);
  });
};

BlockDb.prototype.fillVinConfirmations = function(tx, cb) {
  var self = this;
  this.getTip(function(err, hash, height) {
    var vin = tx.vin;
    if (!vin) return cb();

    async.eachLimit(vin, CONCURRENCY, function(v, e_c) {
      tx.confirmedIn = height - tx.confirmations + 1;
      self._fillConfirmationsOneVin(v, height, e_c);
    }, cb);
  });
};


/* this is only for migration scripts */
BlockDb.prototype._runScript = function(script, cb) {
  db.batch(script, cb);
};

BlockDb.prototype.migrateV02 = function(cb) {
  var k = 'txb-';
  var dbScript = [];
  var c = 0;
  var c2 = 0;
  var N = 50000;
  this.txDb._db.createReadStream({
      start: k,
      end: k + '~'
    })
    .on('data', function(data) {
      var k = data.key.split('-');
      var v = data.value.split(':');
      dbScript.push({
        type: 'put',
        key: IN_BLK_PREFIX + k[1],
        value: data.value,
      });
      if (c++ > N) {
        console.log('\t%dM txs processed', ((c2 += N) / 1e6).toFixed(3));
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

BlockDb.prototype.migrateV02cleanup = function(cb) {
  var self = this;
  console.log('## deleting txb- from txs db'); //todo

  var k = 'txb-';
  var d = this.txDb._db;
  d.createReadStream({
      start: k,
      end: k + '~'
    })
    .pipe(d.createWriteStream({
      type: 'del'
    }))
    .on('close', function(err) {
      if (err) return cb(err);
      console.log('## deleting tx- from txs db'); //todo

      var k = 'tx-';
      var d = self.txDb._db;
      d.createReadStream({
          start: k,
          end: k + '~'
        })
        .pipe(d.createWriteStream({
          type: 'del'
        }))
        .on('close', function(err) {
          if (err) return cb(err);
          var k = 'txa-';
          var d = self.txDb._db;
          d.createReadStream({
              start: k,
              end: k + '~'
            })
            .pipe(d.createWriteStream({
              type: 'del'
            }))
            .on('close', cb);
        });
    });
};


module.exports = require('soop')(BlockDb);
