'use strict';
var imports           = require('soop').imports();
var ThisParent        = imports.parent || require('events').EventEmitter;
var TIMESTAMP_PREFIX  = 'bts-';     // bts-<ts> => <hash>
var PREV_PREFIX       = 'bpr-';     // bpr-<hash> => <prev_hash> 
var NEXT_PREFIX       = 'bne-';     // bne-<hash> => <next_hash> 
var MAIN_PREFIX       = 'bma-';     // bma-<hash> =>    <height> (0 is unconnected)
var TIP               = 'bti-';     // bti = <hash>:<height> last block on the chain
var LAST_FILE_INDEX   = 'file-';     // last processed file index

var MAX_OPEN_FILES    = 500;

/**
* Module dependencies.
*/
var levelup     = require('levelup'),
    config      = require('../config/config');
var db  = imports.db || levelup(config.leveldb + '/blocks',{maxOpenFiles: MAX_OPEN_FILES} );
var Rpc = imports.rpc || require('./Rpc');

var tDb = require('./TransactionDb.js').default();

var BlockDb = function() {
  BlockDb.super(this, arguments);
};
BlockDb.parent = ThisParent;

BlockDb.prototype.close = function(cb) {
  db.close(cb);
};

BlockDb.prototype.drop = function(cb) {
  var path = config.leveldb + '/blocks';
  db.close(function() {
    require('leveldown').destroy(path, function () {
      db = levelup(path,{maxOpenFiles: MAX_OPEN_FILES} );
      return cb();
    });
  });
};

// adds a block. Does not update Next pointer in 
// the block prev to the new block, nor TIP pointer
//
BlockDb.prototype.add = function(b, height, cb) {
  var self = this;
  var time_key = TIMESTAMP_PREFIX +
    ( b.time || Math.round(new Date().getTime() / 1000) );

  return db.batch()
    .put(time_key, b.hash)
    .put(MAIN_PREFIX + b.hash, height)
    .put(PREV_PREFIX + b.hash, b.previousblockhash)
    .write(function(err){
      if (!err) {
        self.emit('new_block', {blockid: b.hash});
      }
      cb(err);
    });
};

BlockDb.prototype.getTip = function(cb) {
  db.get(TIP, function(err, val) {
    if (!val) return cb();

    var v = val.split(':');
    return cb(err,v[0], parseInt(v[1]));
  });
};

BlockDb.prototype.setTip = function(hash, height, cb) {
console.log('[BlockDb.js.75] TIP', hash, height); //TODO
  db.put(TIP, hash + ':' + height, function(err) {
    return cb(err);
  });
};

//mainly for testing
BlockDb.prototype.setPrev = function(hash, prevHash, cb) {
  db.put(PREV_PREFIX + hash, prevHash, function(err) {
    return cb(err);
  });
};

BlockDb.prototype.getPrev = function(hash, cb) {
  db.get(PREV_PREFIX + hash, function(err,val) {
    if (err && err.notFound) { err = null; val = null;}
    return cb(err,val);
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
  db.get(LAST_FILE_INDEX, function(err,val) {
    if (err && err.notFound) { err = null; val = null;}
    return cb(err,val);
  });
};

BlockDb.prototype.getNext = function(hash, cb) {
  db.get(NEXT_PREFIX + hash, function(err,val) {
    if (err && err.notFound) { err = null; val = null;}
    return cb(err,val);
  });
};

BlockDb.prototype.getHeight = function(hash, cb) {
  db.get(MAIN_PREFIX + hash, function(err, val) {
    if (err && err.notFound) { err = null; val = 0;}
    return cb(err,parseInt(val));
  });
};

BlockDb.prototype.setHeight = function(hash, height, cb) {
  if (!height) console.log('\tNew orphan: %s',hash);
  db.put(MAIN_PREFIX + hash, height, function(err) {
    return cb(err);
  });
};

BlockDb.prototype.setNext = function(hash, nextHash, cb) {
  db.put(NEXT_PREFIX + hash, nextHash, function(err) {
    return cb(err);
  });
};

BlockDb.prototype.countConnected = function(cb) {
  var c = 0;
  console.log('Counting connected blocks. This could take some minutes');
  db.createReadStream({start: MAIN_PREFIX, end: MAIN_PREFIX + '~' })
    .on('data', function (data) {
      if (data.value !== 0) c++;
    })
    .on('error', function (err) {
      return cb(err);
    })
    .on('end', function () {
      return cb(null, c);
    });
};

// .has() return true orphans also
BlockDb.prototype.has = function(hash, cb) {
  var k = PREV_PREFIX + hash;
  db.get(k, function (err) {
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

      info.isMainChain = height ? true : false;

      return cb(null, {
        hash: hash,
        info: info,
      });
    });
  });
};

BlockDb.prototype.getBlocksByDate = function(start_ts, end_ts, cb) {
  var list = [];
  db.createReadStream({
    start: TIMESTAMP_PREFIX + start_ts,
    end: TIMESTAMP_PREFIX + end_ts,
    fillCache: true
    })
    .on('data', function (data) {
      var k = data.key.split('-');
      list.push({
        ts: k[1],
        hash: data.value,
      });
    })
    .on('error', function (err) {
      return cb(err);
    })
    .on('end', function () {
      return cb(null, list.reverse());
    });
};

BlockDb.prototype.blockIndex = function(height, cb) {
  return Rpc.blockIndex(height,cb);
};

module.exports = require('soop')(BlockDb);
