#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var assert = require('assert'),
    config = require('../../config/config'),
    messages = require('../../app/controllers/messages'),
    correctMessage = 'test2',
    correctAddress,
    correctSignature;

if(config.network === 'livenet') {
  correctAddress = '16Q7eRty2LrpAWvP3VTtaXXCMZj2v4xm57',
  correctSignature = 'HERpcxkyOezkBPPwvUUAaxYXR/9X/8eyVjp8WKGYl7Aw8'
                     + 'pMsiMXDWXf8G1t/SOUEWy94I+KA/SrBKYs2LfIHA0Q=';
} else {
  correctAddress = 'mhtJo5nZLcreM5Arrf8EDABpCevp2MfmCW',
  correctSignature = 'G/y2UhjZ4qBPLQGmOhl/4p/EIwTHIO1iq95kPxDk9RjYr'
                     + '1JKL6dsCSuhXat7VLTGwAM3PdgRh/jwGxi6x6dNeSE=';
}

function createMockReq(body) {
  // create a simplified mock of express' request object, suitable for the
  // needs of test cases in this file
  return  {
    body: body,
    param: function(name) {
      return this.body[name];
    }
  };
}

describe('messages.verify', function() {

  it('should return true with correct message', function(done) {
    var mockReq = createMockReq({
      address: correctAddress,
      signature: correctSignature,
      message: correctMessage
    });
    var mockRes = {
      json: function(data) {
        assert.deepEqual(data, {
          result: true,
        });
        done();
      }
    };
    messages.verify(mockReq, mockRes);
  });

  it('should return false with incorrect message', function(done) {
    var mockReq = createMockReq({
      address: correctAddress,
      signature: correctSignature,
      message: 'NOPE'
    });
    var mockRes = {
      json: function(data) {
        assert.deepEqual(data, {
          result: false,
        });
        done();
      }
    };

    messages.verify(mockReq, mockRes);
  });

  it('should return error with incorrect parameters', function(done) {
    var mockReq = createMockReq({
      address: correctAddress,
      message: correctMessage
    });
    var mockRes = {
      status: function(code) {
        assert.equal(code, 400);
        return this;
      },
      send: function(data) {
        assert.ok(data.match(/^Missing parameters/),
                             "Match not found, got '" + data + "' instead")
        done();
      }
    };
    messages.verify(mockReq, mockRes);
  });

});
