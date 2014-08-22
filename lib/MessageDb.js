'use strict';
var soop = require('soop');
var imports = soop.imports();
var levelup = require('levelup');
var config = require('../config/config');
var Rpc = imports.rpc || require('./Rpc');
var async = require('async');
var logger = require('./logger').logger;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var microtime = require('microtime');
var bitcore = require('bitcore');
var AuthMessage = bitcore.AuthMessage;
var preconditions = require('preconditions').singleton();

var MESSAGE_PREFIX = 'msg-'; // msg-<recieving_pubkey>-<ts> => <message>

var MAX_OPEN_FILES = 500;
var CONCURRENCY = 5;


var db;
var MessageDb = function(opts) {
  opts = opts || {};
  this.path = config.leveldb + '/messages' + (opts.name ? ('-' + opts.name) : '');
  this.db = opts.db || db || levelup(this.path, {
    maxOpenFiles: MAX_OPEN_FILES,
    valueEncoding: 'json'
  });
  this.initEvents();
  db = this.db;
};
util.inherits(MessageDb, EventEmitter);

MessageDb.prototype.initEvents = function() {
  if (db) return;
  var self = this;
  this.db.on('put', function(key, value) {
    var data = {};
    data.key = key;
    data.value = value;
    var message = MessageDb.fromStorage(data);
    self.emit('message', message);
  });
  this.db.on('ready', function() {
    //console.log('Database ready!');
  });
};

MessageDb.prototype.close = function(cb) {
  this.db.close(cb);
};


var messageKey = function(to, ts) {
  preconditions.checkArgument(typeof to === 'string');
  preconditions.checkArgument(to.length === 66);
  preconditions.checkArgument(!ts || typeof ts === 'number');
  if (!ts) ts = Math.round(microtime.now());
  return MESSAGE_PREFIX + to.toString() + '-' + ts;
};

MessageDb.prototype.addMessage = function(m, cb) {

  if (!this.authenticate(m)) {
    cb(new Error('Authentication failed'));
    return;
  }

  var key = messageKey(m.to);
  var value = m;
  this.db.put(key, value, cb);
};

MessageDb.prototype.authenticate = function(m) {
  preconditions.checkArgument(m.pubkey);
  preconditions.checkArgument(m.sig);
  preconditions.checkArgument(m.encrypted);

  var frompubkey = new Buffer(m.pubkey, 'hex');
  var sig = new Buffer(m.sig, 'hex');
  var encrypted = new Buffer(m.encrypted, 'hex');
  return AuthMessage._verify(frompubkey, sig, encrypted);
};

MessageDb.fromStorage = function(data) {
  var spl = data.key.split('-');
  var to = spl[1];
  var ts = +spl[2];
  var message = data.value;
  message.ts = ts;
  message.to = to;
  return message;
};

MessageDb.prototype.getMessages = function(to, lower_ts, upper_ts, cb) {
  var list = [];
  lower_ts = lower_ts || 1;
  var opts = {
    end: messageKey(to, lower_ts),
    start: messageKey(to, upper_ts),
    // limit: limit, TODO
    reverse: true,
  };

  db.createReadStream(opts)
    .on('data', function(data) {
      var message = MessageDb.fromStorage(data);
      list.push(message);
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {
      return cb(null, list.reverse());
    });
};

module.exports = soop(MessageDb);
