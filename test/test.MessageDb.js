'use strict';

var chai = require('chai');
var should = chai.should;
var expect = chai.expect;

var levelup = require('levelup');
var memdown = require('memdown');
var microtime = require('microtime');
var MessageDb = require('../lib/MessageDb');
var bitcore = require('bitcore');
var SIN = bitcore.SIN;
var Key = bitcore.Key;
var AuthMessage = bitcore.AuthMessage;

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
  var fpk = Key.generateSync();
  var tpk = Key.generateSync();
  var from = fpk.public.toString('hex');
  var to = tpk.public.toString('hex');
  var messageData = {
    a: 1,
    b: 2
  };
  var messageData2 = {};
  var messageData3 = ['a', 'b'];
  var message = AuthMessage.encode(to, fpk, messageData);
  var message2 = AuthMessage.encode(to, fpk, messageData2);
  var message3 = AuthMessage.encode(to, fpk, messageData3);
  it('should be able to add and read a message', function(done) {
    var mdb = new MessageDb(opts);
    var lower_ts = microtime.now();
    mdb.addMessage(message, function(err) {
      expect(err).to.not.exist;
      var upper_ts = microtime.now();
      mdb.getMessages(to, lower_ts, upper_ts, function(err, messages) {
        expect(err).to.not.exist;
        messages.length.should.equal(1);
        messages[0].ts.should.be.below(upper_ts);
        messages[0].ts.should.be.above(lower_ts);
        var m = AuthMessage.decode(tpk, messages[0]).payload;
        m.a.should.equal(1);
        m.b.should.equal(2);
        done();
      });
    });
  });
  var sharedMDB;
  it('should be able to add many messages and read some', function(done) {
    var mdb = new MessageDb(opts);
    sharedMDB = mdb;
    var lower_ts = microtime.now();
    mdb.addMessage(message, function(err) {
      expect(err).to.not.exist;
      mdb.addMessage(message2, function(err) {
        expect(err).to.not.exist;
        var upper_ts = microtime.now();
        setTimeout(function() {
          mdb.addMessage(message3, function(err) {
            expect(err).to.not.exist;
            mdb.getMessages(to, lower_ts, upper_ts, function(err, messages) {
              expect(err).to.not.exist;
              messages.length.should.equal(2);
              messages[0].ts.should.be.below(upper_ts);
              messages[0].ts.should.be.above(lower_ts);
              var m0 = AuthMessage.decode(tpk, messages[0]).payload;
              JSON.stringify(m0).should.equal('{"a":1,"b":2}');
              messages[1].ts.should.be.below(upper_ts);
              messages[1].ts.should.be.above(lower_ts);
              var m1 = AuthMessage.decode(tpk, messages[1]).payload;
              JSON.stringify(m1).should.equal('{}');
              done();
            });
          });
        }, 10);
      });
    });
  });
  it('should be able to add many messages and read all', function(done) {
    var mdb = sharedMDB;
    mdb.getMessages(to, null, null, function(err, messages) {
      expect(err).to.not.exist;
      messages.length.should.equal(4);
      var m0 = AuthMessage.decode(tpk, messages[0]).payload;
      JSON.stringify(m0).should.equal('{"a":1,"b":2}');
      var m1 = AuthMessage.decode(tpk, messages[1]).payload;
      JSON.stringify(m1).should.equal('{"a":1,"b":2}');
      var m2 = AuthMessage.decode(tpk, messages[2]).payload;
      JSON.stringify(m2).should.equal('{}');
      var m3 = AuthMessage.decode(tpk, messages[3]).payload;
      JSON.stringify(m3).should.equal('["a","b"]');
      done();
    });
  });
  it('should be able #removeUpTo', function(done) {
    var mdb = sharedMDB;
    var upper_ts = microtime.now();
    mdb.addMessage(message, function(err) {
      expect(err).to.not.exist;
      mdb.removeUpTo(upper_ts, function(err, n) {
        expect(err).to.not.exist;
        n.should.equal(4);
        mdb.getAll(function(error, all) {
          expect(error).to.not.exist;
          all.length.should.equal(1);
          done();
        });

      });
    });
  });
  it('should be able to close instance', function() {
    var mdb = new MessageDb(opts);
    mdb.close();
    expect(mdb).to.exist;
  });
});
