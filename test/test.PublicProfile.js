'use strict';

var chai = require('chai');
var assert = require('assert');
var sinon = require('sinon');
var should = chai.should;
var expect = chai.expect;
var bitauth = require('bitauth');

describe('public profile test', function() {

  var globalConfig = require('../config/config');
  var leveldb_stub = sinon.stub();
  leveldb_stub.put = sinon.stub();
  leveldb_stub.get = sinon.stub();
  var plugin = require('../plugins/publicInfo/publicInfo.js');
  var express_mock = null;
  var request = null;
  var response = null;

  beforeEach(function() {

    express_mock = sinon.stub();
    express_mock.post = sinon.stub();
    express_mock.get = sinon.stub();

    plugin.init(express_mock, {db: leveldb_stub});

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
    assert(express_mock.post.calledWith(
      globalConfig.apiPrefix + '/public', plugin.post
    ));
    assert(express_mock.get.calledWith(
      globalConfig.apiPrefix + '/public/:sin', plugin.get
    ));
  });

  it('writes a message correctly', function(done) {

    var privateKey = bitauth.generateSin();
    var protocol = 'https';
    var dataToSign = protocol + '://hosturlSTUFF';
    var signature = bitauth.sign(dataToSign, privateKey.priv);
    request.get = function() { return 'host'; };
    request.protocol = protocol;
    request.url = 'url';
    request.headers = {
      'x-identity': privateKey.pub,
      'x-signature': signature
    };
    request.on.onFirstCall().callsArgWith(1, 'STUFF');
    request.on.onFirstCall().returnsThis();
    request.on.onSecondCall().callsArg(1);

    leveldb_stub.put.onFirstCall().callsArg(2);
    response.status.returns(response);
    response.json.returns(response);

    request.testCallback =  function() {
      assert(leveldb_stub.put.firstCall.args[0] === 'public-info-' + privateKey.sin);
      assert(leveldb_stub.put.firstCall.args[1] === 'STUFF');
      assert(response.json.calledOnce);
      assert(response.end.calledOnce);
      done();
    };

    plugin.post(request, response);
  });

  it('fails if the signature is invalid', function() {
    var data = 'uecord3';
    request.get = function() { return ''; };
    request.headers = {};
    request.on.onFirstCall().callsArgWith(1, data);
    request.on.onFirstCall().returnsThis();
    request.on.onSecondCall().callsArg(1);
    leveldb_stub.put = sinon.stub();

    leveldb_stub.put.onFirstCall().callsArg(2);
    response.json.returnsThis();
    response.status.returnsThis();

    plugin.post(request, response);

    assert(response.end.calledOnce);
  });

  it('retrieves a message correctly', function() {

    request.param.onFirstCall().returns('SIN');

    var returnValue = '!@#$%';
    leveldb_stub.get.onFirstCall().callsArgWith(1, null, returnValue);
    response.send.returnsThis();

    plugin.get(request, response);

    assert(leveldb_stub.get.firstCall.args[0] === 'public-info-SIN');
    assert(response.send.calledWith(returnValue));
    assert(response.end.calledOnce);
  });
});
