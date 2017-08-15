'use strict';

var async = require('async');
var bitcore = require('bitcore-lib');
var _ = bitcore.deps._;
var pools = require('../pools.json');
var BN = bitcore.crypto.BN;
var LRU = require('lru-cache');
var Common = require('./common');
var bcoin = require('bcoin');

function BlockController(options) {
  var self = this;
  this.node = options.node;

  this.blockSummaryCache = LRU(options.blockSummaryCacheSize || BlockController.DEFAULT_BLOCKSUMMARY_CACHE_SIZE);
  this.blockCacheConfirmations = 6;
  this.blockCache = LRU(options.blockCacheSize || BlockController.DEFAULT_BLOCK_CACHE_SIZE);

  this.poolStrings = {};
  pools.forEach(function(pool) {
    pool.searchStrings.forEach(function(s) {
      self.poolStrings[s] = {
        poolName: pool.poolName,
        url: pool.url
      };
    });
  });

  this.common = new Common({log: this.node.log});
  this._block = this.node.services.block;
  this._header = this.node.services.header;
  this._timestamp = this.node.services.timestamp;
}

var BLOCK_LIMIT = 200;

BlockController.DEFAULT_BLOCKSUMMARY_CACHE_SIZE = 1000000;
BlockController.DEFAULT_BLOCK_CACHE_SIZE = 1000;

function isHexadecimal(hash) {
  if (!_.isString(hash)) {
    return false;
  }
  return /^[0-9a-fA-F]+$/.test(hash);
}

BlockController.prototype.checkBlockHash = function(req, res, next) {
  var self = this;
  var hash = req.params.blockHash;
  if (hash.length < 64 || !isHexadecimal(hash)) {
    return self.common.handleErrors(null, res);
  }
  next();
};

/**
 * Find block by hash ...
 */
BlockController.prototype.block = function(req, res, next) {
  var self = this;
  var hash = req.params.blockHash;
  var blockCached = self.blockCache.get(hash);

  if (blockCached) {
    var height = self._block.getTip().height;
    blockCached.confirmations = height - blockCached.height + 1;
    req.block = blockCached;
    next();
  } else {
    self._block.getBlock(hash, function(err, block) {
      if (err) {
        return self.common.handleErrors(err, res);
      }

      if (!block) {
        return self.common.handleErrors(null, res);
      }

      self._header.getBlockHeader(hash, function(err, info) {
        if (err) {
          return self.common.handleErrors(err, res);
        }

        var blockResult = self.transformBlock(block, info);
        if (blockResult.confirmations >= self.blockCacheConfirmations) {
          self.blockCache.set(hash, blockResult);
        }

        req.block = blockResult;
        next();
      });
    });
  }
};

/**
 * Find rawblock by hash and height...
 */
BlockController.prototype.rawBlock = function(req, res, next) {
  var self = this;
  var blockHash = req.params.blockHash;

  self.node.getRawBlock(blockHash, function(err, blockBuffer) {
    if((err && err.code === -5) || (err && err.code === -8)) {
      return self.common.handleErrors(null, res);
    } else if(err) {
      return self.common.handleErrors(err, res);
    }
    req.rawBlock = {
      rawblock: blockBuffer.toString('hex')
    };
    next();
  });

};

BlockController.prototype._normalizePrevHash = function(hash) {
  // TODO fix bitcore to give back null instead of null hash
  if (hash !== '0000000000000000000000000000000000000000000000000000000000000000') {
    return hash;
  } else {
    return null;
  }
};

BlockController.prototype.transformBlock = function(block, info) {

  var transactionIds = block.txs.map(function(tx) {
    return tx.txid();
  });

  return {
    hash: block.rhash(),
    size: block.size,
    virtualSize: block.virtualSize,
    height: info.height,
    version: block.version,
    merkleroot: block.merkleRoot,
    tx: transactionIds,
    time: block.ts,
    nonce: block.nonce,
    bits: block.bits,
    difficulty: this._header.getDifficulty(),
    chainwork: info.chainwork,
    confirmations: this._block.getTip().height - info.height + 1,
    previousblockhash: info.prevHash,
    nextblockhash: null,
    reward: null,
    isMainChain: true,
    poolInfo: this.getPoolInfo(block.txs[0])
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

BlockController.prototype.showRaw = function(req, res) {
  if (req.rawBlock) {
    res.jsonp(req.rawBlock);
  }
};

BlockController.prototype.blockIndex = function(req, res) {
  var self = this;
  var height = req.params.height;
  self._header.getBlockHeader(parseInt(height), function(err, info) {
    if (err) {
      return self.common.handleErrors(err, res);
    }
    res.jsonp({
      blockHash: info.hash
    });
  });
};

BlockController.prototype._getBlockSummary = function(hash, moreTimestamp, next) {
  var self = this;

  function finish(result) {
    if (moreTimestamp > result.time) {
      moreTimestamp = result.time;
    }
    return next(null, result);
  }

  var summaryCache = self.blockSummaryCache.get(hash);

  if (summaryCache) {
    finish(summaryCache);
  } else {
    self._block.getRawBlock(hash, function(err, blockBuffer) {

      if (err) {
        return next(err);
      }

      var block = bcoin.block.fromRaw(blockBuffer, 'hex');

      self._header.getBlockHeader(hash, function(err, header) {

        if (err) {
          return next(err);
        }
        var height = header.height;

        var summary = {
          height: header.height,
          size: block.size,
          virtualSize: block.virtualSize,
          hash: hash,
          time: header.timestamp,
          txlength: block.txs.length,
          poolInfo: self.getPoolInfo(block.txs[0])
        };

        var _height = self._block.getTip().height;
        var confirmations = _height - height + 1;
        if (confirmations >= self.blockCacheConfirmations) {
          self.blockSummaryCache.set(hash, summary);
        }

        finish(summary);
      });
    });

  }
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
      return self.common.handleErrors(new Error('Please use yyyy-mm-dd format'), res);
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
  var moreTimestamp = lte;

  self._timestamp.getBlockHashesByTimestamp(lte, gte, function(err, hashes) {
    if(err) {
      return self.common.handleErrors(err, res);
    }

    hashes.reverse();

    if(hashes.length > limit) {
      more = true;
      hashes = hashes.slice(0, limit);
    }

    async.mapSeries(
      hashes,
      function(hash, next) {
        self._getBlockSummary(hash, moreTimestamp, next);
      },
      function(err, blocks) {
        if(err) {
          return self.common.handleErrors(err, res);
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
          data.pagination.moreTs = moreTimestamp;
        }

        res.jsonp(data);
      }
    );
  });
};

BlockController.prototype.getPoolInfo = function(tx) {
  if (!tx) {
    return {};
  }
  var coinbaseBuffer = tx.inputs[0].script.raw;

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
