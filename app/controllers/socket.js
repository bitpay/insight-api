'use strict';

// server-side socket behaviour
var ios = null; // io is already taken in express
var util = require('bitcore').util;
var mdb = require('../../lib/MessageDb').default();

module.exports.init = function(io_ext) {
  ios = io_ext;
  if (ios) {
    // when a new socket connects
    ios.sockets.on('connection', function(socket) {
      // when it subscribes, make it join the according room
      socket.on('subscribe', function(topic) {
        socket.join(topic);
      });

      // when it requests sync, send him all pending messages
      socket.on('sync', function(ts) {
        mdb.getMessages(to, lower_ts, upper_ts, function(err, messages) {
          if (err) {
            throw new Error('Couldn\'t get messages on sync request: ' + err);
          }
          for (var i = 0; i < message.length; i++) {
            broadcastMessage(messages[i]);
          }
        });
      });

      // when it sends a message, add it to db
      socket.on('message', function(m) {
        mdb.addMessage(m, function(err) {
          if (err) {
            throw new Error('Couldn\'t add message to database: ' + err);
          }
        });
      });
    });
    mdb.on('message', broadcastMessage);
  }
};

var simpleTx = function(tx) {
  return {
    txid: tx
  };
};

var fullTx = function(tx) {
  var t = {
    txid: tx.txid,
    size: tx.size,
  };
  // Outputs
  var valueOut = 0;
  tx.vout.forEach(function(o) {
    valueOut += o.valueSat;
  });

  t.valueOut = (valueOut.toFixed(8) / util.COIN);
  return t;
};

module.exports.broadcastTx = function(tx) {
  if (ios) {
    var t = (typeof tx === 'string') ? simpleTx(tx) : fullTx(tx);
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

var broadcastMessage = module.exports.broadcastMessage = function(message) {
  if (ios) {
    ios.sockets.in(message.to).emit('message', message);
  }

}
