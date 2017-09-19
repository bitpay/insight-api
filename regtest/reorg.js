'use strict';

var expect = require('chai').expect;
var spawn = require('child_process').spawn;
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var fs = require('fs');
var async = require('async');
var RPC = require('bitcoind-rpc');
var http = require('http');
var bitcore = require('bitcore-lib');

/*
   What this test does:

   1. start 2 bitcoind in regtest mode
   2. generate 10 blocks on the 1st bitcoind
   3. ensure that the 2nd bitcoind syncs those blocks
   4. start up bitcore and let it sync the 10 blocks
   5. shut down the first bitcoind
   6. start up the second bitcoind
   7. generate 100 blocks on the second bitcoind
   8. let bitcore sync the additional 100 blocks, height should be 110
   9. shutdown bitcore
   10. start up the first bitcoind again
   11. generate 1 block
   12. start up bitcore again, bitcore should reorg, removing 100 blocks and adding the one new block

*/

var blocksGenerated = 0;

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

  waitForBlocksGenerated(callback);


};

var performTest = function(callback) {
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
        console.log('done');
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
      console.log('done');
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
      console.log('done');
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
      rpc2.generate(100, next);
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
      rpc1.generate(1, next);
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

describe('Reorg', function() {

  this.timeout(60000);

  after(function(done) {
    shutdownBitcoind(done);
  });

  it('should reorg correctly when starting and a reorg happen whilst shutdown', function(done) {

    performTest(function(err) {
      return done();
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
        done();

      });

    });
  });
});
