'use strict';

var common = require('./common');
var async = require('async');
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

function BlockController(node) {
  this.node = node;
}

var BLOCK_LIMIT = 200;

/**
 * Find block by hash ...
 */
BlockController.prototype.block = function(req, res, next, hash) {
  var self = this;

  this.node.getBlock(hash, function(err, block) {
    if(err && err.message === 'Block not found.') {
      // TODO libbitcoind should pass an instance of errors.Block.NotFound
      return common.handleErrors(null, res);
    } else if(err) {
      return common.handleErrors(err, res);
    }

    var info = self.node.services.bitcoind.getBlockIndex(hash);

    req.block = self.transformBlock(block, info);
    next();
  });
};

BlockController.prototype.transformBlock = function(block, info) {
  var blockObj = block.toObject();
  var transactionIds = blockObj.transactions.map(function(tx) {
    return tx.hash
  });
  return {
    hash: block.hash,
    confirmations: this.node.services.db.tip.__height - info.height + 1,
    size: block.toBuffer().length,
    height: info.height,
    version: blockObj.header.version,
    merkleroot: blockObj.header.merkleRoot,
    tx: transactionIds,
    time: blockObj.header.time,
    nonce: blockObj.header.nonce,
    bits: blockObj.header.bits.toString(16),
    difficulty: 0, // placeholder
    chainwork: info.chainWork,
    previousblockhash: blockObj.header.prevHash,
    nextblockhash: null, // placeholder
    reward: 0, // First output of first transaction gives us the reward + fees. How to isolate just reward?
    isMainChain: true // placeholder
  }
};

/**
 * Show block
 */
BlockController.prototype.show = function(req, res) {
  if (req.block) {
    res.jsonp(req.block);
  }
};

BlockController.prototype.blockIndex = function(req, res, next, height) {
  var info = this.node.services.bitcoind.getBlockIndex(parseInt(height));
  if(!info) {
    return common.handleErrors(null, res);
  }

  res.jsonp({
    blockHash: info.hash
  });
};

// List blocks by date
BlockController.prototype.list = function(req, res) {
  var self = this;

  // TODO actually get blocks by date instead of just the last blocks
  // TODO pagination

  var limit = parseInt(req.query.limit || BLOCK_LIMIT);

  var blocks = [];
  var lastHash = this.node.services.db.tip.hash;

  async.timesSeries(limit, function(n, next) {
    self.node.getBlock(lastHash, function(err, block) {
      if(err) {
        return next(err);
      }

      var info = self.node.services.bitcoind.getBlockIndex(block.hash);
      block.__height = info.height;
      blocks.push(block);
      lastHash = BufferUtil.reverse(block.header.prevHash).toString('hex');
      next();
    });
  }, function(err) {
    if(err) {
      return common.handleErrors(err, res);
    }

    var data = {
      blocks: blocks.map(function(block) {
        return {
          height: block.__height,
          size: block.toBuffer().length,
          hash: block.hash,
          time: block.header.time,
          txlength: block.transactions.length,
          poolInfo: {}
        };
      }),
      length: blocks.length,
      pagination: {}
    };

    res.jsonp(data);
  });
};

module.exports = BlockController;