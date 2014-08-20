'use strict';

var imports       = require('soop').imports();

var config        = imports.config || require('../config/config');
var bitcore       = require('bitcore');
var networks      = bitcore.networks;
var async         = require('async');

var logger = require('./logger').logger;
var d      = logger.log;
var info   = logger.info;



var syncId = 0;

function Sync(opts) {
  this.id = syncId++;
  this.opts = opts || {};
  this.bDb = require('./BlockDb').default();
  this.txDb =  require('./TransactionDb').default();
  this.network = config.network === 'testnet' ? networks.testnet : networks.livenet;
  this.cachedLastHash = null;
}

Sync.prototype.close = function(cb) {
  var self = this;
  self.txDb.close(function() {
    self.bDb.close(cb);
  });
};


Sync.prototype.destroy = function(next) {
  var self = this;
  async.series([

    function(b) {
      self.bDb.drop(b);
    },
    function(b) {
      self.txDb.drop(b);
    },
  ], next);
};

/*
  * Arrives a NEW block, which is the new TIP
  *
  * Case 0) Simple case
  *    A-B-C-D-E(TIP)-NEW
  *
  * Case 1)
  *    A-B-C-D-E(TIP)
  *        \
  *         NEW
  *
  *  1) Declare D-E orphans (and possible invalidate TXs on them)
  *
  * Case 2)
  *    A-B-C-D-E(TIP)
  *        \
  *         F-G-NEW
  *  1) Set F-G as connected (mark TXs as valid)
  *  2) Set new heights  in F-G-NEW 
  *  3) Declare D-E orphans (and possible invalidate TXs on them)
  *
  *
  * Case 3)
  *
  *    A-B-C-D-E(TIP) ...  NEW
  *
  *    NEW is ignored (if allowReorgs is false)
  *
  *
  */

Sync.prototype.storeTipBlock = function(b, allowReorgs, cb) {

  if (typeof allowReorgs === 'function') {
    cb = allowReorgs;
    allowReorgs = true;
  }
  if (!b) return cb();
  var self = this;

  if ( self.storingBlock ) {
    logger.debug('Storing a block already. Delaying storeTipBlock with:' +
                b.hash);
    return setTimeout( function() {
      logger.debug('Retrying storeTipBlock with: ' + b.hash);
      self.storeTipBlock(b,allowReorgs,cb);
    }, 1000);
  }

  self.storingBlock=1;
  var oldTip, oldNext, oldHeight, needReorg = false, height = -1;
  var newPrev = b.previousblockhash;
  async.series([

      // This seems unnecesary.
      // function(c) {
      //   // TODO? remove this check?
      //   self.bDb.has(b.hash, function(err, val) {
      //     return c(err ||
      //       (val ? new Error('WARN: Ignoring already existing block:' + b.hash) : null));
      //   });
      // },
      function(c) {
        if (!allowReorgs || newPrev === self.cachedLastHash) return c();
        self.bDb.has(newPrev, function(err, val) {
          // Genesis? no problem
          if (!val && newPrev.match(/^0+$/)) return c();
          return c(err ||
            (!val ? new Error('NEED_SYNC Ignoring block with non existing prev:' + b.hash) : null));
        });
      },
      function(c) {
        if (!allowReorgs) return c();
        self.bDb.getTip(function(err, hash, h) {
          oldTip = hash;
          oldHeight = hash ? (h || 0) : -1
          if (oldTip && newPrev !== oldTip) {
            needReorg = true;
            logger.debug('REORG Triggered, tip mismatch');
          }
          return c();
        });
      },

      function(c) {
        if (!needReorg) return c();
        self.bDb.getNext(newPrev, function(err, val) {
          if (err) return c(err);
          oldNext = val;
          return c();
        });
      },
     function(c) {
        if (!allowReorgs) return c();
        if (needReorg) {
          info('NEW TIP: %s NEED REORG (old tip: %s #%d)', b.hash, oldTip, oldHeight);
          self.processReorg(oldTip, oldNext, newPrev, oldHeight, function(err, h) {
            if (err) throw err;

            height = h;
            return c();
          });
        }
        else {
          height = oldHeight + 1;
          return c();
        }
      },
      function(c) {
        self.cachedLastHash = b.hash;   // just for speed up.
        self.bDb.add(b, height, c);
      },
      function(c) {
        if (!allowReorgs) return c();
        self.bDb.setTip(b.hash, height, function(err) {
          return c(err);
        });
      },
      function(c) {
        self.bDb.setNext(newPrev, b.hash, function(err) {
          return c(err);
        });
      }

    ],
    function(err) {
      if (err && err.toString().match(/WARN/)) {
        err = null;
      }
      self.storingBlock=0;
      return cb(err, height);
    });
};

Sync.prototype.processReorg = function(oldTip, oldNext, newPrev, oldHeight, cb) {
  var self = this;

  var orphanizeFrom, newHeight;

  async.series([

      function(c) {
        self.bDb.getHeight(newPrev, function(err, height) {
          if (!height) {
            // Case 3 + allowReorgs = true
            return c(new Error('Could not found block:' + newPrev));
          }
          if (height<0) return c();

          newHeight = height + 1;
          info('Reorg Case 1) OldNext: %s NewHeight: %d', oldNext, newHeight);
          orphanizeFrom = oldNext;
          return c(err);
        });
      },
      function(c) {
        if (orphanizeFrom) return c();

        info('Reorg Case 2)');
        self.setBranchConnectedBackwards(newPrev, function(err, yHash, newYHashNext, height) {
          if (err) return c(err);
          newHeight = height;
          self.bDb.getNext(yHash, function(err, yHashNext) {
            // Connect the new branch, and orphanize the old one.
            orphanizeFrom = yHashNext;
            self.bDb.setNext(yHash, newYHashNext, function(err) {
              return c(err);
            });
          });
        });
      },
      function(c) {
        if (!orphanizeFrom) return c();
        self._setBranchOrphan(orphanizeFrom, function(err) {
          return c(err);
        });
      },
    ],
    function(err) {
      return cb(err, newHeight);
    });
};

Sync.prototype._setBranchOrphan = function(fromHash, cb) {
  var self = this,
    hashInterator = fromHash;

  async.whilst(
    function() {
      return hashInterator;
    },
    function(c) {
      self.bDb.setBlockNotMain(hashInterator, function(err) {
        if (err) return cb(err);
        self.bDb.getNext(hashInterator, function(err, val) {
          hashInterator = val;
          return c(err);
        });
      });
    }, cb);
};

Sync.prototype.setBranchConnectedBackwards = function(fromHash, cb) {
  //console.log('[Sync.js.219:setBranchConnectedBackwards:]',fromHash); //TODO
  var self = this,
    hashInterator = fromHash,
    lastHash = fromHash,
    yHeight,
    branch = [];

  async.doWhilst(
    function(c) {
      branch.unshift(hashInterator);

      self.bDb.getPrev(hashInterator, function(err, val) {
        if (err) return c(err);
        lastHash = hashInterator;
        hashInterator = val;
        self.bDb.getHeight(hashInterator, function(err, height) {
          yHeight = height;
          return c();
        });
      });
    },
    function() {
      return hashInterator && yHeight<=0;
    },
    function() {
      info('\tFound yBlock: %s #%d', hashInterator, yHeight);
      var heightIter = yHeight + 1;
      var hashIter;
      async.whilst(
        function() {
          hashIter = branch.shift();
          return hashIter;
        },
        function(c) {
          self.bDb.setBlockMain(hashIter, heightIter++, c);
        },
        function(err) {
          return cb(err, hashInterator, lastHash, heightIter);
      });
    });
};


//Store unconfirmed TXs
Sync.prototype.storeTx = function(tx, cb) {
  this.txDb.add(tx, cb);
};


module.exports = require('soop')(Sync);
