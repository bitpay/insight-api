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

    var emailParam = 'email';
    var secretParam = 'secret';
    var keyParam = 'key';
    var recordParam = 'record';
    beforeEach(function() {
      var data = ('email=' + emailParam + '&secret=' + secretParam
                  + '&record=' + recordParam + '&key=' + keyParam);
      request.on.onFirstCall().callsArgWith(1, data);
      request.on.onFirstCall().returnsThis();
      request.on.onSecondCall().callsArg(1);
      response.json.returnsThis();
    });

    it('should allow new registrations', function() {
      plugin.exists = sinon.stub();
      plugin.exists.onFirstCall().callsArgWith(1, null, false);
      plugin.savePassphrase = sinon.stub();
      plugin.savePassphrase.onFirstCall().callsArg(2);
      plugin.saveEncryptedData = sinon.stub();
      plugin.saveEncryptedData.onFirstCall().callsArg(3);
      plugin.createVerificationSecretAndSendEmail = sinon.stub();
      plugin.createVerificationSecretAndSendEmail.onFirstCall().callsArg(1);
      response.send.onFirstCall().returnsThis();

      plugin.post(request, response);

      assert(plugin.exists.firstCall.args[0] === emailParam);
      assert(plugin.savePassphrase.firstCall.args[0] === emailParam);
      assert(plugin.savePassphrase.firstCall.args[1] === secretParam);
      assert(plugin.saveEncryptedData.firstCall.args[0] === emailParam);
      assert(plugin.saveEncryptedData.firstCall.args[1] === keyParam);
      assert(plugin.saveEncryptedData.firstCall.args[2] === recordParam);
      assert(plugin.createVerificationSecretAndSendEmail.firstCall.args[0] === emailParam);
    });

    it('should allow to overwrite data', function() {
      plugin.exists = sinon.stub();
      plugin.exists.onFirstCall().callsArgWith(1, null, true);
      plugin.checkPassphrase = sinon.stub();
      plugin.checkPassphrase.onFirstCall().callsArgWith(2, null, true);
      plugin.saveEncryptedData = sinon.stub();
      plugin.saveEncryptedData.onFirstCall().callsArg(3);
      plugin.createVerificationSecretAndSendEmail = sinon.stub();
      plugin.createVerificationSecretAndSendEmail.onFirstCall().callsArg(1);
      response.send.onFirstCall().returnsThis();

      plugin.post(request, response);

      assert(plugin.exists.firstCall.args[0] === emailParam);
      assert(plugin.checkPassphrase.firstCall.args[0] === emailParam);
      assert(plugin.checkPassphrase.firstCall.args[1] === secretParam);
      assert(plugin.saveEncryptedData.firstCall.args[0] === emailParam);
      assert(plugin.saveEncryptedData.firstCall.args[1] === keyParam);
      assert(plugin.saveEncryptedData.firstCall.args[2] === recordParam);
      assert(plugin.createVerificationSecretAndSendEmail.firstCall.args[0] === emailParam);
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

  describe('when retrieving data', function() {

    it('should validate the secret and return the data', function() {
      request.param.onFirstCall().returns('email');
      request.param.onSecondCall().returns('key');
      request.param.onThirdCall().returns('secret');
      plugin.retrieveDataByEmailAndPassphrase = sinon.stub();
      plugin.retrieveDataByEmailAndPassphrase.onFirstCall().callsArgWith(3, null, 'encrypted');
      response.send.onFirstCall().returnsThis();

      plugin.get(request, response);

      assert(request.param.firstCall.args[0] === 'email');
      assert(request.param.secondCall.args[0] === 'key');
      assert(request.param.thirdCall.args[0] === 'secret');
      assert(plugin.retrieveDataByEmailAndPassphrase.firstCall.args[0] === 'email');
      assert(plugin.retrieveDataByEmailAndPassphrase.firstCall.args[1] === 'key');
      assert(plugin.retrieveDataByEmailAndPassphrase.firstCall.args[2] === 'secret');
      assert(response.send.firstCall.args[0] === 'encrypted');
      assert(response.end.calledOnce);
    });
  });
});

