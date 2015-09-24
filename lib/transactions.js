'use strict';

var bitcore = require('bitcore');
var _ = bitcore.deps._;
var common = require('./common');
var async = require('async');

function TxController(node) {
  this.node = node;
}

TxController.prototype.show = function(req, res) {
  if (req.transaction) {
    res.jsonp(req.transaction);
  }
};

/**
 * Find transaction by hash ...
 */
TxController.prototype.transaction = function(req, res, next, txid) {
  var self = this;

  this.node.getTransactionWithBlockInfo(txid, true, function(err, transaction) {
    if (err && err instanceof self.node.errors.Transaction.NotFound) {
      return common.handleErrors(null, res);
    } else if(err) {
      return common.handleErrors(err, res);
    }

    transaction.populateInputs(self.node.services.db, [], function(err) {
      if(err) {
        return res.send({
          error: err.toString()
        });
      }

      req.transaction = self.transformTransaction(transaction);
      next();
    });
  });
};

TxController.prototype.transformTransaction = function(transaction) {
  var txObj = transaction.toObject();

  var confirmations = 0;
  if(transaction.__height >= 0) {
    confirmations = this.node.services.db.tip.__height - transaction.__height + 1;
  }

  var transformed = {
    txid: txObj.hash,
    version: txObj.version,
    locktime: txObj.nLockTime
  };

  if(transaction.isCoinbase()) {
    transformed.vin = [
      {
        coinbase: txObj.inputs[0].script,
        sequence: txObj.inputs[0].sequenceNumber,
        n: 0
      }
    ];
  } else {
    transformed.vin = txObj.inputs.map(this.transformInput.bind(this));
  }

  transformed.vout = txObj.outputs.map(this.transformOutput.bind(this));

  transformed.blockhash = transaction.__blockHash;
  transformed.confirmations = confirmations;
  transformed.time = transaction.__timestamp ? transaction.__timestamp : Math.round(Date.now() / 1000); // can we get this from bitcoind?
  if (transformed.confirmations) {
    transformed.blocktime = transformed.time;
  }

  if(transaction.isCoinbase()) {
    transformed.isCoinBase = true;
  }

  transformed.valueOut = transaction.outputAmount / 1e8;
  transformed.size = transaction.toBuffer().length;
  if(transaction.hasAllUtxoInfo()) {
    transformed.valueIn = transaction.inputAmount / 1e8;
    transformed.fees = transaction.getFee() / 1e8;
  }

  return transformed;
};

TxController.prototype.transformInput = function(input, index) {
  var transformed = {
    txid: input.prevTxId,
    vout: input.outputIndex,
    scriptSig: {
      asm: null, // TODO
      hex: input.script
    },
    sequence: input.sequenceNumber,
    n: index
  };

  if(input.output) {
    transformed.addr = bitcore.Script(input.output.script).toAddress(this.node.network).toString();
    transformed.valueSat = input.output.satoshis;
    transformed.value = input.output.satoshis / 1e8;
    transformed.doubleSpentTxID = null; // TODO
    //transformed.isConfirmed = null; // TODO
    //transformed.confirmations = null; // TODO
    //transformed.unconfirmedInput = null; // TODO
  }

  return transformed;
};

TxController.prototype.transformOutput = function(output, index) {
  var transformed = {
    value: (output.satoshis / 1e8).toFixed(8),
    n: index,
    scriptPubKey: {
      asm: null, // TODO
      hex: output.script,
      reqSigs: null, // TODO
      type: null // TODO
    }
    //spentTxId: undefined, // TODO
    //spentIndex: undefined, // TODO
    //spentTs: undefined // TODO
  };

  var address = bitcore.Script(output.script).toAddress(this.node.network).toString();
  if(address !== 'false') {
    transformed.scriptPubKey.addresses = [address];
  }

  return transformed;
};

TxController.prototype.transformInvTransaction = function(transaction) {
  var self = this;

  var valueOut = 0;
  var vout = [];
  for (var i = 0; i < transaction.outputs.length; i++) {
    var output = transaction.outputs[i];
    valueOut += output.satoshis;
    if(output.script) {
      var address = output.script.toAddress(self.node.network);
      if(address) {
        var obj = {};
        obj[address.toString()] = output.satoshis;
        vout.push(obj);
      }
    }
  }

  var transformed = {
    txid: transaction.hash,
    valueOut: valueOut / 1e8,
    vout: vout
  };

  return transformed;
};

TxController.prototype.rawTransaction = function(req, res, next, txid) {
  var self = this;

  this.node.getTransaction(txid, true, function(err, transaction) {
    if (err && err instanceof self.node.errors.Transaction.NotFound) {
      return common.handleErrors(null, res);
    } else if(err) {
      return common.handleErrors(err, res);
    }

    req.rawTransaction = {
      'rawtx': transaction.toBuffer().toString('hex')
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
  var address = req.query.address;
  var page = parseInt(req.query.pageNum) || 0;
  var pageLength = 10;
  var pagesTotal = 1;

  if(blockHash) {
    self.node.getBlock(blockHash, function(err, block) {
      if(err && err.message === 'Block not found.') {
        return common.handleErrors(null, res);
      } else if(err) {
        return common.handleErrors(err, res);
      }

      var blockInfo = self.node.services.bitcoind.getBlockIndex(block.hash);
      var txs = block.transactions;
      var totalTxs = txs.length;

      if(!_.isUndefined(page)) {
        txs = txs.splice(page * pageLength, pageLength);
        pagesTotal = Math.ceil(totalTxs / pageLength);
      }

      async.mapSeries(txs, function(tx, next) {
        tx.__blockHash = block.hash;
        tx.__height = blockInfo.height;
        tx.__timestamp = block.header.time;

        tx.populateInputs(self.node.services.db, [], function(err) {
          if(err) {
            return next(err);
          }

          next(null, self.transformTransaction(tx));
        });
      }, function(err, transformed) {
        if(err) {
          return common.handleErrors(err, res);
        }

        res.jsonp({
          pagesTotal: pagesTotal,
          txs: transformed
        });
      });
    });
  } else if(address) {
    var options = {
      from: page * pageLength,
      to: (page + 1) * pageLength
    };

    self.node.getAddressHistory(address, options, function(err, result) {
      if(err) {
        return common.handleErrors(err, res);
      }

      var txs = result.items.map(function(info) {
        return info.tx;
      }).filter(function(value, index, self) {
        return self.indexOf(value) === index;
      });


      var transformed = txs.map(self.transformTransaction.bind(self));

      res.jsonp({
        pagesTotal: Math.ceil(result.totalCount / pageLength),
        txs: transformed
      });
    });
  } else {
    return common.handleErrors(new Error('Block hash or address expected'), res);
  }
};

TxController.prototype.send = function(req, res) {
  this.node.sendTransaction(req.body.rawtx, function(err, txid) {
    if(err) {
      // TODO handle specific errors
      return common.handleErrors(err, res);
    }

    res.json({'txid': txid});
  });
};

module.exports = TxController;
