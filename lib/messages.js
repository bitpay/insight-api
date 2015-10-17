'use strict';

var bitcore = require('bitcore-lib');
var _ = bitcore.deps._;
var Message = require('bitcore-message');
var common = require('./common');

function MessagesController(node) {
  this.node = node;
}

MessagesController.prototype.verify = function(req, res) {
  var address = req.body.address || req.query.address;
  var signature = req.body.signature || req.query.signature;
  var message = req.body.message || req.query.message;
  if(_.isUndefined(address) || _.isUndefined(signature) || _.isUndefined(message)) {
    return common.handleErrors({
      message: 'Missing parameters (expected "address", "signature" and "message")',
      code: 1
    }, res);
  }
  var valid;
  try {
    valid = new Message(message).verify(address, signature);
  } catch(err) {
    return common.handleErrors({
      message: 'Unexpected error: ' + err.message,
      code: 1
    }, res);
  }
  res.json({'result': valid});
};

module.exports = MessagesController;
