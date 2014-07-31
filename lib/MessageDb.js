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
var sockets = require('../app/controllers/socket.js');

var MESSAGE_PREFIX = 'msg-'; // msg-<sin1>-<sin2> => <message>

var MAX_OPEN_FILES = 500;
var CONCURRENCY = 5;


var d = logger.log;
var info = logger.info;
var db;

var MessageDb = function(opts) {
  opts = opts || {};
  this.path = config.leveldb + '/messages' + (opts.name ? ('-' + opts.name) : '');
  this.db = opts.db || db || levelup(this.path, {
    maxOpenFiles: MAX_OPEN_FILES,
    valueEncoding : 'json'
  });
  db = this.db;
  this.initEvents();
};
util.inherits(MessageDb, EventEmitter);

MessageDb.prototype.initEvents = function() {
  this.db.on('put', function(key, value) {
    var spl = key.split('-');
    var from = spl[1];
    var to = spl[2];
    var ts = spl[3];
    var message = value;
    sockets.broadcastMessage(from, to, ts, message);
  });
  this.db.on('ready', function() {
    //console.log('Database ready!');
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

MessageDb.prototype.getMessages = function(from, to, lower_ts, upper_ts, cb) {
  var list = [];
  var opts = {
    start: messageKey(from, to, upper_ts.getTime()),
    end: messageKey(from, to, lower_ts.getTime()),
    //limit: limit, TODO
    reverse: 1,
  };

  db.createReadStream(opts)
    .on('data', function(data) {
      var spl = data.key.split('-');
      var from = spl[1];
      var to = spl[2];
      var ts = spl[3];
      list.push({
        ts: ts,
        message: data.value,
      });
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {
      return cb(null, list.reverse());
    });
};

module.exports = soop(MessageDb);
