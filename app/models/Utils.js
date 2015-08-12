'use strict';
//var imports       = require('soop').imports();
var _ = require('lodash');
var async = require('async');

var bitcore = require('bitcore');
var RpcClient = bitcore.RpcClient;
var config = require('../../config/config');
var rpc = new RpcClient(config.bitcoind);

function Utils() {}

Utils.prototype.estimateFee = function(nbBlocks, cb) {
  var that = this;

  async.map([].concat(nbBlocks), function(n, next) {
    rpc.estimateFee(+n, function(err, info) {
      return next(err, [n, info.result]);
    });
  }, function(err, result) {
    if (err) return cb(err);
    return cb(null, _.zipObject(result));
  });
};

module.exports = require('soop')(Utils);
