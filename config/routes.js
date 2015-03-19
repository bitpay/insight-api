'use strict';

/**
 * Module dependencies.
 */
var config = require('./config');

module.exports = function(app) {

  var apiPrefix = config.apiPrefix;

  //Block routes
  var blocks = require('../app/controllers/blocks');
  app.get(apiPrefix + '/blocks', blocks.list);


  app.get(apiPrefix + '/block/:blockHash', blocks.show);
  app.param('blockHash', blocks.block);

  app.get(apiPrefix + '/block-index/:height', blocks.blockindex);
  app.param('height', blocks.blockindex);

  // Transaction routes
  var transactions = require('../app/controllers/transactions');
  app.get(apiPrefix + '/tx/:txid', transactions.show);
  app.param('txid', transactions.transaction);
  app.get(apiPrefix + '/txs', transactions.list);
  app.post(apiPrefix + '/tx/send', transactions.send);

  // Raw Routes
  app.get(apiPrefix + '/rawtx/:txid', transactions.showRaw);
  app.param('txid', transactions.rawTransaction);

  // Address routes
  var addresses = require('../app/controllers/addresses');
  app.get(apiPrefix + '/addr/:addr', addresses.show);
  app.get(apiPrefix + '/addr/:addr/utxo', addresses.utxo);
  app.get(apiPrefix + '/addrs/:addrs/utxo', addresses.multiutxo);
  app.post(apiPrefix + '/addrs/utxo', addresses.multiutxo);
  app.get(apiPrefix + '/addrs/:addrs/txs', addresses.multitxs);
  app.post(apiPrefix + '/addrs/txs', addresses.multitxs);

  // Address property routes
  app.get(apiPrefix + '/addr/:addr/balance', addresses.balance);
  app.get(apiPrefix + '/addr/:addr/totalReceived', addresses.totalReceived);
  app.get(apiPrefix + '/addr/:addr/totalSent', addresses.totalSent);
  app.get(apiPrefix + '/addr/:addr/unconfirmedBalance', addresses.unconfirmedBalance);

  // Status route
  var st = require('../app/controllers/status');
  app.get(apiPrefix + '/status', st.show);

  app.get(apiPrefix + '/sync', st.sync);
  app.get(apiPrefix + '/peer', st.peer);

  // Currency
  var currency = require('../app/controllers/currency');
  app.get(apiPrefix + '/currency', currency.index);

  // Email store plugin
  if (config.enableEmailstore) {
    var emailPlugin = require('../plugins/emailstore');
    app.post(apiPrefix + '/email/save', emailPlugin.save);
    app.get(apiPrefix + '/email/retrieve', emailPlugin.retrieve);
    app.post(apiPrefix + '/email/change_passphrase', emailPlugin.changePassphrase);

    app.post(apiPrefix + '/email/validate', emailPlugin.validate);
    app.get(apiPrefix + '/email/validate', emailPlugin.validate);

    app.post(apiPrefix + '/email/register', emailPlugin.oldSave);
    app.get(apiPrefix + '/email/retrieve/:email', emailPlugin.oldRetrieve);

    app.post(apiPrefix + '/email/delete/profile', emailPlugin.eraseProfile);
    app.get(apiPrefix + '/email/delete/item', emailPlugin.erase);

    app.get(apiPrefix + '/email/resend_email', emailPlugin.resendEmail);
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
  app.get(apiPrefix + '/version', index.version);
  app.get('*', index.render);
};
