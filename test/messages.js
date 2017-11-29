'use strict';

var should = require('should');
var sinon = require('sinon');
var MessagesController = require('../lib/messages');
var bitcore = require('vertcore-lib');
var _ = require('lodash');

describe('Messages', function() {

  var privateKey = bitcore.PrivateKey.fromWIF('Ky8PoXhMhGLxQ2pjHbn2fC1iL4wSuyevVatxSuLt4JEYVry4HBHH');
  var address = 'VqZ6EwtYa4nQNZb8qzruJB3wZUUALf1pXD';
  var badAddress = 'VqZ6EwtYa4nQNZb8qzruJB3wZUUALf1pXE';
  var signature = 'H6nkFXWzkAwKntC3XYGIAWRB+IM/i6bYhamvT62KAErRNz0Cd0yX4KvLNaj0fK5avSO4CIAq99bB1bA3x0h6kLY=';
  var message = 'cellar door';

  it('will verify a message (true)', function(done) {

    var controller = new MessagesController({node: {}});

    var req = {
      body: {
        'address': address,
        'signature': signature,
        'message': message
      },
      query: {}
    };
    var res = {
      json: function(data) {
        data.result.should.equal(true);
        done();
      }
    };

    controller.verify(req, res);
  });

  it('will verify a message (false)', function(done) {

    var controller = new MessagesController({node: {}});

    var req = {
      body: {
        'address': address,
        'signature': signature,
        'message': 'wrong message'
      },
      query: {}
    };
    var res = {
      json: function(data) {
        data.result.should.equal(false);
        done();
      }
    };

    controller.verify(req, res);
  });

  it('handle an error from message verification', function(done) {
    var controller = new MessagesController({node: {}});
    var req = {
      body: {
        'address': badAddress,
        'signature': signature,
        'message': message
      },
      query: {}
    };
    var send = sinon.stub();
    var status = sinon.stub().returns({send: send});
    var res = {
      status: status,
    };
    controller.verify(req, res);
    status.args[0][0].should.equal(400);
    send.args[0][0].should.equal('Unexpected error: Checksum mismatch. Code:1');
    done();
  });

  it('handle error with missing parameters', function(done) {
    var controller = new MessagesController({node: {}});
    var req = {
      body: {},
      query: {}
    };
    var send = sinon.stub();
    var status = sinon.stub().returns({send: send});
    var res = {
      status: status
    };
    controller.verify(req, res);
    status.args[0][0].should.equal(400);
    send.args[0][0].should.match(/^Missing parameters/);
    done();
  });

});
