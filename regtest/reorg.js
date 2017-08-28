'use strict';

var expect = require('chai').expect;
var net = require('net');
var spawn = require('child_process').spawn;
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var fs = require('fs');
var p2p = require('bitcore-p2p');
var bitcore = require('bitcore-lib');
var Networks = bitcore.Networks;
var BlockHeader = bitcore.BlockHeader;
var Block = bitcore.Block;
var BcoinBlock = require('bcoin').block;
var http = require('http');

Networks.enableRegtest();
var messages = new p2p.Messages({ network: Networks.get('regtest'), Block: BcoinBlock, BlockHeader: BlockHeader });
var server;
var rawBlocks = require('./data/blocks.json');
var rawReorgBlocks = require('./data/blocks_reorg.json')[0];

var reorgBlock = BcoinBlock.fromRaw(rawReorgBlocks, 'hex');

var blocks = rawBlocks.map(function(rawBlock) {
  return new Block(new Buffer(rawBlock, 'hex'));
});

var headers = blocks.map(function(block) {
  return block.header;
});

var debug = true;
var bitcoreDataDir = '/tmp/bitcore';

var bitcore = {
  configFile: {
    file: bitcoreDataDir + '/bitcore-node.json',
    conf: {
      network: 'regtest',
      port: 53001,
      datadir: bitcoreDataDir,
      services: [
        'p2p',
        'db',
        'header',
        'block',
        'address',
        'transaction',
        'mempool',
        'web',
        'insight-api',
        'fee',
        'timestamp'
      ],
      servicesConfig: {
        'p2p': {
          'peers': [
            { 'ip': { 'v4': '127.0.0.1' }, port: 18444 }
          ]
        },
        'insight-api': {
          'routePrefix': 'api'
        }
      }
    }
  },
  httpOpts: {
    protocol: 'http:',
    hostname: 'localhost',
    port: 53001,
  },
  opts: { cwd: bitcoreDataDir },
  datadir: bitcoreDataDir,
  exec: 'bitcored', // ensure this on your path or add the full, absolute path.
  args: ['start'],
  process: null
};


var blockIndex = 0;
var tcpSocket;

var startFakeNode = function() {
  server = net.createServer(function(socket) {

    tcpSocket = socket;
    socket.on('end', function() {
      console.log('bitcore-node has ended the connection');
    });

    socket.on('data', function(data) {

      var command = data.slice(4, 16).toString('hex');
      var message;

      if (command === '76657273696f6e0000000000') { //version
        message = messages.Version();
      }

      if (command === '76657261636b000000000000') { //verack
        message = messages.VerAck();
      }

      if (command === '676574686561646572730000') { //getheaders
        message = messages.Headers(headers);
      }

      if (command === '676574626c6f636b73000000') { //getblocks
        var block = blocks[blockIndex];
        if (!block) {
          return;
        }
        var blockHash = block.hash;
        var inv = p2p.Inventory.forBlock(blockHash);
        message = messages.Inventory([inv]);
      }

      if (command === '676574646174610000000000') { //getdata
        var raw = rawBlocks[blockIndex++];
        var blk = BcoinBlock.fromRaw(raw, 'hex');
        message = messages.Block(blk, { Block: BcoinBlock });
      }

      if (message) {
        socket.write(message.toBuffer());
      }

    });

    socket.pipe(socket);
  });

  server.listen(18444, '127.0.0.1');
};


var shutdownFakeNode = function() {
  server.close();
};

var shutdownBitcore = function(callback) {
  if (bitcore.process) {
    bitcore.process.kill();
  }
  callback();
};

var startBitcore = function(callback) {

  rimraf(bitcoreDataDir, function(err) {

    if(err) {
      return callback(err);
    }

    mkdirp(bitcoreDataDir, function(err) {

      if(err) {
        return callback(err);
      }

      fs.writeFileSync(bitcore.configFile.file, JSON.stringify(bitcore.configFile.conf));

      var args = bitcore.args;
      bitcore.process = spawn(bitcore.exec, args, bitcore.opts);

      bitcore.process.stdout.on('data', function(data) {

        if (debug) {
          process.stdout.write(data.toString());
        }

      });
      bitcore.process.stderr.on('data', function(data) {

        if (debug) {
          process.stderr.write(data.toString());
        }

      });

      callback();
    });

  });


};

describe('Reorg', function() {
  // 1. spin up bitcore-node and have it connect to our custom tcp socket
  // 2. feed it a few headers
  // 3. feed it a few blocks
  // 4. feed it a block that reorgs

  this.timeout(60000);

  before(function(done) {
    startFakeNode();
    startBitcore(done);
  });

  after(function(done) {
    shutdownFakeNode();
    shutdownBitcore(function() {
      setTimeout(done, 3000);
    });
  });

  it('should reorg correctly when already synced', function(done) {

    // at this point we have a fully synced chain at height 7....
    // we now want to send a new block number 7 whose prev hash is block 6 (it should be block 7)
    // we then should reorg back to block 6 then back up to the new block 7

    setTimeout(function() {

        console.log('From Test: reorging to block: ' + reorgBlock.rhash());

        // send the reorg block
        rawBlocks.push(rawReorgBlocks);
        var blockHash = reorgBlock.rhash();
        var inv = p2p.Inventory.forBlock(blockHash);
        var msg = messages.Inventory([inv]);
        tcpSocket.write(msg.toBuffer());

        // wait 2 secs until the reorg happens, if it takes any longer the test ought to fail anyway
        setTimeout(function() {
          var error;
          var request = http.request('http://localhost:53001/api/block/' + reorgBlock.rhash(), function(res) {

            if (res.statusCode !== 200 && res.statusCode !== 201) {
              if (error) {
                return;
              }
              return done('Error from bitcore-node webserver: ' + res.statusCode);
            }

            var resError;
            var resData = '';

            res.on('error', function(e) {
              resError = e;
            });

            res.on('data', function(data) {
              resData += data;
            });

            res.on('end', function() {
              if (error) {
                return;
              }
              var data = JSON.parse(resData);
              expect(data.height).to.equal(7);
              expect(data.hash).to.equal(reorgBlock.rhash());
              done(resError, resData);
            });

          });

          request.on('error', function(e) {
            error = e;
            done(error);
          });

          request.write('');
          request.end();
        }, 2000);
    }, 2000);


  });

});

