'use strict';

var   chai = require('chai'),
    assert = require('assert'),
     sinon = require('sinon'),
    logger = require('../lib/logger').logger,
    should = chai.should,
    expect = chai.expect;

logger.transports.console.level = 'warn';

describe('emailstore test', function() {

  var globalConfig = require('../config/config');

  // Mock components of plugin
  var leveldb_stub = sinon.stub();
  leveldb_stub.put = sinon.stub();
  leveldb_stub.get = sinon.stub();
  var email_stub = sinon.stub();
  email_stub.sendMail = sinon.stub();

  var plugin = require('../plugins/emailstore');
  var express_mock = null;
  var request = null;
  var response = null;

  beforeEach(function() {

    // Mock request and response objects (but don't configure behavior)
    express_mock = sinon.stub();
    express_mock.post = sinon.stub();
    express_mock.get = sinon.stub();

    plugin.init(express_mock, {db: leveldb_stub, emailTransport: email_stub});

    request = sinon.stub();
    request.on = sinon.stub();
    request.param = sinon.stub();
    response = sinon.stub();
    response.send = sinon.stub();
    response.status = sinon.stub();
    response.json = sinon.stub();
    response.end = sinon.stub();
  });

  it('initializes correctly', function() {
    assert(plugin.db === leveldb_stub);
  });

  describe('on registration', function() {

    beforeEach(function() {
      var data = 'email=1&secret=2&record=3';
      request.on.onFirstCall().callsArgWith(1, data);
      request.on.onFirstCall().returnsThis();
      request.on.onSecondCall().callsArg(1);
      leveldb_stub.get.onFirstCall().callsArg(1);
      leveldb_stub.get.onSecondCall().callsArg(1);
      leveldb_stub.put.onFirstCall().callsArg(2);
      leveldb_stub.put.onSecondCall().callsArg(2);
      response.json.returnsThis();
    });

    it('should store the credentials correctly and generate a secret', function() {

      plugin.post(request, response);

      assert(leveldb_stub.put.getCall(0).args[0] === 'credentials-store-2');
      assert(leveldb_stub.put.getCall(0).args[1] === '3');
      assert(leveldb_stub.put.getCall(1).args[0].indexOf('validation-code-1') === 0);
      assert(leveldb_stub.put.getCall(1).args[1]);
      assert(response.json.calledWith({success: true}));
    });

    it('should send an email on registration', function() {

      plugin.post(request, response);

      assert(plugin.email.sendMail);
      assert(plugin.email.sendMail.firstCall.args.length === 2);
      assert(plugin.email.sendMail.firstCall.args[0].to === '1');
    });

    it('should allow the user to retrieve credentials', function() {
      request.param.onFirstCall().returns('secret');
      leveldb_stub.get.reset();

      var returnValue = '!@#$%';
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, returnValue);
      response.send.returnsThis();
  
      plugin.get(request, response);
  
      assert(leveldb_stub.get.firstCall.args[0] === 'credentials-store-secret');
      assert(response.send.calledWith(returnValue));
      assert(response.end.calledOnce);
    });
  });

  describe('when validating email', function() {

    var email = '1';
    var secret = '2';
    beforeEach(function() {

      request.param.onFirstCall().returns(email);
      request.param.onSecondCall().returns(secret);
      leveldb_stub.put = sinon.stub();
      leveldb_stub.get = sinon.stub();
      leveldb_stub.put.onFirstCall().callsArg(2);
      response.json.returnsThis();
    });

    it('should validate correctly an email if the secret matches', function() {
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, secret);

      plugin.validate(request, response);

      assert(response.json.firstCall.calledWith({success: true}));
    });

    it('should fail to validate an email if the secrent doesn\'t match', function() {
      var invalid = '3';
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, invalid);
      response.status.returnsThis();
      response.json.returnsThis();

      plugin.validate(request, response);

      assert(response.status.firstCall.calledWith(400));
      assert(response.json.firstCall.calledWith({error: 'The provided code is invalid'}));
      assert(response.end.calledOnce);
    });
  });

  describe('when validating registration data', function() {

    beforeEach(function() {
      var data = 'email=1&secret=2&record=3';
      request.on.onFirstCall().callsArgWith(1, data);
      request.on.onFirstCall().returnsThis();
      request.on.onSecondCall().callsArg(1);
      leveldb_stub.put = sinon.stub();
      leveldb_stub.get = sinon.stub();
      leveldb_stub.put.onFirstCall().callsArg(2);
      leveldb_stub.put.onSecondCall().callsArg(2);
      response.status.returnsThis();
      response.json.returnsThis();
    });

    it('should\'nt allow the user to register with an already validated email', function() {
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, {});

      plugin.post(request, response);

      assert(response.status.firstCall.calledWith(409));
      assert(response.json.firstCall.calledWith({error: 'That email is already registered'}));
      assert(response.end.calledOnce);
    });

    it('should\'nt allow the user to register with a pending validation email', function() {
      leveldb_stub.get.onFirstCall().callsArg(1);
      leveldb_stub.get.onSecondCall().callsArgWith(1, null, {});

      plugin.post(request, response);

      assert(response.status.firstCall.args[0] === 409);
      assert(response.json.firstCall.calledWith({error: 'That email is already registered'}));
      assert(response.end.calledOnce);
    });

  });
});

