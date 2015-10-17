'use strict';

var BaseService = require('./service');
var inherits = require('util').inherits;
var BlockController = require('./blocks');
var TxController = require('./transactions');
var AddressController = require('./addresses');
var StatusController = require('./status');
var MessagesController = require('./messages');
var UtilsController = require('./utils');
var CurrencyController = require('./currency');
var bitcore = require('bitcore-lib');
var _ = bitcore.deps._;
var $ = bitcore.util.preconditions;
var Transaction = bitcore.Transaction;
var EventEmitter = require('events').EventEmitter;

var InsightAPI = function(options) {
  BaseService.call(this, options);

  // in minutes
  this.currencyRefresh = options.currencyRefresh || CurrencyController.DEFAULT_CURRENCY_DELAY;

  this.subscriptions = {
    inv: []
  };

  if (!_.isUndefined(options.routePrefix)) {
    this.routePrefix = options.routePrefix;
  } else {
    this.routePrefix = this.name;
  }

  this.txController = new TxController(this.node);
};

InsightAPI.dependencies = ['address', 'web'];

inherits(InsightAPI, BaseService);

InsightAPI.prototype.getRoutePrefix = function() {
  return this.routePrefix;
};

InsightAPI.prototype.start = function(callback) {
  this.node.services.bitcoind.on('tx', this.transactionHandler.bind(this));

  setImmediate(callback);
};

InsightAPI.prototype.setupRoutes = function(app) {
  //Enable CORS
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

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

  // Address routes
  var messages = new MessagesController(this.node);
  app.get('/messages/verify', messages.verify.bind(messages));
  app.post('/messages/verify', messages.verify.bind(messages));

  // Utils route
  var utils = new UtilsController(this.node);
  app.get('/utils/estimatefee', utils.estimateFee.bind(utils));

  // Currency
  var currency = new CurrencyController({
    node: this.node,
    currencyRefresh: this.currencyRefresh
  });
  app.get('/currency', currency.index.bind(currency));

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
