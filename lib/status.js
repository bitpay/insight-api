'use strict';

function StatusController(node) {
  this.node = node;
}

StatusController.prototype.show = function(req, res) {

  var option = req.query.q;

  switch(option) {
    case 'getDifficulty':
      res.jsonp(this.getDifficulty());
      break;
    case 'getTxOutSetInfo':
      res.jsonp(this.getTxOutSetInfo());
      break;
    case 'getLastBlockHash':
      res.jsonp(this.getLastBlockHash());
      break;
    case 'getBestBlockHash':
      res.jsonp(this.getBestBlockHash());
      break;
    case 'getInfo':
    default:
      res.jsonp(this.getInfo());
  }
};

StatusController.prototype.getInfo = function() {
  var info = this.node.services.bitcoind.getInfo();
  return {
    info: info
  };
};

StatusController.prototype.getTxOutSetInfo = function() {
  var hash = this.node.services.bitcoind.getBestBlockHash();
  if (hash === this.lastTxOutSetInfo) {
    return {
      txoutsetinfo: this.txOutSetInfo
    };
  }
  this.txOutSetInfo = this.node.services.bitcoind.getTxOutSetInfo();
  this.lastTxOutSetInfo = this.txOutSetInfo.bestblock;
  return {
    txoutsetinfo: this.txOutSetInfo
  };
};

StatusController.prototype.getLastBlockHash = function() {
  var hash = this.node.services.db.tip.hash;
  return {
    syncTipHash: hash,
    lastblockhash: hash
  };
};

StatusController.prototype.getBestBlockHash = function() {
  var hash = this.node.services.bitcoind.getBestBlockHash();
  return {
    bestblockhash: hash
  };
};

StatusController.prototype.getDifficulty = function() {
  var info = this.node.services.bitcoind.getInfo();
  return {
    difficulty: info.difficulty
  };
};

StatusController.prototype.sync = function(req, res) {
  var status = 'syncing';
  if(this.node.services.bitcoind.isSynced() && this.node.services.db.tip.__height === this.node.services.bitcoind.height) {
    status = 'finished';
  }

  var info = {
    status: status,
    blockChainHeight: this.node.services.bitcoind.height,
    syncPercentage: this.node.services.db.tip.__height / this.node.services.bitcoind.height * 100,
    height: this.node.services.db.tip.__height,
    error: null,
    type: 'bitcore node'
  };

  res.jsonp(info);
};

// Hard coded to make insight ui happy, but not applicable
StatusController.prototype.peer = function(req, res) {
  res.jsonp({
    connected: true,
    host: '127.0.0.1',
    port: null
  });
};

StatusController.prototype.version = function(req, res) {
  var pjson = require('../package.json');
  res.jsonp({
    version: pjson.version
  });
};

module.exports = StatusController;
