'use strict';
var imports = require('soop').imports();
var levelup = require('levelup');
var config = require('../config/config');
var Rpc = imports.rpc || require('./Rpc');
var async = require('async');
var logger = require('./logger').logger;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var sockets = require('../app/controllers/socket.js');

var MESSAGE_PREFIX = 'msg-'; // msg-<sin1>-<sin2> => <message>

var MAX_OPEN_FILES = 500;
var CONCURRENCY = 5;


var d = logger.log;
var info = logger.info;
var db;

var MessageDb = function(opts) {
  opts = opts || {};
  this.path = config.leveldb + '/messages' + (opts.name ? ('-' + opts.name) : '')
  if (!db) {
    db = levelup(this.path, {
      maxOpenFiles: MAX_OPEN_FILES
    });
  }
  this.db = db;
  this.initEvents();
};
util.inherits(MessageDb, EventEmitter);

MessageDb.prototype.initEvents = function() {
  this.db.on('put', function(key, value) {
    console.log('putting ' + key + '=>' + value);
    var spl = key.split('-');
    var from = spl[0];
    var to = spl[1];
    var ts = spl[2];
    var message = value;
    sockets.broadcastMessage(from, to, ts, message);
  });
  this.db.on('ready', function() {
    console.log('Database ready!');
  });
};

MessageDb.prototype.close = function(cb) {
  this.db.close(cb);
};


var messageKey = function(from, to, ts) {
  if (!ts) ts = Math.round(new Date().getTime());
  return MESSAGE_PREFIX + from.toString() + '-' + to.toString() + '-' + ts;
};

MessageDb.prototype.addMessage = function(m, from, to, cb) {
  var key = messageKey(from, to);
  var value = m;
  this.db.put(key, value, cb);
};

MessageDb.prototype.getMessages = function(from, to, from_ts, to_ts, cb) {
  // TODO
  this.db.get(messageKey(from, to), function(err, val) {
    if (err && err.notFound) return cb();
    if (err) return cb(err);

    return cb(null, val);
  });
};

module.exports = require('soop')(MessageDb);
