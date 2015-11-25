'use strict';

var bitcore = require('bitcore-lib');
var _ = bitcore.deps._;
var $ = bitcore.util.preconditions;
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

      self.transformTransaction(transaction, function(err, transformedTransaction) {
        if (err) {
          return common.handleErrors(err, res);
        }
        req.transaction = transformedTransaction;
        next();
      });

    });
  });
};

TxController.prototype.transformTransaction = function(transaction, callback) {
  $.checkArgument(_.isFunction(callback));
  var self = this;
  var txid = transaction.id;
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

  async.map(
    Object.keys(txObj.outputs),
    function(outputIndex, next) {
      outputIndex = parseInt(outputIndex);
      var output = txObj.outputs[outputIndex];
      self.transformOutput(txid, output, outputIndex, next);
    },
    function(err, vout) {
      if (err) {
        return callback(err);
      }

      transformed.vout = vout;

      transformed.blockhash = transaction.__blockHash;
      transformed.blockheight = transaction.__height;
      transformed.confirmations = confirmations;
      var time = transaction.__timestamp ? transaction.__timestamp : Math.round(Date.now() / 1000);
      transformed.time = time;
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

      callback(null, transformed);

    }
  );

};

TxController.prototype.transformInput = function(input, index) {
  // Input scripts are validated and can be assumed to be valid
  var script = new bitcore.Script(input.script);
  var transformed = {
    txid: input.prevTxId,
    vout: input.outputIndex,
    scriptSig: {
      asm: script.toASM(),
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

TxController.prototype.transformOutput = function(txid, output, index, callback) {
  var self = this;
  var transformed = {
    value: (output.satoshis / 1e8).toFixed(8),
    n: index,
    scriptPubKey: {
      hex: output.script,
      //reqSigs: null, // TODO
    }
    //spentTs: undefined // TODO
  };

  var script;
  try {
    // Output scripts can be invalid, so we need to try/catch
    script = new bitcore.Script(output.script);
  } catch (err) {
    script = false;
  }
  if (script) {
    transformed.scriptPubKey.asm = script.toASM();
    var address = script.toAddress(this.node.network);
    if (address) {
      transformed.scriptPubKey.addresses = [address.toString()];
      transformed.scriptPubKey.type = address.type;
    }
  }

  var options = {
    queryMempool: true
  };

  self.node.services.address.getInputForOutput(
    txid,
    index,
    options,
    function(err, inputResult) {
      if (err) {
        return callback(err);
      }
      if (inputResult) {
        transformed.spentTxId = inputResult.inputTxId;
        transformed.spentIndex = inputResult.inputIndex;
      }
      callback(null, transformed);
    }
  );
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
          self.transformTransaction(tx, next);
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

      async.map(
        txs,
        function(tx, next) {
          self.transformTransaction(tx, next);
        },
        function(err, transformed) {
          if (err) {
            return common.handleErrors(err, res);
          }
          res.jsonp({
            pagesTotal: Math.ceil(result.totalCount / pageLength),
            txs: transformed
          });
        }
      );
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
