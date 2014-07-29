'use strict';
var imports = require('soop').imports();
var levelup = require('levelup');
var config = require('../config/config');
var Rpc = imports.rpc || require('./Rpc');
var async = require('async');
var logger = require('./logger').logger;

var MESSAGE_PREFIX = 'msg-'; // msg-<sin1>-<sin2> => <message>

var MAX_OPEN_FILES = 500;
var CONCURRENCY = 5;

var db = imports.db || levelup(config.leveldb + '/messages', {
  maxOpenFiles: MAX_OPEN_FILES
});

var d = logger.log;
var info = logger.info;


var MessageDb = function() {
  db.on('put', function(key, value) {
    console.log(key + '=>' + value);
  });
  db.on('ready', function() {
    console.log('Database ready!');
  });
};

MessageDb.prototype.close = function(cb) {
  db.close(cb);
};


var messageKey = function(from, to, ts) {
  if (!ts) ts = Math.round(new Date().getTime() / 1000);
  return MESSAGE_PREFIX + from.toString() + '-' + to.toString() + '-' + ts;
};

MessageDb.prototype.addMessage = function(m, from, to, cb) {
  var key = messageKey(from, to);
  var value = m;
  db.put(key, value, cb);
};

MessageDb.prototype.getMessages = function(from, to, from_ts, to_ts, cb) {
  // TODO
  db.get(messageKey(from, to), function(err, val) {
    if (err && err.notFound) return cb();
    if (err) return cb(err);

    return cb(null, val);
  });
};

module.exports = require('soop')(MessageDb);
