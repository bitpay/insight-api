'use strict';

var chai = require('chai');
var should = chai.should;

var MessageDb = require('../lib/MessageDb');
var bitcore = require('bitcore');
var SIN = bitcore.SIN;

describe('MessageDb', function() {
  it('should be able to create instance', function() {
    var mdb = new MessageDb();
  });
  it('should receive events', function(done) {
    var mdb = new MessageDb();
    var message = {};
    var from = new SIN(new Buffer('dadbad00', 'hex'));
    var to = new SIN(new Buffer('bacacafe', 'hex'));
    console.log(to.toString());
    mdb.addMessage(message, from, to, function(err) {
      done();
    });
  });
});
