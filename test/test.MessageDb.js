'use strict';

var chai = require('chai');
var should = chai.should;
var expect = chai.expect;

var MessageDb = require('../lib/MessageDb');
var bitcore = require('bitcore');
var SIN = bitcore.SIN;
var levelup = require('levelup');
var memdown = require('memdown');

describe('MessageDb', function() {
  var opts = {
    name: 'test-MessageDb',
    db: levelup({
      db: memdown,
      sync: true,
      valueEncoding : 'json'
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
  it('should be able to add and read messages', function(done) {
    var mdb = new MessageDb(opts);
    mdb.addMessage(message, from, to, function(err) {
      expect(err).to.not.exist;
      var lower_ts = new Date('01/01/2014');
      var upper_ts = new Date();
      mdb.getMessages(from, to, lower_ts, upper_ts, function(err, messages) {
        expect(err).to.not.exist;
        messages.length.should.equal(1);
        var m = messages[0].message;
        m.a.should.equal(1);
        m.b.should.equal(2);
        done();

      });
    });
  });
  it('should be able to close instance', function() {
    var mdb = new MessageDb(opts);
    mdb.close();
    expect(mdb).to.exist;
  });
});
