'use strict';

/**
 * Module dependencies.
 */
var common = require('./common');
var async = require('async');
var bdb = require('../../lib/BlockDb').default();
var tdb = require('../../lib/TransactionDb').default();

/**
 * Find block by hash ...
 */
exports.block = function(req, res, next, hash) {
  bdb.fromHashWithInfo(hash, function(err, block) {
    if (err || !block)
      return common.handleErrors(err, res, next);
    else {
      tdb.getPoolInfo(block.info.tx[0], function(info) {
        block.info.poolInfo = info;
        req.block = block.info;
        return next();
      });
    }
  });
};


/**
 * Show block
 */
exports.show = function(req, res) {
  if (req.block) {
    res.jsonp(req.block);
  }
};

/**
 * Show block by Height
 */
exports.blockindex = function(req, res, next, height) {
  bdb.blockIndex(height, function(err, hashStr) {
    if (err) {
      console.log(err);
      res.status(400).send('Bad Request'); // TODO
    } else {
      res.jsonp(hashStr);
    }
  });
};

var getBlock = function(blockhash, cb) {
  bdb.fromHashWithInfo(blockhash, function(err, block) {
    if (err) {
      console.log(err);
      return cb(err);
    }

    // TODO
    if (!block.info) {
      console.log('Could not get %s from RPC. Orphan? Error?', blockhash); //TODO
      // Probably orphan
      block.info = {
        hash: blockhash,
        isOrphan: 1,
      };
    }

    tdb.getPoolInfo(block.info.tx[0], function(info) {
      block.info.poolInfo = info;
      return cb(err, block.info);
    });

  });
};

/**
 * List of blocks by date
 */

var DFLT_LIMIT=200;
          // in testnet, this number is much bigger, we dont support
          // exploring blocks by date.

exports.list = function(req, res) {
  var isToday = false;

  //helper to convert timestamps to yyyy-mm-dd format
  var formatTimestamp = function(date) {
    var yyyy = date.getUTCFullYear().toString();
    var mm = (date.getUTCMonth() + 1).toString(); // getMonth() is zero-based
    var dd = date.getUTCDate().toString();

    return yyyy + '-' + (mm[1] ? mm : '0' + mm[0]) + '-' + (dd[1] ? dd : '0' + dd[0]); //padding
  };

  var dateStr;
  var todayStr = formatTimestamp(new Date());

  if (req.query.blockDate) {
    // TODO: Validate format yyyy-mm-dd
    dateStr = req.query.blockDate;
    isToday = dateStr === todayStr;
  } else {
    dateStr = todayStr;
    isToday = true;
  }
  var gte = Math.round((new Date(dateStr)).getTime() / 1000);

  //pagination
  var lte = parseInt(req.query.startTimestamp) || gte + 86400;
  var prev = formatTimestamp(new Date((gte - 86400) * 1000));
  var next = lte ? formatTimestamp(new Date(lte * 1000)) :null;
  var limit = parseInt(req.query.limit || DFLT_LIMIT) + 1;
  var more;

  bdb.getBlocksByDate(gte, lte, limit, function(err, blockList) {

    if (err) {
      res.status(500).send(err);
    } else {
      var l = blockList.length;

      if (l===limit) {
        more = true;
        blockList.pop;
      }

      var moreTs=lte;
      async.mapSeries(blockList,
        function(b, cb) {
          getBlock(b.hash, function(err, info) {
            if (err) {
              console.log(err);
              return cb(err);
            }
            if (b.ts < moreTs) moreTs = b.ts;
            return cb(err, {
              height: info.height,
              size: info.size,
              hash: b.hash,
              time: b.ts || info.time,
              txlength: info.tx.length,
              poolInfo: info.poolInfo
            });
          });
        }, function(err, allblocks) {

          // sort blocks by height
          allblocks.sort(
            function compare(a,b) {
              if (a.height < b.height) return 1;
              if (a.height > b.height) return -1;
              return 0;
            });
          
          res.jsonp({
            blocks: allblocks,
            length: allblocks.length,
            pagination: {
              next: next,
              prev: prev,
              currentTs: lte - 1,
              current: dateStr,
              isToday: isToday,
              more: more,
              moreTs: moreTs,
            }
          });
        });
    }
  });
};
