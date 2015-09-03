'use strict';

var sinon = require('sinon');
var should = require('should');
var StatusController = require('../lib/status');

describe('Status', function() {
  describe('/status', function() {
    var info = {
      version: 110000,
      protocolversion: 70002,
      blocks: 548645,
      timeoffset: 0,
      connections: 8,
      difficulty: 21546.906405522557,
      testnet: true,
      relayfee: 1000,
      errors: ''
    };

    var node = {
      services: {
        bitcoind: {
          getInfo: sinon.stub().returns(info)
        }
      }
    };

    var status = new StatusController(node);

    it('getInfo', function(done) {
      var req = {
        query: {}
      };
      var res = {
        jsonp: function(data) {
          should.exist(data.info.version);
          should.exist(data.info.protocolversion);
          should.exist(data.info.blocks);
          should.exist(data.info.timeoffset);
          should.exist(data.info.connections);
          should.exist(data.info.difficulty);
          should.exist(data.info.testnet);
          should.exist(data.info.relayfee);
          done();
        }
      };

      status.show(req, res);
    });

    it('getDifficulty', function(done) {
      var req = {
        query: {
          q: 'getDifficulty'
        }
      };
      var res = {
        jsonp: function(data) {
          data.difficulty.should.equal(info.difficulty);
          done();
        }
      };

      status.show(req, res);
    });
  });

  describe('/sync', function() {
    it('should have correct data', function(done) {
      var node = {
        services: {
          db: {
            tip: {
              __height: 500000
            }
          },
          bitcoind: {
            height: 500000,
            isSynced: sinon.stub().returns(true)
          }
        }
      };

      var expected = {
        status: 'finished',
        blockChainHeight: 500000,
        syncPercentage: 100,
        height: 500000,
        error: null,
        type: 'bitcore node'
      };

      var status = new StatusController(node);

      var req = {};
      var res = {
        jsonp: function(data) {
          should(data).eql(expected);
          done();
        }
      };
      status.sync(req, res);
    });
  });

  describe('/peer', function() {
    it('should have correct data', function(done) {
      var node = {};

      var expected = {
        connected: true,
        host: '127.0.0.1',
        port: null
      };

      var req = {};
      var res = {
        jsonp: function(data) {
          should(data).eql(expected);
          done();
        }
      };

      var status = new StatusController(node);

      status.peer(req, res);
    });
  });

  describe('/version', function() {
    it('should have correct data', function(done) {
      var node = {};
      var expected = {
        version: '0.3.0'
      };

      var req = {};
      var res = {
        jsonp: function(data) {
          should(data).eql(expected);
          done();
        }
      };

      var status = new StatusController(node);
      status.version(req, res);
    });
  });
});