'use strict';

var BaseService = require('./service');
var inherits = require('util').inherits;
var BlockController = require('./blocks');
var TxController = require('./transactions');
var AddressController = require('./addresses');
var StatusController = require('./status');
var bitcore = require('bitcore');
var $ = bitcore.util.preconditions;
var Transaction = bitcore.Transaction;
var EventEmitter = require('events').EventEmitter;

var InsightAPI = function(options) {
  BaseService.call(this, options);

  this.subscriptions = {
    inv: []
  };

  this.txController = new TxController(this.node);
};

InsightAPI.dependencies = ['address', 'web'];

inherits(InsightAPI, BaseService);

InsightAPI.prototype.start = function(callback) {
  this.node.services.bitcoind.on('tx', this.transactionHandler.bind(this));

  setImmediate(callback);
};

InsightAPI.prototype.setupRoutes = function(app) {
  //Block routes
  var blocks = new BlockController(this.node);
  app.get('/blocks', blocks.list.bind(blocks));


  app.get('/block/:blockHash', blocks.show.bind(blocks));
  app.param('blockHash', blocks.block.bind(blocks));

  app.get('/block-index/:height', blocks.blockIndex.bind(blocks));
  app.param('height', blocks.blockIndex.bind(blocks));


  // Transaction routes
  var transactions = new TxController(this.node);
  app.get('/tx/:txid', transactions.show.bind(transactions));
  app.param('txid', transactions.transaction.bind(transactions));
  app.get('/txs', transactions.list.bind(transactions));
  app.post('/tx/send', transactions.send.bind(transactions));

  // Raw Routes
  app.get('/rawtx/:txid', transactions.showRaw.bind(transactions));
  app.param('txid', transactions.rawTransaction.bind(transactions));

  // Address routes
  var addresses = new AddressController(this.node);
  app.get('/addr/:addr', addresses.checkAddr.bind(addresses), addresses.show.bind(addresses));
  app.get('/addr/:addr/utxo', addresses.checkAddr.bind(addresses), addresses.utxo.bind(addresses));
  app.get('/addrs/:addrs/utxo', addresses.checkAddrs.bind(addresses), addresses.multiutxo.bind(addresses));
  app.post('/addrs/utxo', addresses.checkAddrs.bind(addresses), addresses.multiutxo.bind(addresses));
  app.get('/addrs/:addrs/txs', addresses.checkAddrs.bind(addresses), addresses.multitxs.bind(addresses));
  app.post('/addrs/txs', addresses.checkAddrs.bind(addresses), addresses.multitxs.bind(addresses));

  // Address property routes
  app.get('/addr/:addr/balance', addresses.checkAddr.bind(addresses), addresses.balance.bind(addresses));
  app.get('/addr/:addr/totalReceived', addresses.checkAddr.bind(addresses), addresses.totalReceived.bind(addresses));
  app.get('/addr/:addr/totalSent', addresses.checkAddr.bind(addresses), addresses.totalSent.bind(addresses));
  app.get('/addr/:addr/unconfirmedBalance', addresses.checkAddr.bind(addresses), addresses.unconfirmedBalance.bind(addresses));

  // Status route
  var status = new StatusController(this.node);
  app.get('/status', status.show.bind(status));
  app.get('/sync', status.sync.bind(status));
  app.get('/peer', status.peer.bind(status));
  app.get('/version', status.version.bind(status));


  // Utils route
  /*var utils = require('../app/controllers/utils');
  app.get(apiPrefix + '/utils/estimatefee', utils.estimateFee);

  // Currency
  var currency = require('../app/controllers/currency');
  app.get(apiPrefix + '/currency', currency.index);

  // Email store plugin
  if (config.enableEmailstore) {
    var emailPlugin = require('../plugins/emailstore');
    app.get(apiPrefix + '/email/retrieve', emailPlugin.retrieve);
  }

  // Currency rates plugin
  if (config.enableCurrencyRates) {
    var currencyRatesPlugin = require('../plugins/currencyrates');
    app.get(apiPrefix + '/rates/:code', currencyRatesPlugin.getRate);
  }

  // Address routes
  var messages = require('../app/controllers/messages');
  app.get(apiPrefix + '/messages/verify', messages.verify);
  app.post(apiPrefix + '/messages/verify', messages.verify);

  //Home route
  var index = require('../app/controllers/index');
  app.get('*', index.render);*/
};

InsightAPI.prototype.getPublishEvents = function() {
  return [
    {
      name: 'inv',
      scope: this,
      subscribe: this.subscribe.bind(this),
      unsubscribe: this.unsubscribe.bind(this),
      extraEvents: ['tx', 'block']
    }
  ];
};

InsightAPI.prototype.blockHandler = function(block, add, callback) {
  // Notify inv subscribers
  for (var i = 0; i < this.subscriptions.inv.length; i++) {
    this.subscriptions.inv[i].emit('block', block.hash);
  }

  setImmediate(function() {
    callback(null, []);
  });
};

InsightAPI.prototype.transactionHandler = function(txInfo) {
  if(txInfo.mempool) {
    var tx = Transaction().fromBuffer(txInfo.buffer);
    tx = this.txController.transformInvTransaction(tx);

    for (var i = 0; i < this.subscriptions.inv.length; i++) {
      this.subscriptions.inv[i].emit('tx', tx);
    }
  }
};

InsightAPI.prototype.subscribe = function(emitter) {
  $.checkArgument(emitter instanceof EventEmitter, 'First argument is expected to be an EventEmitter');

  var emitters = this.subscriptions.inv;
  var index = emitters.indexOf(emitter);
  if(index === -1) {
    emitters.push(emitter);
  }
};

InsightAPI.prototype.unsubscribe = function(emitter) {
  $.checkArgument(emitter instanceof EventEmitter, 'First argument is expected to be an EventEmitter');

  var emitters = this.subscriptions.inv;
  var index = emitters.indexOf(emitter);
  if(index > -1) {
    emitters.splice(index, 1);
  }
};

module.exports = InsightAPI;