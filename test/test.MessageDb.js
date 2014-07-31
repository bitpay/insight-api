'use strict';

var chai = require('chai');
var should = chai.should;
var expect = chai.expect;

var MessageDb = require('../lib/MessageDb');
var bitcore = require('bitcore');
var SIN = bitcore.SIN;
var levelup = require('levelup');
var memdown = require('memdown');
var microtime = require('microtime');

describe('MessageDb', function() {
  var opts = {
    name: 'test-MessageDb',
    db: levelup({
      db: memdown,
      sync: true,
      valueEncoding: 'json'
    })
  };
  it('should be able to create instance', function() {
    var mdb = new MessageDb(opts);
    expect(mdb).to.exist;
  });
  it('should be able to create default instance', function() {
    var mdb = MessageDb.default();
    expect(mdb).to.exist;
  });
  var from = new SIN(new Buffer('dadbad00', 'hex'));
  var to = new SIN(new Buffer('bacacafe', 'hex'));
  var message = {
    a: 1,
    b: 2
  };
  var message2 = {};
  var message3 = ['a', 'b'];
  it('should be able to add and read a message', function(done) {
    var mdb = new MessageDb(opts);
    var lower_ts = microtime.now();
    mdb.addMessage(message, from, to, function(err) {
      expect(err).to.not.exist;
      var upper_ts = microtime.now();
      mdb.getMessages(from, to, lower_ts, upper_ts, function(err, messages) {
        expect(err).to.not.exist;
        messages.length.should.equal(1);
        messages[0].ts.should.be.below(upper_ts);
        messages[0].ts.should.be.above(lower_ts);
        var m = messages[0].message;
        m.a.should.equal(1);
        m.b.should.equal(2);
        done();
      });
    });
  });
  it('should be able to add many messages and read them', function(done) {
    var mdb = new MessageDb(opts);
    var lower_ts = microtime.now();
    mdb.addMessage(message, from, to, function(err) {
      expect(err).to.not.exist;
      mdb.addMessage(message2, from, to, function(err) {
        expect(err).to.not.exist;
        var upper_ts = microtime.now();
        setTimeout(function() {
          mdb.addMessage(message3, from, to, function(err) {
            expect(err).to.not.exist;
            mdb.getMessages(from, to, lower_ts, upper_ts, function(err, messages) {
              expect(err).to.not.exist;
              messages.length.should.equal(2);
              messages[0].ts.should.be.below(upper_ts);
              messages[0].ts.should.be.above(lower_ts);
              JSON.stringify(messages[0].message).should.equal('{"a":1,"b":2}');
              messages[1].ts.should.be.below(upper_ts);
              messages[1].ts.should.be.above(lower_ts);
              JSON.stringify(messages[1].message).should.equal('{}');
              done();
            });
          });
        }, 10);
      });
    });
  });
  it('should be able to close instance', function() {
    var mdb = new MessageDb(opts);
    mdb.close();
    expect(mdb).to.exist;
  });
});
