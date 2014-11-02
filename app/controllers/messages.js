'use strict';

var common = require('./common');
var Rpc = require('../../lib/Rpc');


exports.verify = function(req, res) {
  var address = req.param('address'),
      signature = req.param('signature'),
      message = req.param('message');

  if(typeof(address) == 'undefined'
        || typeof(signature) == 'undefined'
        || typeof(message) == 'undefined') {
    return common.handleErrors({
      message: 'Missing parameters (expected "address", "signature" and "message")',
      code: 1
    }, res);
  }

  Rpc.verifyMessage(address, signature, message, function(err, result) {
    if (err) {
      return common.handleErrors(err, res);
    }
    res.json({'result' : result});
  });
};
