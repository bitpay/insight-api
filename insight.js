#!/usr/bin/env node

'use strict';
//Set the node enviornment variable if not set before
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Module dependencies.
 */
var express = require('express'),
  fs = require('fs'),
  PeerSync = require('./lib/PeerSync'),
  HistoricSync = require('./lib/HistoricSync');

//Initializing system variables
var config = require('./config/config');

// text title
/*jshint multistr: true */
console.log(
  '\n\
    ____           _       __    __     ___          _ \n\
   /  _/___  _____(_)___ _/ /_  / /_   /   |  ____  (_)\n\
   / // __ \\/ ___/ / __ `/ __ \\/ __/  / /\| \| / __ \\/ / \n\
 _/ // / / (__  ) / /_/ / / / / /_   / ___ |/ /_/ / /  \n\
/___/_/ /_/____/_/\\__, /_/ /_/\\__/  /_/  |_/ .___/_/   \n\
                 /____/                   /_/           \n\
\n\t\t\t\t\t\tv%s\n\
  # Configuration:\n\
\t\tNetwork: %s\tINSIGHT_NETWORK\n\
\t\tDatabase Path:  %s\tINSIGHT_DB\n\
\t\tSafe Confirmations:  %s\tINSIGHT_SAFE_CONFIRMATIONS\n\
\t\tIgnore Cache:  %s\tINSIGHT_IGNORE_CACHE\n\
 # Bicoind Connection configuration:\n\
\t\tRPC Username: %s\tBITCOIND_USER\n\
\t\tRPC Password: %s\tBITCOIND_PASS\n\
\t\tRPC Protocol: %s\tBITCOIND_PROTO\n\
\t\tRPC Host: %s\tBITCOIND_HOST\n\
\t\tRPC Port: %s\tBITCOIND_PORT\n\
\t\tP2P Port: %s\tBITCOIND_P2P_PORT\n\
\t\tData Dir: %s\tBITCOIND_DATADIR\n\
\t\t%s\n\
\nChange setting by assigning the enviroment variables in the last column. Example:\n\
 $ INSIGHT_NETWORK="testnet" BITCOIND_HOST="123.123.123.123" ./insight.js\
\n\n',
  version,
  network, home, safeConfirmations, ignoreCache ? 'yes' : 'no',
  bitcoindConf.user,
  bitcoindConf.pass ? 'Yes(hidden)' : 'No',
  bitcoindConf.protocol,
  bitcoindConf.host,
  bitcoindConf.port,
  bitcoindConf.p2pPort,
  dataDir + (network === 'testnet' ? '*' : ''), (network === 'testnet' ? '* (/testnet3 is added automatically)' : '')
);

/**
 * express app
 */
var expressApp = express();

/**
 * Bootstrap models
 */
var models_path = __dirname + '/app/models';
var walk = function(path) {
  fs.readdirSync(path).forEach(function(file) {
    var newPath = path + '/' + file;
    var stat = fs.statSync(newPath);
    if (stat.isFile()) {
      if (/(.*)\.(js$)/.test(file)) {
        require(newPath);
      }
    } else if (stat.isDirectory()) {
      walk(newPath);
    }
  });
};

walk(models_path);

/**
 * p2pSync process
 */

var peerSync = new PeerSync({
  shouldBroadcast: true
});

if (!config.disableP2pSync) {
  peerSync.run();
}

/**
 * historic_sync process
 */
var historicSync = new HistoricSync({
  shouldBroadcastSync: true
});
peerSync.historicSync = historicSync;

if (!config.disableHistoricSync) {
  historicSync.start({}, function(err) {
    if (err) {
      var txt = 'ABORTED with error: ' + err.message;
      console.log('[historic_sync] ' + txt);
    }
    if (peerSync) peerSync.allowReorgs = true;
  });
} else
if (peerSync) peerSync.allowReorgs = true;


//express settings
require('./config/express')(expressApp, historicSync, peerSync);

//Bootstrap routes
require('./config/routes')(expressApp);

// socket.io
var server = require('http').createServer(expressApp);
var ios = require('socket.io')(server);
require('./app/controllers/socket.js').init(expressApp, ios);

//Start the app by listening on <port>
server.listen(config.port, function() {
  console.log('insight server listening on port %d in %s mode', server.address().port, process.env.NODE_ENV);
});

//expose app
exports = module.exports = expressApp;
