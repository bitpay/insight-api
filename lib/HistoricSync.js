'use strict';

var imports        = require('soop').imports();
var util           = require('util');
var assert         = require('assert');
var async          = require('async');

var bitcore        = require('bitcore');
var RpcClient      = bitcore.RpcClient;
var Script         = bitcore.Script;
var networks       = bitcore.networks;
var config         = imports.config || require('../config/config');
var Sync           = require('./Sync');
var sockets        = require('../app/controllers/socket.js');
var BlockExtractor = require('./BlockExtractor.js');
var buffertools    = require('buffertools');
var bitcoreUtil    = bitcore.util;
var Bignum         = bitcore.Bignum;
var Script       = bitcore.Script;
// This is 0.1.2 = > c++ version of base58-native
 var base58       = require('base58-native').base58Check;
 var encodedData  = require('soop').load('bitcore/util/EncodedData',{
   base58: base58
 });
 var versionedData= require('soop').load('bitcore/util/VersionedData',{
   parent: encodedData
 });

var Address = require('soop').load('bitcore/lib/Address',{
  parent: versionedData
});

var logger = require('./logger').logger;
var d      = logger.log;
var info   = logger.info;
var error  = logger.error;

//  var Deserialize = require('bitcore/Deserialize');
var BAD_GEN_ERROR = 'Bad genesis block. Network mismatch between Insight and bitcoind? Insight is configured for:';

var BAD_GEN_ERROR_DB = 'Bad genesis block. Network mismatch between Insight and levelDB? Insight is configured for:';
function HistoricSync(opts) {
  opts = opts || {};
  this.shouldBroadcast = opts.shouldBroadcastSync;

  this.network = config.network === 'testnet' ? networks.testnet: networks.livenet;

  var genesisHashReversed = new Buffer(32);
  this.network.genesisBlock.hash.copy(genesisHashReversed);
  buffertools.reverse(genesisHashReversed);
  this.genesis = genesisHashReversed.toString('hex');

	var bitcore        = require('bitcore');
	var RpcClient      = bitcore.RpcClient;

  this.rpc = new RpcClient(config.bitcoind);
  this.sync = new Sync(opts);
}

HistoricSync.prototype.showProgress = function() {
  var self = this;

  if ( self.status ==='syncing' &&
      ( self.syncedBlocks )  % self.step !== 1)  return;

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
  self.error = err.message?err.message:err.toString();
  self.status='error';
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
    syncedBlocks: this.syncedBlocks,
    syncTipHash: this.sync.tip,
    error: this.error,
    type: this.type,
    startTs: this.startTs,
    endTs: this.endTs,
  };
};

HistoricSync.prototype.updatePercentage = function() {
  var r = this.syncedBlocks  / this.blockChainHeight;
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
    }
    else {
      blockInfo = null;
    }
    return cb(null, blockInfo);
  });
};

HistoricSync.prototype._fromBuffer = function (buf) {
    var buf2 = buffertools.reverse(buf);
    return parseInt(buf2.toString('hex'), 16);
};

HistoricSync.prototype.getStandardizedTx = function (tx, time) {
  var self = this;
  tx.txid = bitcoreUtil.formatHashFull(tx.getHash());
  var ti=0;
  tx.vin = tx.ins.map(function(txin) {
    var ret = {n: ti++};
    if (txin.isCoinBase()) {
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
        val = {addresses: [addrs[0].toString() ] };
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

HistoricSync.prototype.getStandardizedBlock = function(b) {
  var self = this;

  var block = {
    hash: bitcoreUtil.formatHashFull(b.getHash()),
    previousblockhash: bitcoreUtil.formatHashFull(b.prev_hash),
    time: b.timestamp,
  };
  block.tx = b.txs.map(function(tx){
    return self.getStandardizedTx(tx, b.timestamp);
  });
  return block;
};

HistoricSync.prototype.getBlockFromFile = function(cb) {
  var self = this;

  var blockInfo;

  //get Info
  self.blockExtractor.getNextBlock(function(err, b) {
    if (err || ! b) return cb(err);
    blockInfo = self.getStandardizedBlock(b);
    self.sync.bDb.setLastFileIndex(self.blockExtractor.currentFileIndex, function(err) {
      return cb(err,blockInfo);
    });
  });
};

HistoricSync.prototype.updateConnectedCountDB = function(cb) {
  var self = this;
  self.sync.bDb.countConnected(function(err, count) {
    self.connectedCountDB = count  || 0;
    self.syncedBlocks     =  count || 0;
    return cb(err);
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
  self.rpc.getBlockHash(0, function(err, res){
    if (!err && ( res && res.result !== self.genesis)) {
      err = new Error(BAD_GEN_ERROR + config.network);
    }
    if (err) return next(err);
    self.sync.bDb.has(self.genesis, function(err, b) {
      if (!err && ( res && res.result !== self.genesis)) {
        err = new Error(BAD_GEN_ERROR_DB + config.network);
      }
      self.hasGenesis = b?true:false;
      return next(err);
    });
  });
};

HistoricSync.prototype.updateStartBlock = function(next) {
  var self = this;

  self.startBlock = self.genesis;

  self.sync.bDb.getTip(function(err,tip) {
    if (!tip) return next();

    var blockInfo;
    var oldtip;

    //check that the tip is still on the mainchain
    async.doWhilst(
      function(cb) {
        self.sync.bDb.fromHashWithInfo(tip, function(err, bi) {
          blockInfo = bi ? bi.info : {};
          if (oldtip)
            self.sync.setBlockHeight(oldtip, -1, cb);
          else
            return cb();
        });
      },
      function(err) {
        if (err) return next(err);
        var ret = false;
        if ( self.blockChainHeight  === blockInfo.height ||
            blockInfo.confirmations > 0) {
          ret = false;
        }
        else {
          oldtip = tip;
          if (!tip)
            throw new Error('Previous blockchain tip was not found on bitcoind. Please reset Insight DB. Tip was:'+tip)

          tip = blockInfo.previousblockhash;
          info('Previous TIP is now orphan. Back to:' + tip);
          ret  = true;
        }
        return ret;
      },
      function(err) {
        self.startBlock = tip;
        info('Resuming sync from block:'+tip);
        return next(err);
      }
    );
  });
};

HistoricSync.prototype.prepareFileSync = function(opts, next) {
  var self = this;

  if ( opts.forceRPC || !config.bitcoind.dataDir ||
    self.connectedCountDB > self.blockChainHeight * 0.9) return next();


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
      function (w_cb) {
        self.getBlockFromFile(function(err,b) {
          if (!b) return w_cb('Could not find block ' + self.startBlock);
          h=b.hash;
          setImmediate(function(){
            return w_cb(err);
          });
        });
      }, next);
  });
};

//NOP
HistoricSync.prototype.prepareRpcSync = function(opts, next) {
  var self = this;

  if (self.blockExtractor) return next();
  self.getFn = self.getBlockFromRPC;
  self.allowReorgs = true;
  self.currentRpcHash  = self.startBlock;
  return next();
};

HistoricSync.prototype.showSyncStartMessage = function() {
  var self = this;

  info('Got ' + self.connectedCountDB +
    ' blocks in current DB, out of ' + self.blockChainHeight + ' block at bitcoind');

  if (self.blockExtractor) {
    info('bitcoind dataDir configured...importing blocks from .dat files');
    info('First file index: ' + self.blockExtractor.currentFileIndex);
  }
  else {
    info('syncing from RPC (slow)');
  }

  info('Starting from: ', self.startBlock);
  self.showProgress();
};


HistoricSync.prototype.setupSyncStatus = function() {
  var self = this;

  var step = parseInt( (self.blockChainHeight - self.syncedBlocks) / 1000);
  if (step < 10) step = 10;

  self.step = step;
  self.type   = self.blockExtractor?'from .dat Files':'from RPC calls';
  self.status = 'syncing';
  self.startTs = Date.now();
  self.endTs   = null;
  this.error  = null;
  this.syncPercentage = 0;
};

HistoricSync.prototype.prepareToSync = function(opts, next) {
  var self = this;

  self.status = 'starting';
  async.series([
    function(s_c) {
      self.checkNetworkSettings(s_c);
    },
    function(s_c) {
      self.updateConnectedCountDB(s_c);
    },
    function(s_c) {
      self.updateBlockChainHeight(s_c);
    },
    function(s_c) {
      self.updateStartBlock(s_c);
    },
    function(s_c) {
      self.prepareFileSync(opts, s_c);
    },
    function(s_c) {
      self.prepareRpcSync(opts, s_c);
    },
  ],
  function(err) {
    if (err)  return(self.setError(err));

    self.showSyncStartMessage();
    self.setupSyncStatus();
    return next();
  });
};

      
HistoricSync.prototype.start = function(opts, next) {
  var self = this;

  if (self.status==='starting' || self.status==='syncing') {
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
      function (w_cb) {
        self.getFn(function(err,blockInfo) {
          if (err) return w_cb(self.setError(err));
          if (blockInfo && blockInfo.hash
              && (!opts.stopAt  || opts.stopAt !== blockInfo.hash)
             ) {
            self.syncedBlocks++;
            self.sync.storeTipBlock(blockInfo, self.allowReorgs, function(err) {
              if (err) return w_cb(self.setError(err));
              setImmediate(function(){
                return w_cb(err);
              });
            });
          }
          else {
            self.endTs = Date.now();
            self.status = 'finished';
            console.log('Done Syncing', self.info());
            return w_cb(err);
          }
        });
      }, next);
  });
};

module.exports = require('soop')(HistoricSync);
