'use strict';

var bitcore = require('bitcore-lib');
var Unit = bitcore.Unit;
var async = require('async');
var TxController = require('./transactions');
var Common = require('./common');
var _ = require('lodash');

function AddressController(node) {
  this.node = node;
  this._address = this.node.services.address;
  this._block = this.node.services.block;
  this.txController = new TxController(node);
  this.common = new Common({log: this.node.log});
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

  this._address.getAddressSummary(address, options, function(err, summary) {
    if(err) {
      return callback(err);
    }

    var transformed = {
      addrStr: address,
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

  var inValid = this.check(req.addrs);

  if (inValid) {
    return this.common.handleErrors({
      message: 'Invalid address: ' + inValid.message,
      code: 1
    }, res);
  }

  next();

};

AddressController.prototype.check = function(addresses) {

  for(var i = 0; i < addresses.length; i++) {
    try {
      new bitcore.Address(addresses[i]);
    } catch(e) {
      return addresses[i];
    }
  }

};

AddressController.prototype.utxo = function(req, res) {
  var self = this;

  this._address.getAddressUnspentOutputs(req.addr, {}, function(err, utxos) {
    if(err) {
      return self.common.handleErrors(err, res);
    } else if (!utxos.length) {
      return res.jsonp([]);
    }
    res.jsonp(utxos.map(self.transformUtxo.bind(self)));
  });
};

AddressController.prototype.multiutxo = function(req, res) {
  var self = this;

  var finalUtxos = [];

  var addresses;
  if (_.isArray(req.addrs)) {
    addresses = _.uniq(req.addrs);
  } else {
    addresses = req.addrs.split(',');
  }

  async.eachLimit(addresses, 4, function(addr, next) {

    self._address.getAddressUnspentOutputs(addr, {}, function(err, utxos) {

      if (err) {
        return next(err);
      }

      finalUtxos = finalUtxos.concat(utxos);
      next();
    });

  }, function(err) {

    if (err) {
      return self.common.handleErrors(err, res);
    }

    var finalRes = finalUtxos.map(self.transformUtxo.bind(self));
    res.jsonp(finalRes);

  });
};

AddressController.prototype.transformUtxo = function(utxoArg) {
  var utxo = {
    address: utxoArg.address,
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
