var microtime = require('microtime');
var mdb = require('../lib/MessageDb').default();
var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();

var io;
module.exports.init = function(ext_io, config) {
  logger.info('Using mailbox plugin');
  preconditions.checkArgument(ext_io);
  io = ext_io;
  io.sockets.on('connection', function(socket) {
    // when it requests sync, send him all pending messages
    socket.on('sync', function(ts) {
      logger.verbose('Sync requested by ' + socket.id);
      logger.debug('    from timestamp ' + ts);
      var rooms = socket.rooms;
      if (rooms.length !== 2) {
        socket.emit('insight-error', 'Must subscribe with public key before syncing');
        return;
      }
      var to = rooms[1];
      var upper_ts = Math.round(microtime.now());
      logger.debug('    to timestamp ' + upper_ts);
      mdb.getMessages(to, ts, upper_ts, function(err, messages) {
        if (err) {
          throw new Error('Couldn\'t get messages on sync request: ' + err);
        }
        logger.verbose('\tFound ' + messages.length + ' message' + (messages.length !== 1 ? 's' : ''));

        if (messages.length) {
          for (var i = 0; i < messages.length; i++) {
            broadcastMessage(messages[i], socket);
          }
        } else {
          socket.emit('no messages');
        }
      });
    });

    // when it sends a message, add it to db
    socket.on('message', function(m) {
      logger.debug('Message sent from ' + m.pubkey + ' to ' + m.to);
      mdb.addMessage(m, function(err) {
        if (err) {
          throw new Error('Couldn\'t add message to database: ' + err);
        }
      });
    });

  });

  mdb.on('message', broadcastMessage);

};



var broadcastMessage = module.exports.broadcastMessage = function(message, socket) {
  preconditions.checkState(io);
  var s = socket || io.sockets.in(message.to);
  logger.debug('sending message to ' + message.to);
  s.emit('message', message);
}
