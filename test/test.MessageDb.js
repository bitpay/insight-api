'use strict';

var chai = require('chai');
var should = chai.should;

var MessageDb = require('../lib/MessageDb');
var bitcore = require('bitcore');
var SIN = bitcore.SIN;

describe('MessageDb', function() {
  it('should be able to create instance', function() {
    var mdb = new MessageDb(opts);
  });
  it('should be able to close instance', function() {
    var mdb = new MessageDb(opts);
    mdb.close();
  });
  var opts = {
    name: 'test-MessageDb'
  };
  var from = new SIN(new Buffer('dadbad00', 'hex'));
  var to = new SIN(new Buffer('bacacafe', 'hex'));
  var message = {
    a: 1,
    b: 2
  };
  it('should be able to add messages', function(done) {
    var mdb = new MessageDb(opts);
    console.log(to.toString());
    mdb.addMessage(message, from, to, function(err) {
      done();
    });
  });
});
