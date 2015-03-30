'use strict';

var imports = require('soop').imports();
var util = require('util');
var async = require('async');

var bitcore = require('bitcore');
var networks = bitcore.networks;
var config = imports.config || require('../config/config');
var Sync = require('./Sync');
var sockets = require('../app/controllers/socket.js');
var BlockExtractor = require('./BlockExtractor.js');
var buffertools = require('buffertools');
var bitcoreUtil = bitcore.util;
var logger = require('./logger').logger;
var info = logger.info;
var error = logger.error;
var PERCENTAGE_TO_START_FROM_RPC = 0.96;

// TODO  TODO TODO
//var PERCENTAGE_TO_START_FROM_RPC = 0.98;

//  var Deserialize = require('bitcore/Deserialize');
var BAD_GEN_ERROR = 'Bad genesis block. Network mismatch between Insight and bitcoind? Insight is configured for:';

var BAD_GEN_ERROR_DB = 'Bad genesis block. Network mismatch between Insight and levelDB? Insight is configured for:';

function HistoricSync(opts) {
  opts = opts || {};
  this.shouldBroadcast = opts.shouldBroadcastSync;

  this.network = config.network === 'testnet' ? networks.testnet : networks.livenet;

  var genesisHashReversed = new Buffer(32);
  this.network.genesisBlock.hash.copy(genesisHashReversed);
  buffertools.reverse(genesisHashReversed);
  this.genesis = genesisHashReversed.toString('hex');

  var bitcore = require('bitcore');

  var RpcClient = bitcore.RpcClient;

  this.rpc = new RpcClient(config.bitcoind);

  this.getBitcoinCoreVersion(function(bitcoinVersion) {
    if (bitcoinVersion > 100000 && !config.forceRPCsync) {
      info('-------------------------------------------------------');
      info('- Bitcoin Core version >0.10 only works with RPC sync -');
      info('- Set the env variable INSIGHT_FORCE_RPC_SYNC = 1     -');
      info('-------------------------------------------------------');
      process.exit(1);
    } else {
      info('Bitcoin Core version ', bitcoinVersion);
      info('Using RPC sync ');
    }
  });


  this.sync = new Sync(opts);
  this.height = 0;
}

HistoricSync.prototype.getBitcoinCoreVersion = function(cb) {
  var self = this;
  self.rpc.getInfo(function(err, info) {
    if (err) {
      error('ERROR ', err);
      process.exit(-1);
    };
    return cb(info.result.version);
  });
};

HistoricSync.prototype.showProgress = function() {
  var self = this;

  if (self.status === 'syncing' &&
    (self.height) % self.step !== 1) return;

  if (self.error)
    error(self.error);

  else {
    self.updatePercentage();
    info(util.format('status: [%d%%]', self.syncPercentage));
  }
  if (self.shouldBroadcast) {
    sockets.broadcastSyncInfo(self.info());
  }
  //
  // if (self.syncPercentage > 10) {
  //   process.exit(-1);
  // }
};


HistoricSync.prototype.setError = function(err) {
  var self = this;
  self.error = err.message ? err.message : err.toString();
  self.status = 'error';
  self.showProgress();
  return err;
};



HistoricSync.prototype.close = function() {
  this.sync.close();
};


HistoricSync.prototype.info = function() {
  this.updatePercentage();
  return {
    status: this.status,
    blockChainHeight: this.blockChainHeight,
    syncPercentage: this.syncPercentage,
    height: this.height,
    syncTipHash: this.sync.tip,
    error: this.error,
    type: this.type,
    startTs: this.startTs,
    endTs: this.endTs,
  };
};

HistoricSync.prototype.updatePercentage = function() {
  var r = this.height / this.blockChainHeight;
  this.syncPercentage = parseFloat(100 * r).toFixed(3);
  if (this.syncPercentage > 100) this.syncPercentage = 100;
};

HistoricSync.prototype.getBlockFromRPC = function(cb) {
  var self = this;

  if (!self.currentRpcHash) return cb();

  var blockInfo;
  self.rpc.getBlock(self.currentRpcHash, function(err, ret) {
    if (err) return cb(err);
    if (ret) {
      blockInfo = ret.result;
      // this is to match block retreived from file
      if (blockInfo.hash === self.genesis)
        blockInfo.previousblockhash =
        self.network.genesisBlock.prev_hash.toString('hex');

      self.currentRpcHash = blockInfo.nextblockhash;
    } else {
      blockInfo = null;
    }
    return cb(null, blockInfo);
  });
};

HistoricSync.prototype.getStandardizedBlock = function(b) {
  var self = this;

  var block = {
    hash: bitcoreUtil.formatHashFull(b.getHash()),
    previousblockhash: bitcoreUtil.formatHashFull(b.prev_hash),
    time: b.timestamp,
  };
  var isCoinBase = 1;
  block.tx = b.txs.map(function(tx) {
    var ret = self.sync.txDb.getStandardizedTx(tx, b.timestamp, isCoinBase);
    isCoinBase = 0;
    return ret;
  });
  return block;
};

HistoricSync.prototype.getBlockFromFile = function(cb) {
  var self = this;

  var blockInfo;

  //get Info
  self.blockExtractor.getNextBlock(function(err, b) {
    if (err || !b) return cb(err);
    blockInfo = self.getStandardizedBlock(b);
    self.sync.bDb.setLastFileIndex(self.blockExtractor.currentFileIndex, function(err) {
      return cb(err, blockInfo);
    });
  });
};

HistoricSync.prototype.updateBlockChainHeight = function(cb) {
  var self = this;

  self.rpc.getBlockCount(function(err, res) {
    self.blockChainHeight = res.result;
    return cb(err);
  });
};


HistoricSync.prototype.checkNetworkSettings = function(next) {
  var self = this;

  self.hasGenesis = false;

  // check network config
  self.rpc.getBlockHash(0, function(err, res) {
    if (!err && (res && res.result !== self.genesis)) {
      err = new Error(BAD_GEN_ERROR + config.network);
    }
    if (err) return next(err);
    self.sync.bDb.has(self.genesis, function(err, b) {
      if (!err && (res && res.result !== self.genesis)) {
        err = new Error(BAD_GEN_ERROR_DB + config.network);
      }
      self.hasGenesis = b ? true : false;
      return next(err);
    });
  });
};

HistoricSync.prototype.updateStartBlock = function(opts, next) {
  var self = this;

  self.startBlock = self.genesis;

  if (opts.startAt) {
    self.sync.bDb.fromHashWithInfo(opts.startAt, function(err, bi) {
      var blockInfo = bi ? bi.info : {};
      if (blockInfo.height) {
        self.startBlock = opts.startAt;
        self.height = blockInfo.height;
        info('Resuming sync from block: %s #%d', opts.startAt, self.height);
        return next(err);
      }
    });
  } else {
    self.sync.bDb.getTip(function(err, tip, height) {
      if (!tip) return next();

      var blockInfo;
      var oldtip;

      //check that the tip is still on the mainchain
      async.doWhilst(
        function(cb) {
          self.sync.bDb.fromHashWithInfo(tip, function(err, bi) {
            blockInfo = bi ? bi.info : {};
            if (oldtip)
              self.sync.bDb.setBlockNotMain(oldtip, cb);
            else
              return cb();
          });
        },
        function(err) {
          if (err) return next(err);
          var ret = false;

          var d = Math.abs(height - blockInfo.height);
          if (d > 6) {
            error('Previous Tip block tip height differs by %d. Please delete and resync (-D)', d);
            process.exit(1);
          }
          if (self.blockChainHeight === blockInfo.height ||
            blockInfo.confirmations > 0) {
            ret = false;
          } else {
            oldtip = tip;
            if (!tip)
              throw new Error('Previous blockchain tip was not found on bitcoind. Please reset Insight DB. Tip was:' + tip)
            tip = blockInfo.previousblockhash;
            info('Previous TIP is now orphan. Back to:' + tip);
            ret = true;
          }
          return ret;
        },
        function(err) {
          self.startBlock = tip;
          self.height = height;
          info('Resuming sync from block: %s #%d', tip, height);
          return next(err);
        }
      );
    });
  }
};

HistoricSync.prototype.prepareFileSync = function(opts, next) {
  var self = this;

  if (config.forceRPCsync) return next();

  if (opts.forceRPC || !config.bitcoind.dataDir ||
    self.height > self.blockChainHeight * PERCENTAGE_TO_START_FROM_RPC) return next();


  try {
    self.blockExtractor = new BlockExtractor(config.bitcoind.dataDir, config.network);
  } catch (e) {
    info(e.message + '. Disabling file sync.');
    return next();
  }

  self.getFn = self.getBlockFromFile;
  self.allowReorgs = true;
  self.sync.bDb.getLastFileIndex(function(err, idx) {

    if (opts.forceStartFile)
      self.blockExtractor.currentFileIndex = opts.forceStartFile;
    else if (idx) self.blockExtractor.currentFileIndex = idx;

    var h = self.genesis;

    info('Seeking file to:' + self.startBlock);
    //forward till startBlock
    async.whilst(
      function() {
        return h !== self.startBlock;
      },
      function(w_cb) {
        self.getBlockFromFile(function(err, b) {
          if (!b) return w_cb('Could not find block ' + self.startBlock);
          h = b.hash;
          setImmediate(function() {
            return w_cb(err);
          });
        });
      }, function(err) {
        console.log('\tFOUND Starting Block!');

        // TODO SET HEIGHT
        return next(err);
      });
  });
};

//NOP
HistoricSync.prototype.prepareRpcSync = function(opts, next) {
  var self = this;

  if (self.blockExtractor) return next();
  self.getFn = self.getBlockFromRPC;
  self.allowReorgs = true;
  self.currentRpcHash = self.startBlock;
  return next();
};

HistoricSync.prototype.showSyncStartMessage = function() {
  var self = this;

  info('Got ' + self.height +
    ' blocks in current DB, out of ' + self.blockChainHeight + ' block at bitcoind');

  if (self.blockExtractor) {
    info('bitcoind dataDir configured...importing blocks from .dat files');
    info('First file index: ' + self.blockExtractor.currentFileIndex);
  } else {
    info('syncing from RPC (slow)');
  }

  info('Starting from: ', self.startBlock);
  self.showProgress();
};


HistoricSync.prototype.setupSyncStatus = function() {
  var self = this;

  var step = parseInt((self.blockChainHeight - self.height) / 1000);
  if (step < 10) step = 10;

  self.step = step;
  self.type = self.blockExtractor ? 'from .dat Files' : 'from RPC calls';
  self.status = 'syncing';
  self.startTs = Date.now();
  self.endTs = null;
  this.error = null;
  this.syncPercentage = 0;
};

HistoricSync.prototype.checkDBVersion = function(cb) {
  this.sync.txDb.checkVersion02(function(isOk) {
    if (!isOk) {
      console.log('\n#############################\n\n ## Insight API DB is older that v0.2. Please resync using:\n $ util/sync.js -D\n More information at Insight API\'s Readme.md');
      process.exit(1);
    }
    // Add more test here in future changes.
    return cb();
  });
};


HistoricSync.prototype.prepareToSync = function(opts, next) {
  var self = this;

  self.status = 'starting';
  async.series([

      function(s_c) {
        self.checkDBVersion(s_c);
      },
      function(s_c) {
        self.checkNetworkSettings(s_c);
      },
      function(s_c) {
        self.updateBlockChainHeight(s_c);
      },
      function(s_c) {
        self.updateStartBlock(opts, s_c);
      },
      function(s_c) {
        self.prepareFileSync(opts, s_c);
      },
      function(s_c) {
        self.prepareRpcSync(opts, s_c);
      },
    ],
    function(err) {
      if (err) return (self.setError(err));

      self.showSyncStartMessage();
      self.setupSyncStatus();
      return next();
    });
};


HistoricSync.prototype.start = function(opts, next) {
  var self = this;

  if (self.status === 'starting' || self.status === 'syncing') {
    error('## Wont start to sync while status is %s', self.status);
    return next();
  }

  self.prepareToSync(opts, function(err) {
    if (err) return next(self.setError(err));

    async.whilst(
      function() {
        self.showProgress();
        return self.status === 'syncing';
      },
      function(w_cb) {
        self.getFn(function(err, blockInfo) {
          if (err) return w_cb(self.setError(err));

          if (blockInfo && blockInfo.hash && (!opts.stopAt || opts.stopAt !== blockInfo.hash)) {
            self.sync.storeTipBlock(blockInfo, self.allowReorgs, function(err, height) {
              if (err) return w_cb(self.setError(err));
              if (height >= 0) self.height = height;
              setImmediate(function() {
                return w_cb(err);
              });
            });
          } else {
            self.endTs = Date.now();
            self.status = 'finished';
            var info = self.info();
            logger.debug('Done Syncing blockchain', info.type, 'to height', info.height);
            return w_cb(err);
          }
        });
      }, next);
  });
};

module.exports = require('soop')(HistoricSync);
