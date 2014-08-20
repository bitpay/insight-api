var microtime = require('microtime');
var mdb = require('../../lib/MessageDb').default();


module.exports.init = function(ios, config) {

  ios.sockets.on('connection', function(socket) {
    // when it requests sync, send him all pending messages
    socket.on('sync', function(ts) {
      log('Sync requested by ' + socket.id);
      log('    from timestamp ' + ts);
      var rooms = socket.rooms;
      if (rooms.length !== 2) {
        socket.emit('insight-error', 'Must subscribe with public key before syncing');
        return;
      }
      var to = rooms[1];
      var upper_ts = Math.round(microtime.now());
      log('    to timestamp ' + upper_ts);
      mdb.getMessages(to, ts, upper_ts, function(err, messages) {
        if (err) {
          throw new Error('Couldn\'t get messages on sync request: ' + err);
        }
        log('\tFound ' + messages.length + ' message' + (messages.length !== 1 ? 's' : ''));
        for (var i = 0; i < messages.length; i++) {
          broadcastMessage(messages[i], socket);
        }
      });
    });

    // when it sends a message, add it to db
    socket.on('message', function(m) {
      log('Message sent from ' + m.pubkey + ' to ' + m.to);
      mdb.addMessage(m, function(err) {
        if (err) {
          throw new Error('Couldn\'t add message to database: ' + err);
        }
      });
    });


    // disconnect handler
    socket.on('disconnect', function() {
      log('disconnected ' + socket.id);
    });

    mdb.on('message', broadcastMessage);
    // when it requests sync, send him all pending messages
    socket.on('sync', function(ts) {
      log('Sync requested by ' + socket.id);
      log('    from timestamp ' + ts);
      var rooms = socket.rooms;
      if (rooms.length !== 2) {
        socket.emit('insight-error', 'Must subscribe with public key before syncing');
        return;
      }
      var to = rooms[1];
      var upper_ts = Math.round(microtime.now());
      log('    to timestamp ' + upper_ts);
      mdb.getMessages(to, ts, upper_ts, function(err, messages) {
        if (err) {
          throw new Error('Couldn\'t get messages on sync request: ' + err);
        }
        log('\tFound ' + messages.length + ' message' + (messages.length !== 1 ? 's' : ''));
        for (var i = 0; i < messages.length; i++) {
          broadcastMessage(messages[i], socket);
        }
      });
    });

    // when it sends a message, add it to db
    socket.on('message', function(m) {
      log('Message sent from ' + m.pubkey + ' to ' + m.to);
      mdb.addMessage(m, function(err) {
        if (err) {
          throw new Error('Couldn\'t add message to database: ' + err);
        }
      });
    });


    // disconnect handler
    socket.on('disconnect', function() {
      log('disconnected ' + socket.id);
    });
  });

  mdb.on('message', broadcastMessage);

};
