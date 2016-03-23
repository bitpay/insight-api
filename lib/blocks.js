'use strict';

var common = require('./common');
var async = require('async');
var bitcore = require('bitcore-lib');
var pools = require('../pools.json');
var BN = bitcore.crypto.BN;

function BlockController(node) {
  var self = this;
  this.node = node;

  this.poolStrings = {};
  pools.forEach(function(pool) {
    pool.searchStrings.forEach(function(s) {
      self.poolStrings[s] = {
        poolName: pool.poolName,
        url: pool.url
      };
    });
  });
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

    self.node.services.bitcoind.getBlockHeader(hash, function(err, info) {
      if (err) {
        return common.handleErrors(err, res);
      }
      req.block = self.transformBlock(block, info);
      next();
    });

  });
};

BlockController.prototype.transformBlock = function(block, info) {
  var blockObj = block.toObject();
  var transactionIds = blockObj.transactions.map(function(tx) {
    return tx.hash;
  });
  return {
    hash: block.hash,
    confirmations: this.node.services.bitcoind.height - info.height + 1,
    size: block.toBuffer().length,
    height: info.height,
    version: blockObj.header.version,
    merkleroot: blockObj.header.merkleRoot,
    tx: transactionIds,
    time: blockObj.header.time,
    nonce: blockObj.header.nonce,
    bits: blockObj.header.bits.toString(16),
    difficulty: block.header.getDifficulty(),
    chainwork: info.chainwork,
    previousblockhash: blockObj.header.prevHash,
    nextblockhash: info.nextblockhash,
    reward: this.getBlockReward(info.height) / 1e8,
    isMainChain: (info.confirmations !== -1),
    poolInfo: this.getPoolInfo(block)
  };
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
  this.node.services.bitcoind.getBlockHeader(parseInt(height), function(err, info) {
    if (err) {
      return common.handleErrors(err, res);
    }
    res.jsonp({
      blockHash: info.hash
    });
  });
};

// List blocks by date
BlockController.prototype.list = function(req, res) {
  var self = this;

  var dateStr;
  var todayStr = this.formatTimestamp(new Date());
  var isToday;

  if (req.query.blockDate) {
    dateStr = req.query.blockDate;
    var datePattern = /\d{4}-\d{2}-\d{2}/;
    if(!datePattern.test(dateStr)) {
      return common.handleErrors(new Error('Please use yyyy-mm-dd format'), res);
    }

    isToday = dateStr === todayStr;
  } else {
    dateStr = todayStr;
    isToday = true;
  }

  var gte = Math.round((new Date(dateStr)).getTime() / 1000);

  //pagination
  var lte = parseInt(req.query.startTimestamp) || gte + 86400;
  var prev = this.formatTimestamp(new Date((gte - 86400) * 1000));
  var next = lte ? this.formatTimestamp(new Date(lte * 1000)) : null;
  var limit = parseInt(req.query.limit || BLOCK_LIMIT);
  var more = false;
  var moreTs = lte;

  self.node.services.bitcoind.getBlockHashesByTimestamp(lte, gte, function(err, hashes) {
    if(err) {
      return common.handleErrors(err, res);
    }

    if(hashes.length > limit) {
      more = true;
      hashes = hashes.slice(0, limit);
    }

    async.mapSeries(
      hashes,
      function(hash, next) {
        self.node.services.bitcoind.getBlock(hash, function(err, blockBuffer) {
          if(err) {
            return next(err);
          }

          var br = new bitcore.encoding.BufferReader(blockBuffer);
          // take a shortcut to get number of transactions and the blocksize.
          // Also reads the coinbase transaction and only that.
          // Old code parsed all transactions in every block _and_ then encoded
          // them all back together to get the binary size of the block.
          // FIXME: This code might still read the whole block. Fixing that
          // would require changes in bitcore-node.
          var header = bitcore.BlockHeader.fromBufferReader(br);
          var info = {};
          var txlength = br.readVarintNum();
          info.transactions = [bitcore.Transaction().fromBufferReader(br)];

          self.node.services.bitcoind.getBlockHeader(hash, function(err, blockHeader) {

            var block = {
              height: blockHeader.height,
              size: blockBuffer.length,
              hash: hash,
              time: header.time,
              txlength: txlength,
              poolInfo: self.getPoolInfo(info)
            };

            if(moreTs > header.timestamp) {
              moreTs = header.timestamp;
            }

            return next(null, block);
          });
        });
      },
      function(err, blocks) {
        if(err) {
          return common.handleErrors(err, res);
        }

        blocks.sort(function(a, b) {
          return b.height - a.height;
        });

        var data = {
          blocks: blocks,
          length: blocks.length,
          pagination: {
            next: next,
            prev: prev,
            currentTs: lte - 1,
            current: dateStr,
            isToday: isToday,
            more: more
          }
        };

        if(more) {
          data.pagination.moreTs = moreTs;
        }

        res.jsonp(data);
      }
    );
  });
};

BlockController.prototype.getPoolInfo = function(block) {
  var coinbaseBuffer = block.transactions[0].inputs[0]._scriptBuffer;

  for(var k in this.poolStrings) {
    if (coinbaseBuffer.toString('utf-8').match(k)) {
      return this.poolStrings[k];
    }
  }

  return {};
};

//helper to convert timestamps to yyyy-mm-dd format
BlockController.prototype.formatTimestamp = function(date) {
  var yyyy = date.getUTCFullYear().toString();
  var mm = (date.getUTCMonth() + 1).toString(); // getMonth() is zero-based
  var dd = date.getUTCDate().toString();

  return yyyy + '-' + (mm[1] ? mm : '0' + mm[0]) + '-' + (dd[1] ? dd : '0' + dd[0]); //padding
};

BlockController.prototype.getBlockReward = function(height) {
  var halvings = Math.floor(height / 210000);
  // Force block reward to zero when right shift is undefined.
  if (halvings >= 64) {
    return 0;
  }

  // Subsidy is cut in half every 210,000 blocks which will occur approximately every 4 years.
  var subsidy = new BN(50 * 1e8);
  subsidy = subsidy.shrn(halvings);

  return parseInt(subsidy.toString(10));
};

module.exports = BlockController;
