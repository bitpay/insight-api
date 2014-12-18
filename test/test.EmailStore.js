'use strict';

var chai = require('chai');
var assert = require('assert');
var sinon = require('sinon');
var crypto = require('crypto');
var bitcore = require('bitcore');
var logger = require('../lib/logger').logger;
var should = chai.should;
var expect = chai.expect;
var moment = require('moment');

logger.transports.console.level = 'non';

describe('emailstore test', function() {

  var globalConfig = require('../config/config');

  // Mock components of plugin
  var leveldb_stub = sinon.stub();
  leveldb_stub.put = sinon.stub();
  leveldb_stub.get = sinon.stub();
  leveldb_stub.del = sinon.stub();
  var email_stub = sinon.stub();
  email_stub.sendMail = sinon.stub().callsArg(1);

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
    response.status = sinon.stub().returns({
      json: function() {
        return {
          end: function() {
          }
        }
      }
    });
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
        leveldb_stub.get.onFirstCall().callsArgWith(1, {
          notFound: true
        });

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
      var expectedKey = 'emailstore-' + bitcore.util.twoSha256(fakeEmail + '#' + fakeKey).toString('hex');

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
      var fakeEmail = 'fake@email.com';
      var fakeRandom = 'fakerandom';
      var randomBytes = {
        toString: function() {
          return fakeRandom;
        }
      };

      beforeEach(function() {
        leveldb_stub.get.reset();
        leveldb_stub.put.reset();
        plugin.email.sendMail.reset();

        cryptoMock.randomBytes = sinon.stub();
        cryptoMock.randomBytes.onFirstCall().returns(randomBytes);
      });

      var setupLevelDb = function() {
        leveldb_stub.get.onFirstCall().callsArgWith(1, {
          notFound: true
        });
        leveldb_stub.put.onFirstCall().callsArg(2);
      };

      it('saves data under the expected key', function(done) {
        setupLevelDb();
        var clock = sinon.useFakeTimers();
        plugin.createVerificationSecretAndSendEmail(fakeEmail, function(err) {
          var arg = JSON.parse(leveldb_stub.put.firstCall.args[1]);
          arg.secret.should.equal(fakeRandom);
          arg.created.should.equal(moment().unix());
          clock.restore();
          done();
        });
      });
      it('sends verification email', function(done) {
        setupLevelDb();

        plugin.createVerificationSecretAndSendEmail(fakeEmail, function(err) {
          plugin.email.sendMail.calledOnce.should.be.true;
          done();
        });
      });
      it('returns internal error on put database error', function(done) {
        leveldb_stub.get.onFirstCall().callsArgWith(1, {
          notFound: true
        });
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
    });
  });

  describe('on registration', function() {
    var emailParam = 'email';
    var secretParam = 'secret';
    var keyParam = 'key';
    var recordParam = 'record';
    beforeEach(function() {
      var data = ('email=' + emailParam + '&secret=' + secretParam + '&record=' + recordParam + '&key=' + keyParam);
      request.on.onFirstCall().callsArgWith(1, data);
      request.on.onFirstCall().returnsThis();
      request.on.onSecondCall().callsArg(1);
      response.json.returnsThis();
    });

    it('should allow new registrations', function() {
      var originalCredentials = plugin.getCredentialsFromRequest;
      plugin.getCredentialsFromRequest = sinon.mock();
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: emailParam,
        passphrase: secretParam
      });
      plugin.exists = sinon.stub();
      plugin.exists.onFirstCall().callsArgWith(1, null, false);
      plugin.savePassphrase = sinon.stub();
      plugin.savePassphrase.onFirstCall().callsArg(2);
      plugin.isConfirmed = sinon.stub();
      plugin.isConfirmed.onFirstCall().callsArgWith(1, null, false);
      plugin.checkSizeQuota = sinon.stub();
      plugin.checkSizeQuota.onFirstCall().callsArgWith(3, null);
      plugin.checkAndUpdateItemQuota = sinon.stub();
      plugin.checkAndUpdateItemQuota.onFirstCall().callsArgWith(3, null);
      plugin.saveEncryptedData = sinon.stub();
      plugin.saveEncryptedData.onFirstCall().callsArg(3);
      plugin.createVerificationSecretAndSendEmail = sinon.stub();
      plugin.createVerificationSecretAndSendEmail.onFirstCall().callsArg(1);
      response.send.onFirstCall().returnsThis();

      plugin.save(request, response);

      assert(plugin.exists.firstCall.args[0] === emailParam);
      assert(plugin.savePassphrase.firstCall.args[0] === emailParam);
      assert(plugin.savePassphrase.firstCall.args[1] === secretParam);
      assert(plugin.saveEncryptedData.firstCall.args[0] === emailParam);
      assert(plugin.saveEncryptedData.firstCall.args[1] === keyParam);
      assert(plugin.saveEncryptedData.firstCall.args[2] === recordParam);
      assert(plugin.createVerificationSecretAndSendEmail.firstCall.args[0] === emailParam);
      plugin.getCredentialsFromRequest = originalCredentials;
    });

    it('should allow to overwrite data', function() {
      var originalCredentials = plugin.getCredentialsFromRequest;
      plugin.getCredentialsFromRequest = sinon.mock();
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: emailParam,
        passphrase: secretParam
      });
      plugin.exists = sinon.stub();
      plugin.exists.onFirstCall().callsArgWith(1, null, true);
      plugin.checkPassphrase = sinon.stub();
      plugin.checkPassphrase.onFirstCall().callsArgWith(2, null, true);
      plugin.isConfirmed = sinon.stub();
      plugin.isConfirmed.onFirstCall().callsArgWith(1, null, false);
      plugin.checkSizeQuota = sinon.stub();
      plugin.checkSizeQuota.onFirstCall().callsArgWith(3, null);
      plugin.checkAndUpdateItemQuota = sinon.stub();
      plugin.checkAndUpdateItemQuota.onFirstCall().callsArgWith(3, null);
      plugin.saveEncryptedData = sinon.stub();
      plugin.saveEncryptedData.onFirstCall().callsArg(3);
      plugin.createVerificationSecretAndSendEmail = sinon.stub();
      response.send.onFirstCall().returnsThis();

      plugin.save(request, response);

      assert(plugin.exists.firstCall.args[0] === emailParam);
      assert(plugin.checkPassphrase.firstCall.args[0] === emailParam);
      assert(plugin.checkPassphrase.firstCall.args[1] === secretParam);
      assert(plugin.saveEncryptedData.firstCall.args[0] === emailParam);
      assert(plugin.saveEncryptedData.firstCall.args[1] === keyParam);
      assert(plugin.saveEncryptedData.firstCall.args[2] === recordParam);
      plugin.createVerificationSecretAndSendEmail.called.should.be.false;
      plugin.getCredentialsFromRequest = originalCredentials;
    });

    it('should delete profile on error sending verification email', function() {
      var originalCredentials = plugin.getCredentialsFromRequest;
      plugin.getCredentialsFromRequest = sinon.mock();
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: emailParam,
        passphrase: secretParam
      });
      plugin.exists = sinon.stub();
      plugin.exists.onFirstCall().callsArgWith(1, null, false);
      plugin.savePassphrase = sinon.stub();
      plugin.savePassphrase.onFirstCall().callsArg(2);
      plugin.isConfirmed = sinon.stub();
      plugin.isConfirmed.onFirstCall().callsArgWith(1, null, false);
      plugin.checkSizeQuota = sinon.stub();
      plugin.checkSizeQuota.onFirstCall().callsArgWith(3, null);
      plugin.checkAndUpdateItemQuota = sinon.stub();
      plugin.checkAndUpdateItemQuota.onFirstCall().callsArgWith(3, null);
      plugin.saveEncryptedData = sinon.stub();
      plugin.saveEncryptedData.onFirstCall().callsArg(3);
      plugin.createVerificationSecretAndSendEmail = sinon.stub();
      plugin.createVerificationSecretAndSendEmail.onFirstCall().callsArgWith(1, 'error');
      var deleteWholeProfile = sinon.stub(plugin, 'deleteWholeProfile');
      deleteWholeProfile.onFirstCall().callsArg(1);
      response.send.onFirstCall().returnsThis();

      plugin.save(request, response);

      assert(plugin.exists.firstCall.args[0] === emailParam);
      assert(plugin.savePassphrase.firstCall.args[0] === emailParam);
      assert(plugin.savePassphrase.firstCall.args[1] === secretParam);
      assert(plugin.saveEncryptedData.firstCall.args[0] === emailParam);
      assert(plugin.saveEncryptedData.firstCall.args[1] === keyParam);
      assert(plugin.saveEncryptedData.firstCall.args[2] === recordParam);
      assert(plugin.createVerificationSecretAndSendEmail.firstCall.args[0] === emailParam);
      assert(deleteWholeProfile.firstCall.args[0] === emailParam);
      plugin.getCredentialsFromRequest = originalCredentials;
    });

    after(function () {
      plugin.deleteWholeProfile.restore();
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
      leveldb_stub.del.onFirstCall().callsArg(1);
      response.json.returnsThis();
    });

    it('should validate correctly an email if the secret matches (secret only)', function() {
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, secret);
      leveldb_stub.del = sinon.stub().yields(null);
      response.redirect = sinon.stub();

      plugin.validate(request, response);

      assert(response.redirect.firstCall.calledWith(plugin.redirectUrl));
    });

    it('should validate correctly an email if the secret matches (secret + creation date)', function() {
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, JSON.stringify({
        secret: secret,
        created: moment().unix(),
      }));
      leveldb_stub.del = sinon.stub().yields(null);
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
      assert(response.json.firstCall.calledWith({
        error: 'The provided code is invalid'
      }));
      assert(response.end.calledOnce);
    });
  });

  describe('resend validation email', function () {
    var email = 'fake@email.com';
    var secret = '123';
    beforeEach(function() {
      leveldb_stub.get.reset();
      request.param.onFirstCall().returns(email);
      response.json.returnsThis();
      response.redirect = sinon.stub();
    });

    it('should resend validation email when pending', function () {
      plugin.authorizeRequestWithoutKey = sinon.stub().callsArgWith(1, null, email);
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, JSON.stringify({ secret: secret, created: new Date() }));
      plugin.sendVerificationEmail = sinon.spy();
      plugin.resendEmail(request, response);
      plugin.sendVerificationEmail.calledOnce.should.be.true;
      plugin.sendVerificationEmail.calledWith(email, secret).should.be.true;
    });

    it('should resend validation email when pending (old style secret)', function () {
      plugin.authorizeRequestWithoutKey = sinon.stub().callsArgWith(1, null, email);
      leveldb_stub.get.onFirstCall().callsArgWith(1, null, secret);
      plugin.sendVerificationEmail = sinon.spy();
      plugin.resendEmail(request, response);
      plugin.sendVerificationEmail.calledOnce.should.be.true;
      plugin.sendVerificationEmail.calledWith(email, secret).should.be.true;
    });

    it('should not resend when email is no longer pending', function () {
      plugin.authorizeRequestWithoutKey = sinon.stub().callsArgWith(1, null, email);
      leveldb_stub.get.onFirstCall().callsArgWith(1, { notFound: true });
      plugin.sendVerificationEmail = sinon.spy();
      plugin.resendEmail(request, response);
      plugin.sendVerificationEmail.should.not.be.called;
    });
  });

  describe('removing items', function() {
    var fakeEmail = 'fake@email.com';
    var fakeKey = 'nameForData';
    beforeEach(function() {
      leveldb_stub.del = sinon.stub();
    });
    it('deletes a stored element (key)', function(done) {
      leveldb_stub.del.onFirstCall().callsArg(1);

      plugin.checkAndUpdateItemCounter = sinon.stub();
      plugin.checkAndUpdateItemCounter.onFirstCall().callsArg(3);

      plugin.deleteByEmailAndKey(fakeEmail, fakeKey, function(err) {
        expect(err).to.be.undefined;
        done();
      });
    });
    it('returns NOT FOUND if trying to delete a stored element by key', function(done) {
      leveldb_stub.del.onFirstCall().callsArgWith(1, {notFound: true});
      plugin.deleteByEmailAndKey(fakeEmail, fakeKey, function(err) {
        err.should.equal(plugin.errors.NOT_FOUND);
        done();
      });
    });
    it('returns INTERNAL_ERROR if an unexpected error ocurrs', function(done) {
      leveldb_stub.del.onFirstCall().callsArgWith(1, {unexpected: true});
      plugin.deleteByEmailAndKey(fakeEmail, fakeKey, function(err) {
        err.should.equal(plugin.errors.INTERNAL_ERROR);
        done();
      });
    });
    it('can delete a whole profile (validation data and passphrase)', function(done) {
      leveldb_stub.del.callsArg(1);
      plugin.deleteWholeProfile(fakeEmail, function(err) {
        expect(err).to.be.undefined;
        leveldb_stub.del.callCount.should.equal(3);
        done();
      });
    });
    it('dismisses not found errors', function(done) {
      leveldb_stub.del.callsArg(1);
      leveldb_stub.del.onSecondCall().callsArgWith(1, {notFound: true});
      plugin.deleteWholeProfile(fakeEmail, function(err) {
        expect(err).to.be.undefined;
        done();
      });
    });
    it('returns internal error if something goes awry', function(done) {
      leveldb_stub.del.callsArg(1);
      leveldb_stub.del.onSecondCall().callsArgWith(1, {unexpected: true});
      plugin.deleteWholeProfile(fakeEmail, function(err) {
        err.should.equal(plugin.errors.INTERNAL_ERROR);
        done();
      });
    });
  });

  describe('when retrieving data', function() {

    it('should validate the secret and return the data', function() {
      request.param.onFirstCall().returns('key');
        
      plugin.authorizeRequestWithKey = sinon.stub().callsArgWith(1,null, 'email','key');
      plugin.retrieveByEmailAndKey = sinon.stub().yields(null, 'encrypted');

      response.send.onFirstCall().returnsThis();
      plugin.addValidationHeader = sinon.stub().callsArg(2);
      plugin.addValidationAndQuotaHeader = sinon.stub().callsArg(2);

      plugin.retrieve(request, response);

      response.send.calledOnce.should.equal(true);

      assert(plugin.retrieveByEmailAndKey.firstCall.args[0] === 'email');
      assert(plugin.retrieveByEmailAndKey.firstCall.args[1] === 'key');
      assert(response.send.firstCall.args[0] === 'encrypted');
      assert(response.end.calledOnce);
    });
  });


  describe('authorizing requests', function() {
    var originalCredentials;
    beforeEach(function() {
      originalCredentials = plugin.getCredentialsFromRequest;

      plugin.getCredentialsFromRequest = sinon.mock();
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: 'email',
        passphrase: 'pass' 
      });
      request.param.onFirstCall().returns('key');

      request.on = sinon.stub();
      request.on.onFirstCall().callsArgWith(1, 'newPassphrase=newPassphrase');
      request.on.onFirstCall().returns(request);
      request.on.onSecondCall().callsArg(1);
      plugin.checkPassphrase = sinon.stub().callsArgWith(2,null,  true);
 
    });

    it('should authorize a request', function(done){
      plugin.authorizeRequest(request, false, function(err, email, key) {
        expect(err).to.be.null;
        expect(key).to.be.undefined;
        email.should.be.equal('email');
        done();
      });
    });
    it('should authorize a request with key', function(done){
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: 'email',
        passphrase: 'pass',
      });
      plugin.authorizeRequest(request, true, function(err, email, key) {
        expect(err).to.be.null;
        email.should.be.equal('email');
        key.should.be.equal('key');
        done();
      });
    });
 
    it('should not authorize a request when param are missing', function(done){
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: 'email',
      });

      plugin.authorizeRequest(request, false, function(err, email, key) {
        expect(err).not.to.be.null;
        expect(key).to.be.undefined;
        expect(email).to.be.undefined;
        done();
      });
    });
    it('should not authorize a request when param are missing (case2)', function(done){
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        passphrase: 'pass' 
      });

      plugin.authorizeRequest(request, false, function(err, email, key) {
        expect(err).not.to.be.null;
        expect(key).to.be.undefined;
        expect(email).to.be.undefined;
        done();
      });
    });
    it('should not authorize a request when param are missing (case3)', function(done){
      request.param.onFirstCall().returns(undefined);
      plugin.getCredentialsFromRequest.onFirstCall().returns({
        email: 'email',
        passphrase: 'pass' 
      });
      plugin.authorizeRequest(request, true, function(err, email, key) {
        expect(err).not.to.be.null;
        expect(key).to.be.undefined;
        expect(email).to.be.undefined;
        done();
      });
    });


    after(function() {
      plugin.getCredentialsFromRequest = originalCredentials;
    });
  });

  describe('changing the user password', function() {


    beforeEach(function() {
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
      plugin.authorizeRequestWithoutKey = sinon.stub().callsArgWith(1,'error');

      plugin.changePassphrase(request, response);

      assert(response.status.calledOnce);
      assert(response.json.calledOnce);
      assert(response.end.calledOnce);
    });

    it('should change the passphrase', function() {
      response.json.onFirstCall().returnsThis();
      plugin.authorizeRequestWithoutKey = sinon.stub().callsArgWith(1,null, 'email');
      plugin.checkPassphrase.onFirstCall().callsArgWith(2, null);
      plugin.savePassphrase.onFirstCall().callsArgWith(2, null);

      plugin.changePassphrase(request, response);
      assert(response.json.calledOnce);
      assert(response.end.calledOnce);
    });
  });
});
