'use strict';

var chai = require('chai');
var should = chai.should;
var expect = chai.expect;
var sinon = require('sinon');

var socket = require('../app/controllers/socket');
var bitcore = require('bitcore');
var EventEmitter = require('events').EventEmitter;

describe('socket server', function() {
  it('should be able to call init with no args', function() {
    socket.init.should.not.throw();
  });
  it('should register socket handlers', function() {
    var io = {
      sockets: new EventEmitter(),
    }
    socket.init(io);

    var mockSocket = {};
    mockSocket.on = sinon.spy(); 
    io.sockets.emit('connection', mockSocket);
    mockSocket.on.calledWith('subscribe');
    mockSocket.on.calledWith('sync');
    mockSocket.on.calledWith('message');
  });

});
