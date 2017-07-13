'use strict';

var sinon = require('sinon');
var should = require('should');
var StatusController = require('../lib/status');

describe('Status', function() {
  describe('/status', function() {
    var info = {
      version: 110000,
      protocolVersion: 70002,
      blocks: 548645,
      timeOffset: 0,
      connections: 8,
      difficulty: 21546.906405522557,
      testnet: true,
      relayFee: 1000,
      errors: ''
    };

    var outSetInfo = {
      height: 151,
      bestblock: '20b6cc0600037171b8bb634bbd04ea754945be44db8d9199b74798f1abdb382d',
      transactions: 151,
      txouts: 151,
      bytes_serialized: 10431,
      hash_serialized: 'c165d5dcb22a897745ee2ee274b47133b995bbcf8dd4a7572fedad87541c7df8',
      total_amount: 750000000000
    };

    var node = {
      services: {
        bitcoind: {
          getInfo: sinon.stub().callsArgWith(0, null, info),
          getBestBlockHash: sinon.stub().callsArgWith(0, null, outSetInfo.bestblock),
          tiphash: outSetInfo.bestblock
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

    it('getBestBlockHash', function(done) {
      var req = {
        query: {
          q: 'getBestBlockHash'
        }
      };
      var res = {
        jsonp: function(data) {
          data.bestblockhash.should.equal(outSetInfo.bestblock);
          done();
        }
      };
      status.show(req, res);
    });

    it('getLastBlockHash', function(done) {
      var req = {
        query: {
          q: 'getLastBlockHash'
        }
      };
      var res = {
        jsonp: function(data) {
          data.syncTipHash.should.equal(outSetInfo.bestblock);
          data.lastblockhash.should.equal(outSetInfo.bestblock);
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
          bitcoind: {
            height: 500000,
            isSynced: sinon.stub().callsArgWith(0, null, true),
            syncPercentage: sinon.stub().callsArgWith(0, null, 99.99)
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
        version: require('../package.json').version
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
