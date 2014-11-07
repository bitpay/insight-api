'use strict';

var chai = require('chai');
var assert = require('assert');
var sinon = require('sinon');
var crypto = require('crypto');
var bitcore = require('bitcore');
var logger = require('../lib/logger').logger;
var should = chai.should;
var expect = chai.expect;

logger.transports.console.level = 'non';

describe('emailstore test', function() {

  var globalConfig = require('../config/config');

  // Mock components of plugin
  var leveldb_stub = sinon.stub();
  leveldb_stub.put = sinon.stub();
  leveldb_stub.get = sinon.stub();
  leveldb_stub.remove = sinon.stub();
  var email_stub = sinon.stub();
  email_stub.sendMail = sinon.stub();

  var cryptoMock = {
    randomBytes: sinon.stub()
  };

  var plugin = require('../plugins/emailstore');
  var express_mock = null;
  var request = null;
  var response = null;

  beforeEach(function() {

    plugin.init({
      db: leveldb_stub,
      emailTransport: email_stub,
      crypto: cryptoMock
    });

    request = sinon.stub();
    request.on = sinon.stub();
    request.param = sinon.stub();
    response = sinon.stub();
    response.send = sinon.stub();
    response.status = sinon.stub();
    response.json = sinon.stub();
    response.end = sinon.stub();
    response.redirect = sinon.stub();
  });

  it('initializes correctly', function() {
    assert(plugin.db === leveldb_stub);
  });

  describe('database queries', function() {

    describe('exists', function() {
      var fakeEmail = 'fake@email.com';
      var fakeEmailKey = 'email-to-passphrase-' + bitcore.util.twoSha256(fakeEmail).toString('hex');

      beforeEach(function() {
        leveldb_stub.get.reset();
      });

      it('validates that an email is already registered', function(done) {
        leveldb_stub.get.onFirstCall().callsArg(1);

        plugin.exists(fakeEmail, function(err, exists) {
          leveldb_stub.get.firstCall.args[0].should.equal(fakeEmailKey);
          exists.should.equal(true);
          done();
        });
      });

      it('returns false when an email doesn\'t exist', function(done) {
        leveldb_stub.get.onFirstCall().callsArgWith(1, {notFound: true});

        plugin.exists(fakeEmail, function(err, exists) {
          leveldb_stub.get.firstCall.args[0].should.equal(fakeEmailKey);
          exists.should.equal(false);
          done();
        });
      });

      it('returns an internal error if database query couldn\'t be made', function(done) {
        leveldb_stub.get.onFirstCall().callsArgWith(1, 'error');
        plugin.exists(fakeEmail, function(err, exists) {
          err.should.equal(plugin.errors.INTERNAL_ERROR);
          done();
        });
      });
    });

    describe('passphrase', function() {
      var fakeEmail = 'fake@email.com';
      var fakePassphrase = 'secretPassphrase123';

      beforeEach(function() {
        leveldb_stub.get.reset();
        leveldb_stub.put.reset();
      });

      it('returns true if passphrase matches', function(done) {
        leveldb_stub.get.onFirstCall().callsArgWith(1, null, fakePassphrase);

        plugin.checkPassphrase(fakeEmail, fakePassphrase, function(err, result) {
          result.should.equal(true);
          done();
        });
      });

      it('returns false if passphrsase doesn\'t match', function(done) {
        leveldb_stub.get.onFirstCall().callsArgWith(1, null, 'invalid passphrase');

        plugin.checkPassphrase(fakeEmail, fakePassphrase, function(err, result) {
          result.should.equal(false);
          done();
        });
      });

      it('returns an internal error if database query couldn\'t be made', function(done) {
        leveldb_stub.get.onFirstCall().callsArgWith(1, 'error');

        plugin.checkPassphrase(fakeEmail, fakePassphrase, function(err) {
          err.should.equal(plugin.errors.INTERNAL_ERROR);
          done();
        });
      });

      it('stores passphrase correctly', function(done) {
        leveldb_stub.put.onFirstCall().callsArg(2);

        plugin.savePassphrase(fakeEmail, fakePassphrase, function(err) {
          expect(err).to.equal(null);
          done();
        });
      });

      it('doesn\'t store the email in the key', function(done) {
        leveldb_stub.put.onFirstCall().callsArg(2);

        plugin.savePassphrase(fakeEmail, fakePassphrase, function(err) {
          leveldb_stub.put.firstCall.args[0].should.not.contain(fakeEmail);
          done();
        });
      });

      it('returns internal error on database error', function(done) {
        leveldb_stub.put.onFirstCall().callsArgWith(2, 'error');

        plugin.savePassphrase(fakeEmail, fakePassphrase, function(err) {
          err.should.equal(plugin.errors.INTERNAL_ERROR);
          done();
        });
      });
    });

    describe('saving encrypted data', function() {
      var fakeEmail = 'fake@email.com';
      var fakeKey = 'nameForData';
      var fakeRecord = 'fakeRecord';
      var expectedKey = 'emailstore-'
                      + bitcore.util.twoSha256(fakeEmail + '#' + fakeKey).toString('hex');

      beforeEach(function() {
        leveldb_stub.get.reset();
        leveldb_stub.put.reset();
      });

      it('saves data under the expected key', function(done) {
        leveldb_stub.put.onFirstCall().callsArgWith(2);

        plugin.saveEncryptedData(fakeEmail, fakeKey, fakeRecord, function(err) {
          leveldb_stub.put.firstCall.args[0].should.equal(expectedKey);
          done();
        });
      });

      it('fails with INTERNAL_ERROR on database error', function(done) {
        leveldb_stub.put.onFirstCall().callsArgWith(2, 'error');

        plugin.saveEncryptedData(fakeEmail, fakeKey, fakeRecord, function(err) {
          err.should.equal(plugin.errors.INTERNAL_ERROR);
          done();
        });
      });
    });

    describe('creating verification secret', function() {
      var sendVerificationEmail = sinon.stub(plugin, 'sendVerificationEmail');
      var fakeEmail = 'fake@email.com';
      var fakeRandom = 'fakerandom';
      var randomBytes = {toString: function() { return fakeRandom; }};

      beforeEach(function() {
        leveldb_stub.get.reset();
        leveldb_stub.put.reset();

        sendVerificationEmail.reset();
        cryptoMock.randomBytes = sinon.stub();
        cryptoMock.randomBytes.onFirstCall().returns(randomBytes);
      });

      var setupLevelDb = function() {
        leveldb_stub.get.onFirstCall().callsArgWith(1, {notFound: true});
        leveldb_stub.put.onFirstCall().callsArg(2);
      };

      it('saves data under the expected key', function(done) {
        setupLevelDb();

        plugin.createVerificationSecretAndSendEmail(fakeEmail, function(err) {
          leveldb_stub.put.firstCall.args[1].should.equal(fakeRandom);
          done();
        });
      });
      it('calls the function to verify the email', function(done) {
        setupLevelDb();

        plugin.createVerificationSecretAndSendEmail(fakeEmail, function(err) {
          sendVerificationEmail.calledOnce;
          done();
        });
      });
      it('returns internal error on put database error', function(done) {
        leveldb_stub.get.onFirstCall().callsArgWith(1, {notFound: true});
        leveldb_stub.put.onFirstCall().callsArgWith(2, 'error');
        plugin.createVerificationSecretAndSendEmail(fakeEmail, function(err) {
          err.should.equal(plugin.errors.INTERNAL_ERROR);
          done();
        });
      });
      it('returns internal error on get database error', function(done) {
        leveldb_stub.get.onFirstCall().callsArgWith(1, 'error');
        plugin.createVerificationSecretAndSendEmail(fakeEmail, function(err) {
          err.should.equal(plugin.errors.INTERNAL_ERROR);
          done();
        });
      });

      after(function() {
        plugin.sendVerificationEmail.restore();
      });
    });
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
      plugin.getCredentialsFromRequest = sinon.mock();
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: emailParam,
        passphrase: secretParam
      });
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
      plugin.getCredentialsFromRequest = sinon.mock();
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: emailParam,
        passphrase: secretParam
      });
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
      leveldb_stub.remove = sinon.stub();
      leveldb_stub.put.onFirstCall().callsArg(2);
      leveldb_stub.remove.onFirstCall().callsArg(1);
      response.json.returnsThis();
    });

    it('should validate correctly an email if the secret matches', function() {
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, secret);
      response.redirect = sinon.stub();

      plugin.validate(request, response);

      assert(response.redirect.firstCall.calledWith(plugin.redirectUrl));
    });

    it('should fail to validate an email if the secret doesn\'t match', function() {
      var invalid = '3';
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, invalid);
      response.status.returnsThis();
      response.json.returnsThis();

      plugin.validate(request, response);

      assert(response.status.firstCall.calledWith(plugin.errors.INVALID_CODE.code));
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

  describe('changing the user password', function() {

    var originalCredentials = plugin.getCredentialsFromRequest;

    beforeEach(function() {
      plugin.getCredentialsFromRequest = sinon.mock();
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: 'email',
        passphrase: 'passphrase'
      });
      request.on = sinon.stub();
      request.on.onFirstCall().callsArgWith(1, 'newPassphrase=newPassphrase');
      request.on.onFirstCall().returns(request);
      request.on.onSecondCall().callsArg(1);
      response.status.onFirstCall().returnsThis();
      plugin.checkPassphrase = sinon.stub();
      plugin.savePassphrase = sinon.stub();
    });

    it('should validate the previous passphrase', function() {
      response.status.onFirstCall().returnsThis();
      response.json.onFirstCall().returnsThis();
      plugin.checkPassphrase.onFirstCall().callsArgWith(2, 'error');

      plugin.changePassphrase(request, response);

      assert(response.status.calledOnce);
      assert(response.json.calledOnce);
      assert(response.end.calledOnce);
    });

    it('should change the passphrase', function() {
      response.json.onFirstCall().returnsThis();
      plugin.checkPassphrase.onFirstCall().callsArgWith(2, null);
      plugin.savePassphrase.onFirstCall().callsArgWith(2, null);

      plugin.changePassphrase(request, response);
      assert(response.json.calledOnce);
      assert(response.end.calledOnce);
    });

    after(function() {
      plugin.getCredentialsFromRequest = originalCredentials;
    });
  });
});

