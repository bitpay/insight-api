'use strict';

// server-side socket behaviour
var ios = null; // io is already taken in express
var util = require('bitcore').util;
var mdb = require('../../lib/MessageDb').default();
var microtime = require('microtime');
var enableMessageBroker;

module.exports.init = function(io_ext, config) {
  enableMessageBroker = config ? config.enableMessageBroker : false;
  ios = io_ext;
  if (ios) {
    // when a new socket connects
    ios.sockets.on('connection', function(socket) {
      // when it subscribes, make it join the according room
      socket.on('subscribe', function(topic) {
        if (socket.rooms.length === 1) {
          console.log('subscribe to ' + topic);
          socket.join(topic);
        }
      });

      if (enableMessageBroker) {
        // when it requests sync, send him all pending messages
        socket.on('sync', function(ts) {
          var rooms = socket.rooms;
          if (rooms.length !== 2) {
            socket.emit('insight-error', 'Must subscribe with public key before syncing');
            return;
          }
          var to = rooms[1];
          var upper_ts = Math.round(microtime.now());
          mdb.getMessages(to, ts, upper_ts, function(err, messages) {
            if (err) {
              throw new Error('Couldn\'t get messages on sync request: ' + err);
            }
            for (var i = 0; i < messages.length; i++) {
              broadcastMessage(messages[i], socket);
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
      }
    });
    if (enableMessageBroker)
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

var broadcastMessage = module.exports.broadcastMessage = function(message, socket) {
  if (ios) {
    var s = socket || ios.sockets.in(message.to);
    s.emit('message', message);
  }

}
