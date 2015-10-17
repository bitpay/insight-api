'use strict';

var common = require('./common');
var bitcore = require('bitcore-lib');
var async = require('async');
var TxController = require('./transactions');

function AddressController(node) {
  this.node = node;
  this.txController = new TxController(node);
}

AddressController.prototype.show = function(req, res) {
  var options = {
    noTxList: parseInt(req.query.noTxList)
  };

  this.getAddressSummary(req.addr, options, function(err, data) {
    if(err) {
      return common.handleErrors(err, res);
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
  this.getAddressSummary(req.addr, {}, function(err, data) {
    if(err) {
      return common.handleErrors(err, res);
    }

    res.jsonp(data[param]);
  });
};

AddressController.prototype.getAddressSummary = function(address, options, callback) {
  var self = this;

  this.node.getAddressSummary(address, options, function(err, summary) {
    if(err) {
      return callback(err);
    }

    var transformed = {
      addrStr: address,
      balance: summary.balance / 1e8,
      balanceSat: summary.balance,
      totalReceived: summary.totalReceived / 1e8,
      totalReceivedSat: summary.totalReceived,
      totalSent: summary.totalSpent / 1e8,
      totalSentSat: summary.totalSpent,
      unconfirmedBalance: summary.unconfirmedBalance / 1e8,
      unconfirmedBalanceSat: summary.unconfirmedBalance,
      unconfirmedTxApperances: summary.unconfirmedAppearances, // misspelling - ew
      txApperances: summary.appearances, // yuck
      transactions: summary.txids
    };

    callback(null, transformed);
  });
};

AddressController.prototype.checkAddr = function(req, res, next) {
  req.addr = req.params.addr;
  this.check(req, res, next, [req.addr]);
};

AddressController.prototype.checkAddrs = function(req, res, next) {
  if(req.body.addrs) {
    req.addrs = req.body.addrs.split(',');
  } else {
    req.addrs = req.params.addrs.split(',');
  }

  this.check(req, res, next, req.addrs);
}

AddressController.prototype.check = function(req, res, next, addresses) {
  if(!addresses.length || !addresses[0]) {
    return common.handleErrors({
      message: 'Must include address',
      code: 1
    }, res);
  }

  for(var i = 0; i < addresses.length; i++) {
    try {
      var a = new bitcore.Address(addresses[i]);
    } catch(e) {
      return common.handleErrors({
        message: 'Invalid address: ' + e.message,
        code: 1
      }, res);
    }
  }

  next();
};

AddressController.prototype.utxo = function(req, res) {
  var self = this;

  this.node.getUnspentOutputs(req.addr, true, function(err, utxos) {
    if(err && err instanceof self.node.errors.NoOutputs) {
      return res.jsonp([]);
    } else if(err) {
      return common.handleErrors(err, res);
    }

    res.jsonp(utxos.map(self.transformUtxo.bind(self)));
  });
};

AddressController.prototype.multiutxo = function(req, res) {
  var self = this;

  this.node.getUnspentOutputs(req.addrs, true, function(err, utxos) {
    if(err && err instanceof self.node.errors.NoOutputs) {
      return res.jsonp([]);
    } else if(err) {
      return common.handleErrors(err, res);
    }

    res.jsonp(utxos.map(self.transformUtxo.bind(self)));
  });
};

AddressController.prototype.transformUtxo = function(utxo) {
  return {
    address: utxo.address,
    txid: utxo.txid,
    vout: utxo.outputIndex,
    ts: utxo.timestamp ? parseInt(utxo.timestamp) : Date.now(),
    scriptPubKey: utxo.script,
    amount: utxo.satoshis / 1e8,
    confirmations: utxo.confirmations
  };
};

AddressController.prototype.multitxs = function(req, res, next) {
  var self = this;

  var options = {
    from: req.query.from || req.body.from || 0
  };

  options.to = req.query.to || req.body.to || options.from + 10;

  self.node.getAddressHistory(req.addrs, options, function(err, result) {
    if(err) {
      return common.handleErrors(err, res);
    }

    self.transformAddressHistoryForMultiTxs(result.items, function(err, items) {
      if (err) {
        return common.handleErrors(err, res);
      }
      res.jsonp({
        totalItems: result.totalCount,
        from: options.from,
        to: Math.min(options.to, result.totalCount),
        items: items
      });
    });

  });
};

AddressController.prototype.transformAddressHistoryForMultiTxs = function(txinfos, callback) {
  var self = this;

  var items = txinfos.map(function(txinfo) {
    return txinfo.tx;
  }).filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });

  async.map(
    items,
    function(item, next) {
      self.txController.transformTransaction(item, next);
    },
    callback
  );
};



module.exports = AddressController;
