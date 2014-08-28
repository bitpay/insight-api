'use strict';

// server-side socket behaviour
var ios = null; // io is already taken in express
var util = require('bitcore').util;
var logger = require('../../lib/logger').logger;

module.exports.init = function(io_ext) {
  ios = io_ext;
  if (ios) {
    // when a new socket connects
    ios.sockets.on('connection', function(socket) {
      logger.verbose('New connection from ' + socket.id);
      // when it subscribes, make it join the according room
      socket.on('subscribe', function(topic) {
        logger.debug('subscribe to ' + topic);
        socket.join(topic);
        socket.emit('subscribed');
      });

      // disconnect handler
      socket.on('disconnect', function() {
        logger.verbose('disconnected ' + socket.id);
      });

    });
  }
  return ios;
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
