'use strict';

var bitcore = require('bitcore-lib');
var Unit = bitcore.Unit;
var async = require('async');
var TxController = require('./transactions');
var Common = require('./common');
var _ = require('lodash');

function AddressController(node, translateAddresses) {
  this.node = node;
  this._address = this.node.services.address;
  this._block = this.node.services.block;
  this.txController = new TxController(node, translateAddresses);
  this.common = new Common({log: this.node.log, translateAddresses: translateAddresses});
  this._block = this.node.services.block;
}

AddressController.prototype.show = function(req, res) {
  var self = this;
  var options = {
    noTxList: parseInt(req.query.noTxList)
  };

  if (req.query.from && req.query.to) {
    options.from = parseInt(req.query.from);
    options.to = parseInt(req.query.to);
  }

  this._address.getAddressSummary(req.addr, options, function(err, data) {
    if(err) {
      return self.common.handleErrors(err, res);
    }

    if (data && data.addrStr)
      data.addrStr = self.common.translateOutputAddress(data.addrStr);


    res.jsonp(data);
  });
};

AddressController.prototype.balance = function(req, res) {
  this.addressSummarySubQuery(req, res, 'balanceSat');
};

AddressController.prototype.totalReceived = function(req, res) {
  this.addressSummarySubQuery(req, res, 'totalReceivedSat');
};

AddressController.prototype.totalSent = function(req, res) {
  this.addressSummarySubQuery(req, res, 'totalSentSat');
};

AddressController.prototype.unconfirmedBalance = function(req, res) {
  this.addressSummarySubQuery(req, res, 'unconfirmedBalanceSat');
};

AddressController.prototype.addressSummarySubQuery = function(req, res, param) {
  var self = this;
  this.getAddressSummary(req.addr, {}, function(err, data) {
    if(err) {
      return self.common.handleErrors(err, res);
    }

    res.jsonp(data[param]);
  });
};

AddressController.prototype.getAddressSummary = function(address, options, callback) {
  var self = this;

  this._address.getAddressSummary(address, options, function(err, summary) {
    if(err) {
      return callback(err);
    }

    var transformed = {
      address: self.common.translateOutputAddress(address),
      balance: Unit.fromSatoshis(summary.balance).toBTC(),
      balanceSat: summary.balance,
      totalReceived: Unit.fromSatoshis(summary.totalReceived).toBTC(),
      totalReceivedSat: summary.totalReceivedSat,
      totalSent: Unit.fromSatoshis(summary.totalSent).toBTC(),
      totalSentSat: summary.totalSentSat,
      unconfirmedBalance: Unit.fromSatoshis(summary.unconfirmedBalance).toBTC(),
      unconfirmedBalanceSat: summary.unconfirmedBalance,
      unconfirmedTxApperances: summary.unconfirmedAppearances, // misspelling - ew
      txApperances: summary.txApperances, // yuck
      transactions: summary.transactions
    };

    callback(null, transformed);
  });
};

AddressController.prototype.checkAddrs = function(req, res, next) {
  var self = this;

  function makeArray(addrs) {
    if (_.isString(addrs)) {
      return addrs.split(',');
    }
    return addrs;
  }

  if (req.params.addr) {
    req.addr = req.params.addr;
    req.addrs = [req.addr];
  } else if(req.body.addrs) {
    req.addrs = makeArray(req.body.addrs);
  } else {
    req.addrs = makeArray(req.params.addrs);
  }

  if(!_.isArray(req.addrs) || _.compact(req.addrs).length < 1) {
    return this.common.handleErrors({
      message: 'Must include address',
      code: 1
    }, res);
  }

  try {
    req.addrs = self.common.translateInputAddresses(req.addrs);
    req.addr = req.addrs[0];
  } catch(e) {
console.log('[addresses.js.130]', e); //TODO
    return this.common.handleErrors({
      message: 'Invalid address: ' + e,
      code: 1
    }, res);
  }

  next();
};

AddressController.prototype.utxo = function(req, res) {
  var self = this;

  this._address.getAddressUnspentOutputs(req.addr, {}, function(err, utxos) {
    var results;
    if(err) {
      return self.common.handleErrors(err, res);
    } else if (!utxos.length) {
      results = [];
    }
    results = utxos.map(self.transformUtxo.bind(self));
    res.jsonp(results);
  });
};


AddressController.prototype.transformUtxo = function(utxoArg) {

  var utxo = {
    address: this.common.translateOutputAddress(utxoArg.address),
    txid: utxoArg.txid,
    vout: utxoArg.vout,
    scriptPubKey: utxoArg.scriptPubKey,
    amount: utxoArg.satoshis / 1e8,
    satoshis: utxoArg.satoshis
  };
  if (utxoArg.height && utxoArg.height > 0) {
    utxo.height = utxoArg.height;
    utxo.confirmations = this._block.getTip().height - utxoArg.height + 1;
  } else {
    utxo.confirmations = 0;
  }
  if (utxoArg.timestamp) {
    utxo.ts = utxoArg.timestamp;
  }
  return utxo;
};

AddressController.prototype._getTransformOptions = function(req) {
  return {
    noAsm: parseInt(req.query.noAsm) ? true : false,
    noScriptSig: parseInt(req.query.noScriptSig) ? true : false,
    noSpent: parseInt(req.query.noSpent) ? true : false
  };
};

// this call could take a while to run depending on what addresses are used
// considering memory constraints,  we will streaming out the results for addresses
// not necessarily in the order we received them
AddressController.prototype.multiutxo = function(req, res) {

  var self = this;

  var addresses;

  if (_.isArray(req.addrs)) {
    addresses = _.uniq(req.addrs);
  } else {
    addresses = _.compact(req.addrs.split(','));
  }

  var addressesLeft = addresses.length;
  var startedWriting = false;
  var cache = [];

  res.write('[');

  var sep = ',';

  async.eachLimit(addresses, 4, function(addr, next) {

    self._address.getAddressUnspentOutputs(addr, {}, function(err, utxos) {

      if (err) {
        return next(err);
      }

      if (addressesLeft-- > 0 && utxos.length > 0 && startedWriting) {
        res.write(sep);
      }

      for(var i = 0; i < utxos.length; i++) {
        startedWriting = true;
        if (utxos.length - 1 === i) {
          sep = '';
        }
        utxos[i] = self.transformUtxo(utxos[i]);
        cache.push(utxos[i]);
        res.write(JSON.stringify(utxos[i]) + sep);
      }

      sep = ',';
      next();

    });

  }, function(err) {

      if (err) {
        return self.common.handleErrors(err, res);
      }

      res.write(']');
      res.end();
  });

};

AddressController.prototype.multitxs = function(req, res) {
  var self = this;

  var options = {
    from: parseInt(req.query.from) || parseInt(req.body.from) || 0
  };

  options.to = parseInt(req.query.to) || parseInt(req.body.to) || parseInt(options.from) + 10;

  self._address.getAddressHistory(req.addrs, options, function(err, result) {

    if(err) {
      return self.common.handleErrors(err, res);
    }

    var transformOptions = self._getTransformOptions(req);

    self.transformAddressHistoryForMultiTxs(result.items, transformOptions, function(err, items) {

      if (err) {
        return self.common.handleErrors(err, res);
      }

      var ret = {
        totalItems: result.totalCount,
        from: options.from,
        to: Math.min(options.to, result.totalCount),
        items: items
      };

      res.jsonp(ret);
    });

  });
};

AddressController.prototype.transformAddressHistoryForMultiTxs = function(txs, options, callback) {
  var self = this;

  async.map(
    txs,
    function(tx, next) {
      self.txController.transformTransaction(tx, options, next);
    },
    callback
  );
};

module.exports = AddressController;
