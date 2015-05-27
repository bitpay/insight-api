#!/usr/bin/env node

'use strict';
//Set the node enviornment variable if not set before
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var fs = require('fs');
var PeerSync = require('./lib/PeerSync');
var HistoricSync = require('./lib/HistoricSync');

var http = require('http');
var https = require('https');
var express = require('express');
var program = require('commander');

var config = require('./config/config');
var logger = require('./lib/logger').logger;
program
  .version(config.version);

// text title
console.log(
  '\n\
    ____           _       __    __     ___          _ \n\
   /  _/___  _____(_)___ _/ /_  / /_   /   |  ____  (_)\n\
   / // __ \\/ ___/ / __ `/ __ \\/ __/  / /\| \| / __ \\/ / \n\
 _/ // / / (__  ) / /_/ / / / / /_   / ___ |/ /_/ / /  \n\
/___/_/ /_/____/_/\\__, /_/ /_/\\__/  /_/  |_/ .___/_/   \n\
                 /____/                   /_/           \n\
\n\t\t\t\t\t\tv%s\n', config.version);
program.on('--help', function() {
  logger.info('\n# Configuration:\n\
\tINSIGHT_NETWORK (Network): %s\n\
\tINSIGHT_DB (Database Path):  %s\n\
\tINSIGHT_SAFE_CONFIRMATIONS (Safe Confirmations):  %s\n\
\tINSIGHT_IGNORE_CACHE (Ignore Cache):  %s\n\
 # Bicoind Connection configuration:\n\
\tRPC Username: %s\t\tBITCOIND_USER\n\
\tRPC Password: %s\tBITCOIND_PASS\n\
\tRPC Protocol: %s\t\tBITCOIND_PROTO\n\
\tRPC Host: %s\t\tBITCOIND_HOST\n\
\tRPC Port: %s\t\t\tBITCOIND_PORT\n\
\tP2P Port: %s\t\t\tBITCOIND_P2P_PORT\n\
\tBITCOIND_DATADIR: %s\n\
\t%s\n\
\nChange setting by assigning the enviroment variables above. Example:\n\
 $ INSIGHT_NETWORK="testnet" BITCOIND_HOST="123.123.123.123" ./insight.js\
\n\n',
    config.network, config.leveldb, config.safeConfirmations, config.ignoreCache ? 'yes' : 'no',
    config.bitcoind.user,
    config.bitcoind.pass ? 'Yes(hidden)' : 'No',
    config.bitcoind.protocol,
    config.bitcoind.host,
    config.bitcoind.port,
    config.bitcoind.p2pPort,
    config.bitcoind.dataDir + (config.network === 'testnet' ? '*' : ''), (config.network === 'testnet' ? '* (/testnet3 is added automatically)' : '')
  );
});

program.parse(process.argv);

// create express app
var expressApp = express();

// setup headers
require('./config/headers')(expressApp);

// setup http/https base server
var server;
if (config.enableHTTPS) {
  var serverOpts = {};
  serverOpts.key = fs.readFileSync('./etc/test-key.pem');
  serverOpts.cert = fs.readFileSync('./etc/test-cert.pem');
  server = https.createServer(serverOpts, expressApp);
} else {
  server = http.createServer(expressApp);
}

// Bootstrap models
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

// p2pSync process
var peerSync = new PeerSync({
  shouldBroadcast: true
});

if (!config.disableP2pSync) {
  peerSync.run();
}

// historic_sync process
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



// socket.io
var ios = require('socket.io')(server, config);
require('./app/controllers/socket.js').init(ios);

// plugins
if (config.enableRatelimiter) {
  require('./plugins/ratelimiter').init(expressApp, config.ratelimiter);
}

if (config.enableEmailstore) {
  require('./plugins/emailstore').init(config.emailstore);
}

if (config.enableCurrencyRates) {
  require('./plugins/currencyrates').init(config.currencyrates);
}

// express settings
require('./config/express')(expressApp, historicSync, peerSync);
require('./config/routes')(expressApp);


//Start the app by listening on <port>
server.listen(config.port, function() {
  logger.info('insight server listening on port %d in %s mode', server.address().port, process.env.NODE_ENV);
});

//expose app
exports = module.exports = expressApp;
