'use strict';

var common = require('./common');
var bitcore = require('bitcore');
var TxController = require('./transactions');

function AddressController(node) {
  this.node = node;
  this.txController = new TxController(node);
}

AddressController.prototype.show = function(req, res) {
  this.getAddressHistory(req.addr, function(err, data) {
    if(err) {
      return common.handleErrors(err, res);
    }

    res.jsonp(data);
  });
};

AddressController.prototype.balance = function(req, res) {
  this.addressHistorySubQuery(req, res, 'balanceSat');
};

AddressController.prototype.totalReceived = function(req, res) {
  this.addressHistorySubQuery(req, res, 'totalReceivedSat');
};

AddressController.prototype.totalSent = function(req, res) {
  this.addressHistorySubQuery(req, res, 'totalSentSat');
};

AddressController.prototype.unconfirmedBalance = function(req, res) {
  this.addressHistorySubQuery(req, res, 'unconfirmedBalanceSat');
};

AddressController.prototype.addressHistorySubQuery = function(req, res, param) {
  this.getAddressHistory(req.addr, function(err, data) {
    if(err) {
      return common.handleErrors(err, res);
    }

    res.jsonp(data[param]);
  });
};

AddressController.prototype.getAddressHistory = function(address, callback) {
  var self = this;

  this.node.getAddressHistory(address, true, function(err, txinfos) {
    if(err) {
      return callback(err);
    }

    callback(null, self.transformAddressHistory(txinfos, address));
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

AddressController.prototype.transformAddressHistory = function(txinfos, address) {
  var transactions = txinfos.map(function(info) {
    return info.tx.hash;
  }).filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });

  var balance = 0;
  var appearances = 0;
  var totalReceived = 0;
  var totalSent = 0;
  var unconfirmedBalance = 0;
  var unconfirmedAppearances = 0;

  for(var i = 0; i < txinfos.length; i++) {
    if(txinfos[i].satoshis > 0) {
      totalReceived += txinfos[i].satoshis;
    } else {
      totalSent += -txinfos[i].satoshis;
    }

    if(txinfos[i].confirmations) {
      balance += txinfos[i].satoshis;
      unconfirmedBalance += txinfos[i].satoshis;
      appearances++;
    } else {
      unconfirmedBalance += txinfos[i].satoshis;
      unconfirmedAppearances++;
    }
  }

  return {
    addrStr: address,
    balance: balance / 1e8,
    balanceSat: balance,
    totalReceived: totalReceived / 1e8,
    totalReceivedSat: totalReceived,
    totalSent: totalSent / 1e8,
    totalSentSat: totalSent,
    unconfirmedBalance: unconfirmedBalance / 1e8,
    unconfirmedBalanceSat: unconfirmedBalance,
    unconfirmedTxApperances: unconfirmedAppearances, // misspelling - ew
    txApperances: appearances, // yuck
    transactions: transactions
  };
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

  this.node.getAddressHistory(req.addrs, true, function(err, txinfos) {
    if(err) {
      return common.handleErrors(err, res);
    }

    res.jsonp(self.transformAddressHistoryForMultiTxs(txinfos));
  });
};

AddressController.prototype.transformAddressHistoryForMultiTxs = function(txinfos) {
  var self = this;

  var items = txinfos.map(function(txinfo) {
    return txinfo.tx;
  }).filter(function(value, index, self) {
    return self.indexOf(value) === index;
  }).map(function(tx) {
    return self.txController.transformTransaction(tx);
  }).reverse();

  var transformed = {
    totalItems: items.length,
    from: 0,
    to: items.length,
    items: items
  };

  return transformed;
};



module.exports = AddressController;