'use strict';
//var imports       = require('soop').imports();

var bitcore = require('bitcore');
var RpcClient = bitcore.RpcClient;
var config = require('../../config/config');
var rpc = new RpcClient(config.bitcoind);

function Utils() {}

Utils.prototype.estimateFee = function(n, next) {
  var that = this;

  rpc.estimateFee(n, function(err, info) {
    if (err) return next(err);

    that.feePerKB = info.result;
    return next();
  });
};

module.exports = require('soop')(Utils);
