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
    return [num, self.node.services.bitcoind.estimateFee(num)];
  });

  res.jsonp(_.zipObject(result));
};

module.exports = UtilsController;