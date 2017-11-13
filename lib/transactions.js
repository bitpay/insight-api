'use strict';

var bitcore = require('bitcore-lib');
var _ = bitcore.deps._;
var $ = bitcore.util.preconditions;
var Common = require('./common');
var async = require('async');

var MAXINT = 0xffffffff; // Math.pow(2, 32) - 1;

function TxController(node, translateAddresses) {
  this.node = node;
  this.common = new Common({log: this.node.log, translateAddresses: translateAddresses});
  this._block = this.node.services.block;
  this._transaction = this.node.services.transaction;
  this._address = this.node.services.address;
  this._p2p = this.node.services.p2p;
  this._network = this.node.network;
  if (this.node.network === 'livenet') {
    this._network = 'main';
  }
  if (this._network === 'regtest') {
    this._network = 'testnet';
  }
}

TxController.prototype.show = function(req, res) {
  if (req.transaction) {
    res.jsonp(req.transaction);
  }
};

/**
 * Find transaction by hash ...
 */
TxController.prototype.transaction = function(req, res, next) {
  var self = this;
  var txid = req.params.txid;

  this._transaction.getDetailedTransaction(txid, {}, function(err, transaction) {
    if (err) {
      return self.common.handleErrors(err, res);
    }

    if (!transaction) {
      return self.common.handleErrors(null, res);
    }

    self.transformTransaction(transaction, function(err, transformedTransaction) {
      if (err) {
        return self.common.handleErrors(err, res);
      }
      req.transaction = transformedTransaction;
      next();
    });

  });
};

// transaction parameter is a bcoin transaction
TxController.prototype.transformTransaction = function(transaction, options, callback) {

  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  $.checkArgument(_.isFunction(callback));

  var confirmations = 0;

  if(transaction.__height >= 0) {
    confirmations = this._block.getTip().height - transaction.__height + 1;
  }

  var transformed = {
    txid: transaction.txid(),
    version: transaction.version,
    locktime: transaction.locktime
  };

  if(transaction.inputs[0].isCoinbase()) {
    transformed.isCoinBase = true;
    transformed.vin = [
      {
        coinbase: transaction.inputs[0].script.toJSON(),
        sequence: transaction.inputs[0].sequence,
        n: 0
      }
    ];
  } else {
    options.inputValues = transaction.__inputValues;
    transformed.vin = transaction.inputs.map(this.transformInput.bind(this, options));
    transformed.valueIn = transaction.inputSatoshis / 1e8;
    transformed.fees = transaction.feeSatoshis / 1e8;
  }

  transformed.vout = transaction.outputs.map(this.transformOutput.bind(this, options));

  transformed.blockhash = transaction.blockhash;
  transformed.blockheight = transaction.__height;
  transformed.confirmations = confirmations;

  var time = transaction.__timestamp ? transaction.__timestamp : Math.round(Date.now() / 1000);
  transformed.time = time;
  if (transformed.confirmations) {
    transformed.blocktime = transformed.time;
  }

  transformed.valueOut = transaction.outputSatoshis / 1e8;
  transformed.size = transaction.getSize();

  callback(null, transformed);
};

TxController.prototype.transformInput = function(options, input, index) {
  // Input scripts are validated and can be assumed to be valid
  var transformed = {
    txid: input.prevout.txid(),
    vout: input.prevout.index,
    sequence: input.sequence,
    n: index
  };

  if (!options.noScriptSig) {
    transformed.scriptSig = {
      hex: input.script.toJSON()
    };
    if (!options.noAsm) {
      transformed.scriptSig.asm = input.script.toASM();
    }
  }

  var address = input.getAddress();
  if (address) {
    address.network = this._network;
    transformed.addr = this.common.translateOutputAddress(address.toString());
      
  } else {
    transformed.addr = null;
  }
  transformed.valueSat = options.inputValues[index];
  transformed.value = transformed.valueSat / 1e8;
  transformed.doubleSpentTxID = null; // TODO
  transformed.isConfirmed = null; // TODO
  transformed.confirmations = null; // TODO
  transformed.unconfirmedInput = null; // TODO

  return transformed;
};

TxController.prototype.transformOutput = function(options, output, index) {
  var transformed = {
    value: (output.value / 1e8).toFixed(8),
    n: index,
    scriptPubKey: {
      hex: output.script.toJSON()
    }
  };

  if (!options.noAsm) {
    transformed.scriptPubKey.asm = output.script.toASM();
  }

  if (!options.noSpent) {
    transformed.spentTxId = output.spentTxId || null; // TODO
    transformed.spentIndex = _.isUndefined(output.spentIndex) ? null : output.spentIndex; // TODO
    transformed.spentHeight = output.spentHeight || null; // TODO
  }

  var address = output.getAddress();
  if (address) {
    address.network = this._network;
    transformed.scriptPubKey.addresses = [this.common.translateOutputAddress(address.toString())];
    
    transformed.scriptPubKey.type = address.getType();
  }
  return transformed;
};

TxController.prototype.transformInvTransaction = function(transaction) {
  var self = this;

  var valueOut = 0;
  var vout = [];
  for (var i = 0; i < transaction.outputs.length; i++) {
    var output = transaction.outputs[i];
    valueOut += output.value;
    if (output.script) {
      var address = output.getAddress();

      if (!address) {
        continue;
      }

      address.network = this._network;
      address = self.common.translateOutputAddress(address.toString());

      var obj = {};
      obj[address] = output.value;
      vout.push(obj);

    }
  }

  var isRBF = _.any(_.pluck(transaction.inputs, 'sequence'), function(seq) {
    return seq < MAXINT - 1;
  });

  var transformed = {
    txid: transaction.txid(),
    valueOut: valueOut / 1e8,
    vout: vout,
    isRBF: isRBF,
  };

  return transformed;
};

TxController.prototype.rawTransaction = function(req, res, next) {

  var self = this;
  var txid = req.params.txid;

  this._transaction.getTransaction(txid, function(err, transaction) {
    if (err && err.code === -5) {
      return self.common.handleErrors(null, res);
    } else if(err) {
      return self.common.handleErrors(err, res);
    }

    req.rawTransaction = {
      'rawtx': transaction.toRaw().toString('hex')
    };

    next();

  });
};

TxController.prototype.showRaw = function(req, res) {
  if (req.rawTransaction) {
    res.jsonp(req.rawTransaction);
  }
};

TxController.prototype.list = function(req, res) {
  var self = this;

  var blockHash = req.query.block;
  var address = this.common.translateInputAddresses(req.query.address);
  var page = parseInt(req.query.pageNum) || 0;
  var pageLength = 10;
  var pagesTotal = 1;

  if(blockHash) {
    self._block.getBlockOverview(blockHash, function(err, block) {

      if (err) {
        return self.common.handleErrors(err, res);
      }

      if (!block) {
        return self.common.handleErrors(null, res);
      }

      var totalTxs = block.txids.length;
      var txids;

      if(!_.isUndefined(page)) {
        var start = page * pageLength;
        txids = block.txids.slice(start, start + pageLength);
        pagesTotal = Math.ceil(totalTxs / pageLength);
      } else {
        txids = block.txids;
      }

      async.mapSeries(txids, function(txid, next) {
        self._transaction.getDetailedTransaction(txid, {}, function(err, transaction) {
          if (err) {
            return next(err);
          }
          self.transformTransaction(transaction, next);
        });
      }, function(err, transformed) {
        if(err) {
          return self.common.handleErrors(err, res);
        }

        res.jsonp({
          pagesTotal: pagesTotal,
          txs: transformed
        });
      });

    });
  } else if (address) {
    var options = {
      from: page * pageLength,
      to: (page + 1) * pageLength
    };

    self._address.getAddressHistory(address, options, function(err, result) {
      if(err) {
        return self.common.handleErrors(err, res);
      }

      async.map(
        result.items,
        function(tx, next) {
          self.transformTransaction(tx, next);
        },
        function(err, transformed) {
          if (err) {
            return self.common.handleErrors(err, res);
          }
          res.jsonp({
            pagesTotal: Math.ceil(result.totalCount / pageLength),
            txs: transformed
          });
        }
      );
    });
  } else {
    return self.common.handleErrors(new Error('Block hash or address expected'), res);
  }
};

TxController.prototype.send = function(req, res) {
  var self = this;
  this._p2p.sendTransaction(req.body.rawtx, function(err, txid) {
    if(err) {
      // TODO handle specific errors
      return self.common.handleErrors(err, res);
    }

    res.json({'txid': txid});
  });
};

module.exports = TxController;
