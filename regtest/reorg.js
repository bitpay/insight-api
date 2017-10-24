'use strict';

/*

   Reorg states (enumerated):

   1. block service fully sync'ed, p2p block subscription active  (normal operating mode)
   2. block service not sync'ed, reorg common ancestor height greater than current block service tip height  (reorg while sync, not affected)
   3. block service not sync'ed, reorg common ancestor height less than current block service tip height   (reorg while sync, affected)
   4. system shutdown, reorg wipes out header and block tip  (reorg while shutdown, affected)
   5. reorg from a block that was mined from an already-orphaned block

*/

var expect = require('chai').expect;
var spawn = require('child_process').spawn;
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var fs = require('fs');
var async = require('async');
var RPC = require('bitcoind-rpc');
var http = require('http');
var bitcore = require('bitcore-lib');
var exec = require('child_process').exec;
var net = require('net');
var p2p = require('bitcore-p2p');
var bitcore = require('bitcore-lib');
var Networks = bitcore.Networks;
var BlockHeader = bitcore.BlockHeader;
var Block = bitcore.Block;
var bcoin = require('bcoin');
var BcoinBlock = bcoin.block;
var BcoinTx = bcoin.tx;

var tx = BcoinTx.fromRaw('0200000001d7cf6999aa1eeee5bf954071d974bff51aa7126494a071ec0ba7820d98fc3106010000006a473044022072a784b07c68abde667a27587eb3979ee1f3ca5dc78e665801150492268c1307022054fdd4aafdcb15fc4cb7555c3a38a9ade8bb8af57c95be974b06ed16a713355d012103d3b1e94531d8b7ed3eb54751abe79786c1aa9adc1b5bc35cfced49693095b68dfeffffff0245519103000000001976a914beac8701ec4a6970ed239a47671c967b50da43d588ac80969800000000001976a914c98d54f2eb6c8970d50f7e90c9b3f4b71af9493088ac00000000', 'hex');

Networks.enableRegtest();
var messages = new p2p.Messages({ network: Networks.get('regtest'), Block: BcoinBlock, BlockHeader: BlockHeader, Transaction: BcoinTx });

var SimpleMap = function SimpleMap() {
  var object = {};
  var array = [];

  this.size = 0;
  this.length = 0;

  this.remove = function(item) {
    var index = object[item];
    if (index) {
      delete object[item];
      array.splice(index, 1);
    }
  };

  this.get = function (key) {
    return array[object[key]];
  };

  this.set = function (key, value, pos) {

    if (pos >= 0) {
      object[key] = pos;
      array[pos] = value;
    } else {
      object[key] = array.length;
      array.push(value);
    }

    this.size = array.length;
    this.length = array.length;
  };

  this.getIndex = function (index) {
    return array[index];
  };

  this.getLastIndex = function () {
    return array[array.length - 1];
  };
};

var reorgBlock;
var blocksGenerated = 0;

var getReorgBlock = function() {
  return BcoinBlock.fromRaw(require('./data/blocks_reorg.json')[0], 'hex');
};

var getOrphanedBlock = function() {
  return BcoinBlock.fromRaw(require('./data/blocks_orphaned.json')[0], 'hex');
};

var TestBitcoind = function TestBitcoind() {

  var self = this;
  self._orphans = {};

  self.reorientData = function(block) {
    var lastHash = self.blocks.getLastIndex().rhash();
    self.blocks.remove(lastHash);
    self.blocks.set(block.rhash(), block);
  };

  self._getHeaders = function() {
    var ret = [];
    for(var i = 0; i < self.blocks.length; i++) {
      var hdr = new Block(self.blocks.getIndex(i).toRaw()).header;
      ret.push(hdr);
    }
    return ret;
  };

  self._getBlocks = function() {
    self.blocks = new SimpleMap();
    var blocks = require('./data/blocks.json');
    blocks.forEach(function(raw) {
      var blk = BcoinBlock.fromRaw(raw, 'hex');
      self.blocks.set(blk.rhash(), blk);
    });
  };

  self.start = function() {
    self._getBlocks();
    self._server = net.createServer(self._setOnDataHandlers.bind(self));
    self._server.listen(18444, '127.0.0.1');
  };

  self._setOnDataHandlers = function(socket) {

    self._socket = socket;
    socket.on('data', function(data) {

      var command = data.slice(4, 16).toString('ascii').replace(/\0+$/, '');
      var msg = [];

      if (command === 'version') {
        var ver = messages.Version();
        ver.subversion = '/pepe the frog/';
        ver.startHeight = 7;
        msg.push(ver);
        msg.push(messages.VerAck());
      }

      if (command === 'mempool') {
        var txInv = p2p.Inventory.forTransaction(tx.txid());
        msg.push(messages.Inventory([txInv]));
      }

      if (command === 'getheaders') {
        msg.push(messages.Headers(self._getHeaders())); // these are bitcore block headers
      }

      if (command === 'getblocks') {
        var blockHash;
        var plusOneBlockHash = data.slice(-32).reverse().toString('hex');
        if (plusOneBlockHash !== '0000000000000000000000000000000000000000000000000000000000000000') {
          var nextBlock = self.blocks.get(plusOneBlockHash);
          if (!nextBlock) {
            console.log('did not find next block!!!!');
            return;
          }
          blockHash = bcoin.util.revHex(nextBlock.prevBlock);
        } else {
          blockHash = self.blocks.getLastIndex().rhash();
        }
        var inv = p2p.Inventory.forBlock(blockHash);
        msg.push(messages.Inventory([inv]));
      }

      if (command === 'getdata') { //getdata
        var hash = data.slice(-32).reverse().toString('hex');
        if (hash === tx.txid()) {
          return msg.push(messages.Transaction(tx, { Transaction: BcoinTx }));
        }
        var block = self.blocks.get(hash);
        if (!block) {
          block = self._orphans[hash];
        }
        msg.push(messages.Block(block, { Block: BcoinBlock }));
      }

      if (msg.length > 0) {
        msg.forEach(function(message) {
          socket.write(message.toBuffer());
        });
      }

    });
  };

  // this will kick out an unsolicited inventory message to the peer
  // prompting them to send a getdata message back to us with the hash
  // of the resource.
  self.sendBlock = function(block, doNotChangeHeaders) {
    if (!doNotChangeHeaders) {
      var lastHash = self.blocks.getLastIndex().rhash();
      self.blocks.remove(lastHash);
      self.blocks.set(block.rhash(), block);
    } else {
      self._orphans[block.rhash()] = block;
    }
    var inv = p2p.Inventory.forBlock(block.rhash());
    var message = messages.Inventory([inv]);
    self._socket.write(message.toBuffer());
  };

  self.stop = function() {
    self._server.close();
  };

};

var rpcConfig = {
  protocol: 'http',
  user: 'local',
  pass: 'localtest',
  host: '127.0.0.1',
  port: 58332,
  rejectUnauthorized: false
};

var rpc1 = new RPC(rpcConfig);
rpcConfig.port++;
var rpc2 = new RPC(rpcConfig);
var debug = true;
var bitcoreDataDir = '/tmp/bitcore';
var bitcoinDir1 = '/tmp/bitcoin1';
var bitcoinDir2 = '/tmp/bitcoin2';
var bitcoinDataDirs = [ bitcoinDir1, bitcoinDir2 ];

var bitcoin = {
  args: {
    datadir: null,
    listen: 1,
    regtest: 1,
    server: 1,
    rpcuser: 'local',
    rpcpassword: 'localtest',
    //printtoconsole: 1,
    rpcport: 58332,
  },
  datadir: null,
  exec: 'bitcoind', //if this isn't on your PATH, then provide the absolute path, e.g. /usr/local/bin/bitcoind
  processes: []
};

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
        },
        'block': {
          'readAheadBlockCount': 1
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
  exec: 'bitcored',  //if this isn't on your PATH, then provide the absolute path, e.g. /usr/local/bin/bitcored
  args: ['start'],
  process: null
};

var request = function(httpOpts, callback) {

  var request = http.request(httpOpts, function(res) {

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      return callback('Error from bitcore-node webserver: ' + res.statusCode);
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

      if (resError) {
        return callback(resError);
      }
      var data = JSON.parse(resData);
      callback(null, data);

    });

  });

  request.on('error', function(err) {
    callback(err);
  });

  if (httpOpts.body) {
    request.write(httpOpts.body);
  } else {
    request.write('');
  }
  request.end();
};

var waitForBlocksGenerated = function(callback) {

  var httpOpts = {
    hostname: 'localhost',
    port: 53001,
    path: '/api/status',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  async.retry({ interval: 1000, times: 100 }, function(next) {

    request(httpOpts, function(err, data) {
      if (err) {
        return next(err);
      }
      if (data.info.blocks !== blocksGenerated) {
        return next(data);
      }
      next();
    });

  }, callback);
};

var resetDirs = function(dirs, callback) {

  async.each(dirs, function(dir, next) {

    rimraf(dir, function(err) {

      if(err) {
        return next(err);
      }

      mkdirp(dir, next);

    });

  }, callback);

};

var startBitcoind = function(callback) {

  var args = bitcoin.args;
  var argList = Object.keys(args).map(function(key) {
    return '-' + key + '=' + args[key];
  });

  var bitcoinProcess = spawn(bitcoin.exec, argList, bitcoin.opts);
  bitcoin.processes.push(bitcoinProcess);

  bitcoinProcess.stdout.on('data', function(data) {

    if (debug) {
      process.stdout.write(data.toString());
    }

  });

  bitcoinProcess.stderr.on('data', function(data) {

    if (debug) {
      process.stderr.write(data.toString());
    }

  });

  callback();
};


var reportBitcoindsStarted = function() {
  var pids = bitcoin.processes.map(function(process) {
    return process.pid;
  });

  console.log(pids.length + ' bitcoind\'s started at pid(s): ' + pids);
};

var startBitcoinds = function(datadirs, callback) {

  var listenCount = 0;
  async.eachSeries(datadirs, function(datadir, next) {

    bitcoin.datadir = datadir;
    bitcoin.args.datadir = datadir;

    if (listenCount++ > 0) {
      bitcoin.args.listen = 0;
      bitcoin.args.rpcport = bitcoin.args.rpcport + 1;
      bitcoin.args.connect = '127.0.0.1';
    }

    startBitcoind(next);

  }, function(err) {
    if (err) {
      return callback(err);
    }
    reportBitcoindsStarted();
    callback();
  });
};

var waitForBitcoinReady = function(rpc, callback) {
  async.retry({ interval: 1000, times: 1000 }, function(next) {
    rpc.getInfo(function(err) {
      if (err) {
        return next(err);
      }
      next();
    });
  }, function(err) {
    if (err) {
      return callback(err);
    }
    setTimeout(callback, 2000);
  });
};

var shutdownBitcoind = function(callback) {
  var process;
  do {
    process = bitcoin.processes.shift();
    if (process) {
      process.kill();
    }
  } while(process);
  setTimeout(callback, 3000);
};

var shutdownBitcore = function(callback) {
  if (bitcore.process) {
    bitcore.process.kill();
  }
  callback();
};

var writeBitcoreConf = function() {
  fs.writeFileSync(bitcore.configFile.file, JSON.stringify(bitcore.configFile.conf));
};

var startBitcore = function(callback) {

  var args = bitcore.args;
  console.log('Using bitcored from: ');
  async.series([
    function(next) {
      exec('which bitcored', function(err, stdout, stderr) {
        if(err) {
          return next(err);
        }
        console.log(stdout.toString('hex'), stderr.toString('hex'));
        next();
      });
    },
    function(next) {
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

      waitForBlocksGenerated(next);
    }
  ], callback);

};

var sync100Blocks = function(callback) {
  // regtests can generate high numbers of blocks all at one time, but
  // the full node may not relay those blocks faithfully. This is a problem
  // with the full node and not bitcore. So, generate blocks at a slow rate
  async.timesSeries(100, function(n, next) {
    rpc2.generate(1, function(err) {
      if (err) {
        return next(err);
      }
      setTimeout(function() {
        next();
      }, 100);
    });
  }, callback);

};

/*
  1. block service fully sync'ed, p2p block subscription active  (normal operating mode)
*/
var performTest1 = function(callback) {
  async.series([

    // 0. reset the test directories
    function(next) {
      console.log('step 0: setting up directories.');
      var dirs = bitcoinDataDirs.concat([bitcoreDataDir]);
      resetDirs(dirs, function(err) {
        if (err) {
          return next(err);
        }
        writeBitcoreConf();
        next();
      });
    },
    // 1. start 2 bitcoinds in regtest mode
    function(next) {
      console.log('step 1: starting 2 bitcoinds.');
      startBitcoinds(bitcoinDataDirs, function(err) {
        if (err) {
          return callback(err);
        }
        waitForBitcoinReady(rpc1, next);
      });
    },
    // 2. ensure that both bitcoind's are connected
    function(next) {
      console.log('step 2: checking to see if bitcoind\'s are connected to each other.');
      rpc1.getInfo(function(err, res) {
        if (err || res.result.connections !== 1) {
          next(err || new Error('bitcoind\'s not connected to each other.'));
        }
        console.log('bitcoind\'s are connected.');
        next();
      });
    },
    // 3. generate 10 blocks on the 1st bitcoind
    function(next) {
      blocksGenerated += 10;
      console.log('step 3: generating 10 blocks on bitcoin 1.');
      rpc1.generate(10, next);
    },
    // 4. ensure that the 2nd bitcoind syncs those blocks
    function(next) {
      console.log('step 4: checking for synced blocks.');
      async.retry(function(next) {
        rpc2.getInfo(function(err, res) {
          if (err || res.result.blocks < 10) {
            return next(1);
          }
          console.log('bitcoin 2 has synced the blocks generated on bitcoin 1.');
          next();
        });
      }, next);
    },
    // 5. start up bitcore and let it sync the 10 blocks
    function(next) {
      console.log('step 5: starting bitcore...');
      startBitcore(next);
    },
    function(next) {
      // 6. shut down both bitcoind's
      console.log('bitcore is running and sync\'ed.');
      console.log('step 6: shutting down all bitcoind\'s.');
      shutdownBitcoind(next);
    },
    // 7. change the config for the second bitcoind to listen for p2p, start bitcoin 2
    function(next) {
      console.log('step 7: changing config of bitcoin 2 and restarting it.');
      bitcoin.datadir = bitcoinDataDirs[1];
      bitcoin.args.datadir = bitcoinDataDirs[1];
      bitcoin.args.listen = 1;
      startBitcoind(function(err) {
        if (err) {
          return next(err);
        }
        reportBitcoindsStarted();
        waitForBitcoinReady(rpc2, next);
      });
    },
    // 8. generate 100 blocks on the second bitcoind
    function(next) {
      console.log('step 8: generating 100 blocks on bitcoin 2.');
      blocksGenerated += 100;
      console.log('generating 100 blocks on bitcoin 2.');
      sync100Blocks(next);
    },
    // 9. let bitcore connect and sync those 100 blocks
    function(next) {
      console.log('step 9: syncing 100 blocks to bitcore.');
      waitForBlocksGenerated(next);
    },
    // 10. shutdown the second bitcoind
    function(next) {
      console.log('100 more blocks synced to bitcore.');
      console.log('step 10: shutting down bitcoin 2.');
      shutdownBitcoind(next);
    },
    // 11. start up the first bitcoind
    function(next) {
      console.log('bitcoin 2 shut down.');
      console.log('step 11: starting up bitcoin 1');
      bitcoin.args.rpcport = bitcoin.args.rpcport - 1;
      bitcoin.datadir = bitcoinDataDirs[0];
      bitcoin.args.datadir = bitcoinDataDirs[0];
      startBitcoind(function(err) {
        if (err) {
          return next(err);
        }
        reportBitcoindsStarted();
        waitForBitcoinReady(rpc1, next);
      });
    },
    // 12. generate one block
    function(next) {
      console.log('step 12: generating one block');
      // resetting height to 11
      blocksGenerated = 11;
      rpc1.generate(1, function(err, res) {
        if(err) {
          return next(err);
        }
        reorgBlock = res.result[0];
        next();
      });
    },
    // 13. let bitcore sync that block and reorg back to it
    function(next) {
      console.log('step 13: Waiting for bitcore to reorg to block height 11.');
      waitForBlocksGenerated(next);
    }
  ], function(err) {
    if (err) {
      return callback(err);
    }
    callback();

  });
};

/*
  2. block service not sync'ed, reorg common ancestor height greater than current block service tip height  (reorg while sync, not affected)
*/
var performTest2 = function(fakeServer, callback) {
  async.series([
    // 0. reset the test directories
    function(next) {
      console.log('step 0: setting up directories.');
      bitcore.configFile.conf.servicesConfig.header = { slowMode: 1000 };
      var dirs = bitcoinDataDirs.concat([bitcoreDataDir]);
      resetDirs(dirs, function(err) {
        if (err) {
          return next(err);
        }
        writeBitcoreConf();
        next();
      });
    },
    // 1. start fake server
    function(next) {
      console.log('step 1: starting fake server.');
      fakeServer.start();
      next();
    },
    // 2. init server with blocks (the initial set from which bitcore will sync)
    function(next) {
      console.log('step 2: init server with blocks (the initial set from which bitcore will sync)');
      next();
    },
    // 3. start bitcore in slow mode (slow the block service's sync speed down so we
    // can send a reorg block to the header service while the block service is still syncing.
    function(next) {
      console.log('step 3: start bitcore in slow mode.');
      blocksGenerated = 4;
      startBitcore(next);
    },
    function(next) {
      console.log('step 4: send a block in to reorg the header service without reorging the block service.');
      var reorgBlock = getReorgBlock();
      fakeServer.sendBlock(reorgBlock);
      blocksGenerated = 7;
      waitForBlocksGenerated(next);
    }
  ], function(err) {
    if (err) {
      return callback(err);
    }
    callback();
  });
};

/*
 3. block service not sync'ed, reorg common ancestor height less than current block service tip heigh   (reorg while sync, affected)
*/
var performTest3 = function(fakeServer, callback) {
  async.series([
    // 0. reset the test directories
    function(next) {
      console.log('step 0: setting up directories.');
      bitcore.configFile.conf.servicesConfig.header = { slowMode: 1000 };
      var dirs = bitcoinDataDirs.concat([bitcoreDataDir]);
      resetDirs(dirs, function(err) {
        if (err) {
          return next(err);
        }
        writeBitcoreConf();
        next();
      });
    },
    // 1. start fake server
    function(next) {
      console.log('step 1: starting fake server.');
      fakeServer.start();
      next();
    },
    // 2. init server with blocks (the initial set from which bitcore will sync)
    function(next) {
      console.log('step 2: init server with blocks (the initial set from which bitcore will sync)');
      next();
    },
    // 3. start bitcore in slow mode (slow the block service's sync speed down so we
    // can send a reorg block to the header service while the block service is still syncing.
    function(next) {
      console.log('step 3: start bitcore in slow mode.');
      blocksGenerated = 6;
      startBitcore(next);
    },
    function(next) {
      console.log('step 4: send a block in to reorg the header service without reorging the block service.');
      var reorgBlock = getReorgBlock();
      fakeServer.sendBlock(reorgBlock);
      next();
    },
    function(next) {
      setTimeout(next, 2000);
    },
    function(next) {
      blocksGenerated = 7;
      waitForBlocksGenerated(next);
    }
  ], function(err) {
    if (err) {
      return callback(err);
    }
    console.log('calling back from perform test 3');
    callback();
  });

};

/*
  4. system shutdown, reorg wipes out header and block tip  (reorg while shutdown, affected)
*/
var performTest4 = function(fakeServer, callback) {
  async.series([
    // 0. reset the test directories
    function(next) {
      console.log('step 0: setting up directories.');
      var dirs = bitcoinDataDirs.concat([bitcoreDataDir]);
      resetDirs(dirs, function(err) {
        if (err) {
          return next(err);
        }
        writeBitcoreConf();
        next();
      });
    },
    // 1. start fake server
    function(next) {
      console.log('step 1: starting fake server.');
      fakeServer.start();
      next();
    },
    // 2. start bitcore
    function(next) {
      console.log('step 2: start bitcore and let sync.');
      blocksGenerated = 7;
      startBitcore(next);
    },
    // 3. shutdown bitcore
    function(next) {
      console.log('step 3: shut down bitcore.');
      shutdownBitcore(next);
    },
    // 4. setup the fake server to send a reorg'ed set of headers
    function(next) {
      console.log('step 4: setup fake server to send reorg set of headers.');
      var reorgBlock = getReorgBlock();
      fakeServer.reorientData(reorgBlock);
      next();
    },
    // 5. start up bitcore once again
    function(next) {
      console.log('step 5: start up bitcore.');
      blocksGenerated = 7;
      startBitcore(next);
    }
  ], function(err) {
    if (err) {
      return callback(err);
    }
    callback();
  });
};

/*
  5. reorg from a block that was mined from an already-orphaned block
*/
var performTest5 = function(fakeServer, callback) {
  async.series([
    // 0. reset the test directories
    function(next) {
      console.log('step 0: setting up directories.');
      var dirs = bitcoinDataDirs.concat([bitcoreDataDir]);
      resetDirs(dirs, function(err) {
        if (err) {
          return next(err);
        }
        writeBitcoreConf();
        next();
      });
    },
    // 1. start fake server
    function(next) {
      console.log('step 1: starting fake server.');
      fakeServer.start();
      next();
    },
    // 2. start bitcore
    function(next) {
      console.log('step 2: start bitcore and let sync.');
      blocksGenerated = 7;
      startBitcore(next);
    },
    // 3. send in a block that has nothing to do with anything in my chain.
    function(next) {
      console.log('step 3: send in an orphaned block.');
      var orphanedBlock = getOrphanedBlock();
      fakeServer.sendBlock(orphanedBlock, true);
      next();
    }
  ], function(err) {
    if (err) {
      return callback(err);
    }
    callback();
  });

};

describe('Reorg', function() {

  this.timeout(60000);

  describe('Reorg case 1: block service fully sync\'ed, p2p block subscription active  (normal operating mode)', function() {

    after(function(done) {
      shutdownBitcore(function() {
        shutdownBitcoind(done);
      });
    });

    // case 1.
    it('should reorg correctly when bitcore reconnects to a peer that is not yet sync\'ed, but when a block does come in, it is a reorg block.', function(done) {
      /*
         What this test does:

         step 0: set up directories
         step 1: start 2 bitcoinds.
         step 2: check to see if bitcoind's are connected to each other.
         step 3: generate 10 blocks on bitcoin 1.
         step 4: check for synced blocks between bitcoinds.
         step 5: start bitcore
         step 6: shut down all bitcoind's.
         step 7: change config of bitcoin 2 and restart it.
         step 8: generate 100 blocks on bitcoin 2.
         step 9: sync 100 blocks to bitcore.
         step 10: shut down bitcoin 2.
         step 11: start up bitcoin 1
         step 12: generate 1 block
         step 13: Wait for bitcore to reorg to block height 11.
       */


      performTest1(function(err) {

        if(err) {
          return done(err);
        }

        var httpOpts = {
          hostname: 'localhost',
          port: 53001,
          path: 'http://localhost:53001/api/block/' + reorgBlock,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        };

        request(httpOpts, function(err, data) {

          if(err) {
            return done(err);
          }

          console.log(data);
          expect(data.height).to.equal(11);
          done();

        });

      });
    });
  });

  describe('Reorg case 2: block service not sync\'ed, reorg common ancestor height greater than ' +
    'current block service tip height  (reorg while sync, not affected)', function() {

      var fakeServer;
      before(function(done) {
        fakeServer = new TestBitcoind();
        done();
      });

      after(function(done) {
        shutdownBitcore(function() {
          fakeServer.stop();
          done();
        });
      });

      it('should reorg correctly when the block service is initially syncing, but it has not sync\'ed to the point where the reorg has happened.', function(done) {

        /*
           What this test does:

           step 0: setup directories
           step 1: start fake server (fake bitcoin)
           step 2: init server with blocks (the initial set from which bitcore will sync)
           step 3: start bitcore in slow mode (slow the block service's sync speed down so we
           can send a reorg block to the header service while the block service is still syncing.
           step 4: send an inventory message with a reorg block hash

           the header service will get this message, discover the reorg, handle the reorg
           and call onHeaders on the block service, query bitcore for the results
         */
        performTest2(fakeServer, function(err) {

          if(err) {
            return done(err);
          }
          setTimeout(function() {
            var httpOpts = {
              hostname: 'localhost',
              port: 53001,
              path: 'http://localhost:53001/api/block/' + getReorgBlock().rhash(),
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            };

            request(httpOpts, function(err, data) {

              if(err) {
                return done(err);
              }

              console.log(data);
              expect(data.height).to.equal(7);
              done();

            });
          }, 2000);
        });
      });
  });

  describe('Reorg case 3: block service not sync\'ed, reorg common ancestor height less than ' +
      'current block service tip height  (reorg while sync, affected)', function() {

        var fakeServer;
        before(function(done) {
          fakeServer = new TestBitcoind();
          done();
        });

        after(function(done) {
          shutdownBitcore(function() {
            fakeServer.stop();
            done();
          });
        });

        it('should reorg correctly when the block service is initially syncing and the block service has received at least the common header.', function(done) {

          /*
             What this test does:

             step 0: setup directories
             step 1: start fake server (fake bitcoin)
             step 2: init server with blocks (the initial set from which bitcore will sync)
             step 3: start bitcore in slow mode
             step 4: send an inventory message with a reorg block hash

         */
          performTest3(fakeServer, function(err) {

            if(err) {
              return done(err);
            }
            setTimeout(function() {
              var httpOpts = {
                hostname: 'localhost',
                port: 53001,
                path: 'http://localhost:53001/api/block/' + getReorgBlock().rhash(),
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                }
              };

              request(httpOpts, function(err, data) {

                if(err) {
                  return done(err);
                }

                console.log(data);
                expect(data.height).to.equal(7);
                done();

              });
            }, 4000);
        });
      });
    });

    describe('Case 4: system shutdown, reorg wipes out header and block tip  (reorg while shutdown, affected)', function() {

      var fakeServer;
      before(function(done) {
        fakeServer = new TestBitcoind();
        done();
      });

      after(function(done) {
        shutdownBitcore(function() {
          fakeServer.stop();
          done();
        });
      });

      it('should reorg when, while the node is shut down, our header tip is reorged out of existence.', function(done) {
        performTest4(fakeServer, function(err) {
          if (err) {
            return done(err);
          }
          setTimeout(function() {
            var httpOpts = {
              hostname: 'localhost',
              port: 53001,
              path: 'http://localhost:53001/api/block/' + getReorgBlock().rhash(),
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            };
            request(httpOpts, function(err, data) {
              if(err) {
                return done(err);
              }
              console.log(data);
              expect(data.height).to.equal(7);
              done();
            });
          }, 2000);
      });
    });
  });

  describe('Case 5: reorg from a block that was mined from an already-orphaned block', function() {

      var fakeServer;
      before(function(done) {
        fakeServer = new TestBitcoind();
        done();
      });

      after(function(done) {
        shutdownBitcore(function() {
          fakeServer.stop();
          done();
        });
      });

      it('should launch a reorg, yet no mainchain blocks will be affected when a new block comes in that is not mainchain to begin with', function(done) {
        performTest5(fakeServer, function(err) {
          if (err) {
            return done(err);
          }
          setTimeout(function() {
            var httpOpts = {
              hostname: 'localhost',
              port: 53001,
              path: 'http://localhost:53001/api/block/' + fakeServer.blocks.getLastIndex().rhash(),
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            };
            request(httpOpts, function(err, data) {
              if(err) {
                return done(err);
              }
              console.log(data);
              expect(data.height).to.equal(7);
              done();
            });
          }, 2000);
      });
    });
  });
});
