'use strict';

var should = require('should');
var sinon = require('sinon');
var BlockController = require('../lib/blocks');
var bcoin = require('bcoin');

var blocks = require('./data/blocks.json');

var blockIndexes = {
  '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7': {
    hash: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
    chainwork: '0000000000000000000000000000000000000000000000054626b1839ade284a',
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
      'merkleroot': '3e28f0519ecf01f7f01ea8da61084b2e4741a18ce1f3738117b84458353764b0',
      'tx': [
        '25a988e54b02e0e5df146a0f8fa7b9db56210533a9f04bdfda5f4ceb6f77aadd',
        'b85334bf2df35c6dd5b294efe92ffc793a78edff75a2ca666fc296ffb04bbba0',
        '2e01c7a4a0e335112236b711c4aaddd02e8dc59ba2cda416e8f80ff06dddd7e1'
      ],
      'time': 1440987503,
      'nonce': 1868753784,
      'bits': 437056103,
      'difficulty': 1295829.93087696,
      'chainwork': '0000000000000000000000000000000000000000000000054626b1839ade284a',
      'previousblockhash': '00000000000001a55f3214e9172eb34b20e0bc5bd6b8007f3f149fca2c8991a4',
      'nextblockhash': '000000000001e866a8057cde0c650796cb8a59e0e6038dc31c69d7ca6649627d',
      'reward': 12.5004,
      'isMainChain': true,
      'poolInfo': {}
    };

    var bcoinBlock = bcoin.block.fromRaw(blocks['0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7'], 'hex');
    bcoinBlock.isMainChain = true;

    var node = {
      log: sinon.stub(),
      services: {
        header: {
          getBlockHeader: sinon.stub().callsArgWith(1, null, blockIndexes['0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7']),
          getCurrentDifficulty: sinon.stub().returns(1295829.93087696)
        },
        block: {
          getBlock: sinon.stub().callsArgWith(1, null, bcoinBlock),
          getTip: sinon.stub().returns({ height: 533974+118 })
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
      var block = bcoin.block.fromRaw(blocks['000000000000000004a118407a4e3556ae2d5e882017e7ce526659d8073f13a4'], 'hex');
      var node = {
        log: sinon.stub(),
        services: {
          header: {
            getBlockHeader: sinon.stub().callsArgWith(1, null, blockIndexes['000000000000000004a118407a4e3556ae2d5e882017e7ce526659d8073f13a4']),
            isMainChain: sinon.stub().returns(true),
            getCurrentDifficulty: sinon.stub().returns('aa'),
            height: 534092
          },
          block: {
            getBlock: sinon.stub().callsArgWith(1, null, block),
            getTip: sinon.stub().returns({ height: 123 })
          }
        }
      };
      var controller = new BlockController({node: node});
      var hash = '000000000000000004a118407a4e3556ae2d5e882017e7ce526659d8073f13a4';
      var req = {
        params: {
          blockHash: hash
        }
      };
      var res = {};
      var next = function() {
        should.exist(req.block);
        req.block.poolInfo.poolName.should.equal('Discus Fish');
        req.block.poolInfo.url.should.equal('http://f2pool.com/');
        done();
      };

      controller.block(req, res, next);
    });

  });

  describe('/block-index/:height route', function() {
    var node = {
      log: sinon.stub(),
      services: { header: { getBlockHeader: sinon.stub().callsArgWith(1, null, { hash: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7' }) }, block: {}, timestamp: {} },
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

  // I changed this from the mined reward only to the mined reward plus any fees the miner was awarded.
  describe('#getBlockReward', function() {
    var node = {
      services: { header: {}, block: {}, timestamp: {} },
      log: sinon.stub()
    };
    var blocks = new BlockController({node: node});

    it('should give a block reward', function() {
      blocks.getBlockReward({ outputs: [ { value: 1000 }, { value: 2000 } ] }).should.equal(0.00003);
    });

  });
});
