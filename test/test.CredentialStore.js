'use strict';

var chai = require('chai');
var assert = require('assert');
var sinon = require('sinon');
var should = chai.should;
var expect = chai.expect;

describe('credentialstore test', function() {

  var globalConfig = require('../config/config');
  var leveldb_stub = sinon.stub();
  leveldb_stub.post = sinon.stub();
  leveldb_stub.get = sinon.stub();
  var plugin = require('../plugins/credentialstore');
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
      globalConfig.apiPrefix + '/credentials', plugin.post
    ));
    assert(express_mock.get.calledWith(
      globalConfig.apiPrefix + '/credentials/:username', plugin.get
    ));
  });

  it('writes a message correctly', function() {

    var data = 'username=1&secret=2&record=3';
    request.on.onFirstCall().callsArgWith(1, data);
    request.on.onFirstCall().returnsThis();
    request.on.onSecondCall().callsArg(1);
    leveldb_stub.put = sinon.stub();

    leveldb_stub.put.onFirstCall().callsArg(2);
    response.json.returnsThis();

    plugin.post(request, response);

    assert(leveldb_stub.put.firstCall.args[0] === 'credentials-store-12');
    assert(leveldb_stub.put.firstCall.args[1] === '3');
    assert(response.json.calledWith({success: true}));
  });

  it('retrieves a message correctly', function() {

    request.param.onFirstCall().returns('username');
    request.param.onSecondCall().returns('secret');

    var returnValue = '!@#$%';
    leveldb_stub.get.onFirstCall().callsArgWith(1, null, returnValue);
    response.send.returnsThis();

    plugin.get(request, response);

    assert(leveldb_stub.get.firstCall.args[0] === 'credentials-store-usernamesecret');
    assert(response.send.calledWith(returnValue));
    assert(response.end.calledOnce);
  });

  it('fails with messages that are too long', function() {

    response.writeHead = sinon.stub();
    request.connection = {};
    request.connection.destroy = sinon.stub();
    var data = 'blob';
    for (var i = 0; i < 2048; i++) {
      data += '----';
    }
    request.on.onFirstCall().callsArgWith(1, data);
    request.on.onFirstCall().returnsThis();
    response.writeHead.returnsThis();

    plugin.post(request, response);

    assert(response.writeHead.calledWith(413, {'Content-Type': 'text/plain'}));
    assert(response.end.calledOnce);
    assert(request.connection.destroy.calledOnce);
  });
});
