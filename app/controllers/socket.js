'use strict';

// server-side socket behaviour
// io is a variable already taken in express
var ios = null;
var util = require('bitcore').util;

module.exports.init = function(app, io_ext) {
  ios = io_ext;
  ios.sockets.on('connection', function(socket) {
    socket.on('subscribe', function(topic) {
      socket.join(topic);
    });
  });
};

module.exports.broadcastTx = function(tx) {
  if (ios) {
    var t;
    if (typeof tx === 'string') {
      t = {
        txid: tx
      };
    }
    
    else {
      t = {
        txid: tx.txid,
        size: tx.size,
      };
      // Outputs
      var valueOut = 0;
      tx.vout.forEach(function(o) {
        valueOut += o.valueSat;
      });

      t.valueOut = (valueOut.toFixed(8)/util.COIN);
    }
    ios.sockets.in('inv').emit('tx', t);
  }
};

module.exports.broadcastBlock = function(block) {
  if (ios)
    ios.sockets.in('inv').emit('block', block);
};

module.exports.broadcastAddressTx = function(txid, address) {
  if (ios) {
    ios.sockets.in(address).emit(address, txid);
  }
};

module.exports.broadcastSyncInfo = function(historicSync) {
  if (ios)
    ios.sockets.in('sync').emit('status', historicSync);
};
