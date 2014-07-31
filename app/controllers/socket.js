'use strict';

// server-side socket behaviour
var ios = null; // io is already taken in express
var util = require('bitcore').util;
var mdb = require('../../lib/MessageDb').default();

module.exports.init = function(io_ext) {
  ios = io_ext;
  ios.sockets.on('connection', function(socket) {
    socket.on('subscribe', function(topic) {
      console.log('subscribe ' + topic);
      socket.join(topic);
    });
    socket.on('message', function(m) {
      mdb.addMessage(m.payload, m.from, m.to, function(err) {
        if (err) throw err; // TODO: handle
      });
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
    } else {
      t = {
        txid: tx.txid,
        size: tx.size,
      };
      // Outputs
      var valueOut = 0;
      tx.vout.forEach(function(o) {
        valueOut += o.valueSat;
      });

      t.valueOut = (valueOut.toFixed(8) / util.COIN);
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

module.exports.broadcastMessage = function(from, to, ts, message) {
  if (ios) {
    console.log('sending message '+to);
    ios.sockets.in(to).emit(from, {
      payload: message,
      ts: ts
    });
  }

}
