'use strict';

var chai = require('chai');
var should = chai.should;

var MessageDb = require('../lib/MessageDb');

describe('MessageDb', function() {
  it('should be able to create instance', function() {
    var mdb = new MessageDb();
  });
  it('should receive events', function(done) {
    var mdb = new MessageDb();
    var message = {};
    mdb.addMessage(message, 'from', 'to', function(err) {
      done();
    });
  });
});
