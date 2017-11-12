'use strict';

var _ = require('lodash');
var AddressTranslator = require('./addresstranslator');
var bitcore = require('bitcore-lib');

function Common(options) {
  this.log = options.log;
  this.translateAddresses = options.translateAddresses;
}

Common.prototype.notReady = function (err, res, p) {
  res.status(503).send('Server not yet ready. Sync Percentage:' + p);
};

Common.prototype.handleErrors = function (err, res) {
  if (err) {
    if (err.code)  {
      res.status(400).send(err.message + '. Code:' + err.code);
    } else {
      this.log.error(err.stack);
      res.status(503).send(err.message);
    }
  } else {
    res.status(404).send('Not found');
  }
};


Common.prototype.translateInputAddresses= function(addresses) {
  var self = this;

  if (!addresses) return;

  if (!_.isArray(addresses))
    addresses = [ addresses ];

  function check(addresses) {
    if (!addresses) return; 

    for(var i = 0; i < addresses.length; i++) {
      try {
        new bitcore.Address(addresses[i]);
      } catch(e) {

        throw addresses[i];
      }
    }
  }
  
  if (this.translateAddresses) {
    addresses = AddressTranslator.translateInput(addresses);
  } else 
    check(addresses);

  return addresses;
};




Common.prototype.translateOutputAddress= function(address) {
  if (!this.translateAddresses) return address;
  return AddressTranslator.translateOutput(address);
};


module.exports = Common;
