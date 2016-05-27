'use strict';

var should = require('should');
var sinon = require('sinon');
var BlockController = require('../lib/blocks');
var bitcore = require('bitcore-lib');
var _ = require('lodash');

var blocks = require('./data/blocks.json');

var blockIndexes = {
  '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7': {
    hash: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
    chainWork: '0000000000000000000000000000000000000000000000054626b1839ade284a',
    prevHash: '00000000000001a55f3214e9172eb34b20e0bc5bd6b8007f3f149fca2c8991a4',
    nextHash: '000000000001e866a8057cde0c650796cb8a59e0e6038dc31c69d7ca6649627d',
    confirmations: 119,
    height: 533974
  },
  '000000000008fbb2e358e382a6f6948b2da24563bba183af447e6e2542e8efc7': {
    hash: '000000000008fbb2e358e382a6f6948b2da24563bba183af447e6e2542e8efc7',
    chainWork: '00000000000000000000000000000000000000000000000544ea52e1575ca753',
    prevHash: '00000000000006bd8fe9e53780323c0e85719eca771022e1eb6d10c62195c441',
    confirmations: 119,
    height: 533951
  },
  '00000000000006bd8fe9e53780323c0e85719eca771022e1eb6d10c62195c441': {
    hash: '00000000000006bd8fe9e53780323c0e85719eca771022e1eb6d10c62195c441',
    chainWork: '00000000000000000000000000000000000000000000000544ea52e0575ba752',
    prevHash: '000000000001b9c41e6c4a7b81a068b50cf3f522ee4ac1e942e75ec16e090547',
    height: 533950
  },
  '000000000000000004a118407a4e3556ae2d5e882017e7ce526659d8073f13a4': {
    hash: '000000000000000004a118407a4e3556ae2d5e882017e7ce526659d8073f13a4',
    prevHash: '00000000000000000a9d74a7b527f7b995fc21ceae5aa21087b443469351a362',
    height: 375493
  },
  533974: {
    hash: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
    chainWork: '0000000000000000000000000000000000000000000000054626b1839ade284a',
    prevHash: '00000000000001a55f3214e9172eb34b20e0bc5bd6b8007f3f149fca2c8991a4',
    height: 533974
  }
};

describe('Blocks', function() {
  describe('/blocks/:blockHash route', function() {
    var insight = {
      'hash': '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
      'confirmations': 119,
      'size': 1011,
      'height': 533974,
      'version': 536870919,
      'merkleroot': 'b06437355844b8178173f3e18ca141472e4b0861daa81ef0f701cf9e51f0283e',
      'tx': [
        '25a988e54b02e0e5df146a0f8fa7b9db56210533a9f04bdfda5f4ceb6f77aadd',
        'b85334bf2df35c6dd5b294efe92ffc793a78edff75a2ca666fc296ffb04bbba0',
        '2e01c7a4a0e335112236b711c4aaddd02e8dc59ba2cda416e8f80ff06dddd7e1'
      ],
      'time': 1440987503,
      'nonce': 1868753784,
      'bits': '1a0cf267',
      'difficulty': 1295829.93087696,
      'chainwork': '0000000000000000000000000000000000000000000000054626b1839ade284a',
      'previousblockhash': '00000000000001a55f3214e9172eb34b20e0bc5bd6b8007f3f149fca2c8991a4',
      'nextblockhash': '000000000001e866a8057cde0c650796cb8a59e0e6038dc31c69d7ca6649627d',
      'reward': 12.5,
      'isMainChain': true,
      'poolInfo': {}
    };

    var bitcoreBlock = bitcore.Block.fromBuffer(new Buffer(blocks['0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7'], 'hex'));

    var node = {
      log: sinon.stub(),
      getBlock: sinon.stub().callsArgWith(1, null, bitcoreBlock),
      services: {
        bitcoind: {
          getBlockHeader: sinon.stub().callsArgWith(1, null, blockIndexes['0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7']),
          isMainChain: sinon.stub().returns(true),
          height: 534092
        }
      }
    };

    it('block data should be correct', function(done) {
      var controller = new BlockController({node: node});
      var hash = '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7';
      var req = {
        params: {
          blockHash: hash
        }
      };
      var res = {};
      var next = function() {
        should.exist(req.block);
        var block = req.block;
        should(block).eql(insight);
        done();
      };
      controller.block(req, res, next);
    });

    it('block pool info should be correct', function(done) {
      var block = bitcore.Block.fromString(blocks['000000000000000004a118407a4e3556ae2d5e882017e7ce526659d8073f13a4']);
      var node = {
        log: sinon.stub(),
        getBlock: sinon.stub().callsArgWith(1, null, block),
        services: {
          bitcoind: {
            getBlockHeader: sinon.stub().callsArgWith(1, null, blockIndexes['000000000000000004a118407a4e3556ae2d5e882017e7ce526659d8073f13a4']),
            isMainChain: sinon.stub().returns(true),
            height: 534092
          }
        }
      };
      var controller = new BlockController({node: node});
      var req = {
        params: {
          blockHash: hash
        }
      };
      var res = {};
      var next = function() {
        should.exist(req.block);
        var block = req.block;
        req.block.poolInfo.poolName.should.equal('Discus Fish');
        req.block.poolInfo.url.should.equal('http://f2pool.com/');
        done();
      };

      var hash = '000000000000000004a118407a4e3556ae2d5e882017e7ce526659d8073f13a4';

      controller.block(req, res, next);
    });

  });

  describe('/blocks route', function() {

    var insight = {
      'blocks': [
        {
          'height': 533951,
          'size': 206,
          'hash': '000000000008fbb2e358e382a6f6948b2da24563bba183af447e6e2542e8efc7',
          'time': 1440978683,
          'txlength': 1,
          'poolInfo': {
            'poolName': 'AntMiner',
            'url': 'https://bitmaintech.com/'
          }
        },
        {
          'height': 533950,
          'size': 206,
          'hash': '00000000000006bd8fe9e53780323c0e85719eca771022e1eb6d10c62195c441',
          'time': 1440977479,
          'txlength': 1,
          'poolInfo': {
            'poolName': 'AntMiner',
            'url': 'https://bitmaintech.com/'
          }
        }
      ],
      'length': 2,
      'pagination': {
        'current': '2015-08-30',
        'currentTs': 1440979199,
        'isToday': false,
        'more': false,
        'next': '2015-08-31',
        'prev': '2015-08-29'
      }
    };

    var stub = sinon.stub();
    stub.onFirstCall().callsArgWith(1, null, new Buffer(blocks['000000000008fbb2e358e382a6f6948b2da24563bba183af447e6e2542e8efc7'], 'hex'));
    stub.onSecondCall().callsArgWith(1, null, new Buffer(blocks['00000000000006bd8fe9e53780323c0e85719eca771022e1eb6d10c62195c441'], 'hex'));

    var hashes = [
      '00000000000006bd8fe9e53780323c0e85719eca771022e1eb6d10c62195c441',
      '000000000008fbb2e358e382a6f6948b2da24563bba183af447e6e2542e8efc7'
    ];
    var node = {
      log: sinon.stub(),
      services: {
        bitcoind: {
          getRawBlock: stub,
          getBlockHeader: function(hash, callback) {
            callback(null, blockIndexes[hash]);
          },
          getBlockHashesByTimestamp: sinon.stub().callsArgWith(2, null, hashes)
        }
      }
    };

    it('should have correct data', function(done) {
      var blocks = new BlockController({node: node});

      var req = {
        query: {
          limit: 2,
          blockDate: '2015-08-30'
        }
      };

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };

      blocks.list(req, res);
    });
  });

  describe('/block-index/:height route', function() {
    var node = {
      log: sinon.stub(),
      services: {
        bitcoind: {
          getBlockHeader: function(height, callback) {
            callback(null, blockIndexes[height]);
          }
        }
      }
    };

    it('should have correct data', function(done) {
      var blocks = new BlockController({node: node});

      var insight = {
        'blockHash': '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7'
      };

      var height = 533974;

      var req = {
        params: {
          height: height
        }
      };
      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };

      blocks.blockIndex(req, res);
    });
  });

  describe('#getBlockReward', function() {
    var node = {
      log: sinon.stub()
    };
    var blocks = new BlockController({node: node});

    it('should give a block reward of 50 * 1e8 for block before first halvening', function() {
      blocks.getBlockReward(100000).should.equal(50 * 1e8);
    });

    it('should give a block reward of 25 * 1e8 for block between first and second halvenings', function() {
      blocks.getBlockReward(373011).should.equal(25 * 1e8);
    });

    it('should give a block reward of 12.5 * 1e8 for block between second and third halvenings', function() {
      blocks.getBlockReward(500000).should.equal(12.5 * 1e8);
    });
  });
});
