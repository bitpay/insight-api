'use strict';
var _ = require('lodash');

function UtilsController(node) {
  this.node = node;
}

UtilsController.prototype.estimateFee = function(req, res) {
  var self = this;
  var args = req.query.nbBlocks || '2';
  var nbBlocks = args.split(',');

  var result = nbBlocks.map(function(n) {
    var num = parseInt(n);
    // Insight and Bitcoin JSON-RPC return bitcoin for this value (instead of satoshis).
    var fee = self.node.services.bitcoind.estimateFee(num) / 1e8;
    return [num, fee];
  });

  res.jsonp(_.zipObject(result));
};

module.exports = UtilsController;
