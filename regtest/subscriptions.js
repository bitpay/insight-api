'use strict';

var expect = require('chai').expect;
var spawn = require('child_process').spawn;
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var fs = require('fs');
var async = require('async');
var RPC = require('florincoind-rpc');
var http = require('http');
var flocore = require('flocore-lib');
var exec = require('child_process').exec;
var flocore = require('flocore-lib');
var Block = flocore.Block;
var PrivateKey = flocore.PrivateKey;
var Transaction = flocore.Transaction;
var io = require('socket.io-client');

/*

  Theory behind this test.

  We want to connect a web socket and subscribe to both new txs and blocks.

  When a new tx or block comes in, we want to immediately call the api for that resource.


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

var rpc = new RPC(rpcConfig);
var debug = true;
var flocoreDataDir = '/tmp/flocore';
var florincoinDir = '/tmp/florincoin';
var florincoinDataDirs = [ florincoinDir ];
var blocks= [];
var pks = [];
var initialTx;
var startingPk;
var txs = [];
var txids = [];

var florincoin = {
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
  exec: 'florincoind', //if this isn't on your PATH, then provide the absolute path, e.g. /usr/local/bin/florincoind
  processes: []
};

var flocore = {
  configFile: {
    file: flocoreDataDir + '/flocore-node.json',
    conf: {
      network: 'regtest',
      port: 53001,
      datadir: flocoreDataDir,
      services: [
        'p2p',
        'db',
        'header',
        'block',
        'address',
        'transaction',
        'mempool',
        'web',
        'flosight-api',
        'fee',
        'timestamp'
      ],
      servicesConfig: {
        'p2p': {
          'peers': [
            { 'ip': { 'v4': '127.0.0.1' }, port: 18444 }
          ]
        },
        'flosight-api': {
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
  opts: { cwd: flocoreDataDir },
  datadir: flocoreDataDir,
  exec: 'flocored',  //if this isn't on your PATH, then provide the absolute path, e.g. /usr/local/bin/flocored
  args: ['start'],
  process: null
};

var request = function(httpOpts, callback) {

  var request = http.request(httpOpts, function(res) {

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      return callback('Error from flocore-node webserver: ' + res.statusCode);
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

var startFlorincoind = function(callback) {

  var args = florincoin.args;
  var argList = Object.keys(args).map(function(key) {
    return '-' + key + '=' + args[key];
  });

  var florincoinProcess = spawn(florincoin.exec, argList, florincoin.opts);
  florincoin.processes.push(florincoinProcess);

  florincoinProcess.stdout.on('data', function(data) {

    if (debug) {
      process.stdout.write(data.toString());
    }

  });

  florincoinProcess.stderr.on('data', function(data) {

    if (debug) {
      process.stderr.write(data.toString());
    }

  });

  callback();
};


var reportFlorincoindsStarted = function() {
  var pids = florincoin.processes.map(function(process) {
    return process.pid;
  });

  console.log(pids.length + ' florincoind\'s started at pid(s): ' + pids);
};

var startFlorincoinds = function(datadirs, callback) {

  var listenCount = 0;
  async.eachSeries(datadirs, function(datadir, next) {

    florincoin.datadir = datadir;
    florincoin.args.datadir = datadir;

    if (listenCount++ > 0) {
      florincoin.args.listen = 0;
      florincoin.args.rpcport = florincoin.args.rpcport + 1;
      florincoin.args.connect = '127.0.0.1';
    }

    startFlorincoind(next);

  }, function(err) {
    if (err) {
      return callback(err);
    }
    reportFlorincoindsStarted();
    callback();
  });
};

var waitForFlorincoinReady = function(rpc, callback) {
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

var shutdownFlorincoind = function(callback) {
  var process;
  do {
    process = florincoin.processes.shift();
    if (process) {
      process.kill();
    }
  } while(process);
  setTimeout(callback, 3000);
};

var shutdownFlocore = function(callback) {
  if (flocore.process) {
    flocore.process.kill();
  }
  callback();
};

var writeFlocoreConf = function() {
  fs.writeFileSync(flocore.configFile.file, JSON.stringify(flocore.configFile.conf));
};

var startFlocore = function(callback) {

  var args = flocore.args;
  console.log('Using flocored from: ');
  async.series([
    function(next) {
      exec('which flocored', function(err, stdout, stderr) {
        if(err) {
          return next(err);
        }
        console.log(stdout.toString('hex'), stderr.toString('hex'));
        next();
      });
    },
    function(next) {
      flocore.process = spawn(flocore.exec, args, flocore.opts);

      flocore.process.stdout.on('data', function(data) {

        if (debug) {
          process.stdout.write(data.toString());
        }

      });
      flocore.process.stderr.on('data', function(data) {

        if (debug) {
          process.stderr.write(data.toString());
        }

      });

      waitForBlocksGenerated(next);
    }
  ], callback);

};

var makeLocalPrivateKeys = function(num) {
  if (!num) {
    num = 20;
  }
  for(var i = 0; i < num; i++) {
    pks.push(new PrivateKey('testnet'));
  }
};

var getFirstIncomingFunds = function(callback) {
  initialTx = new Transaction();
  rpc.listUnspent(function(err, res) {
    if (err) {
      return callback(err);
    }
    var unspent = res.result[0];
    rpc.dumpPrivKey(unspent.address, function(err, res) {
      if (err) {
        return callback(err);
      }
      startingPk = new PrivateKey(res.result);
      var utxo = {
        txId: unspent.txid,
        outputIndex: unspent.vout,
        script: unspent.scriptPubKey,
        satoshis: unspent.amount * 1e8,
        address: unspent.address
      };

      initialTx.from(utxo).to(pks[0].toAddress(), 20*1e8).change(startingPk.toAddress()).fee(50000).sign(startingPk);

      var body = '{"rawtx":"' + initialTx.serialize() + '"}';

      var httpOpts = {
        hostname: 'localhost',
        port: 53001,
        path: 'http://localhost:53001/api/tx/send',
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length
        },
      };

      request(httpOpts, function(err, data) {

        if (err) {
          return callback(err);
        }

        console.log('Sent initial tx: ', initialTx.hash);
        txids.push(data.txid);
        callback();

      });
    });
  });
};

var sendTx = function(callback) {

  var index;
  for(var i = 0; i < initialTx.outputs.length; i++) {
    if (initialTx.outputs[i].script.toAddress().toString() === pks[0].toAddress().toString()) {
      index = i;
      break;
    }
  }

  var utxo = {
    address: pks[0].toAddress().toString(),
    script: initialTx.outputs[index].script.toHex(),
    satoshis: initialTx.outputs[index].satoshis,
    outputIndex: index,
    txid: initialTx.hash
  };

  txs.push(new Transaction()
    .from(utxo)
    .to(pks[1].toAddress(), 1e8)
    .change(startingPk.toAddress()).fee(50000).sign(pks[0]));

  var body = '{"rawtx":"' + txs[0].serialize() + '"}';

  var httpOpts = {
    hostname: 'localhost',
    port: 53001,
    path: 'http://localhost:53001/api/tx/send',
    method: 'POST',
    body: body,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body.length
    },
  };

  request(httpOpts, function(err, data) {
    if (err) {
      return callback(err);
    }

    txids.push(data.txid);
    callback();

  });
};

describe('Subscriptions', function() {

  this.timeout(60000);

  before(function(done) {

    async.series([
      function(next) {
        console.log('step 0: setting up directories.');
        var dirs = florincoinDataDirs.concat([flocoreDataDir]);
        resetDirs(dirs, function(err) {
          if (err) {
            return next(err);
          }
          writeFlocoreConf();
          next();
        });
      },
      function(next) {
        console.log('step 1: start florincoind');
        startFlorincoinds(florincoinDataDirs, function(err) {
          if (err) {
            return next(err);
          }
          waitForFlorincoinReady(rpc, function(err) {
            if (err) {
              return next(err);
            }
            blocksGenerated += 101;
            rpc.generate(101, next);
          });
        });
      },
      function(next) {
        console.log('step 2: start flocore');
        startFlocore(next);
      },
      function(next) {
        console.log('step 3: make local private keys.');
        makeLocalPrivateKeys();
        next();
      },
      function(next) {
        console.log('step 4: setup initial tx.');
        getFirstIncomingFunds(next);
      }
    ], done);

  });

  after(function(done) {
    shutdownFlocore(function() {
      shutdownFlorincoind(done);
    });
  });

  it('should be able to be able to GET a transaction after receiving a websocket notification that a tx has arrived in the mempool.', function(done) {

    var socket = io('ws://localhost:53001', {
      transports: [ 'websocket' ]
    });

    socket.emit('subscribe', 'mempool/transaction');

    // send a transaction
    socket.on('mempool/transaction', function(msg) {

      console.log('got mempool tx event from webscoket.');

      var httpOpts = {
        hostname: 'localhost',
        port: 53001,
        path: '/api/tx/' + txs[0].hash,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      expect(msg.hash).to.equal(txs[0].hash);

      request(httpOpts, function(err, data) {

        if (err) {
          return done(err);
        }

        expect(data.txid).to.equal(msg.hash);
        done();

      });

    });

    socket.on('connect', function() {
      sendTx(function(err) {
        console.log(txs[0].hash + ' sent.');
      });
    });

  });

  it('should be able to GET a block after receiving a websocket notification that a tx has arrived in the mempool.', function(done) {

    var blockHash;

    var socket = io('ws://localhost:53001', {
      transports: [ 'websocket' ]
    });

    socket.emit('subscribe', 'block/block');

    // send a transaction
    socket.on('block/block', function(msg) {

      console.log('got block event from webscoket.');

      var httpOpts = {
        hostname: 'localhost',
        port: 53001,
        path: '/api/block/' + msg.hash,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      expect(msg.hash).to.equal(blockHash);

      request(httpOpts, function(err, data) {

        if (err) {
          return done(err);
        }

        expect(data.hash).to.equal(msg.hash);
        done();

      });

    });

    socket.on('connect', function() {
      rpc.generate(1, function(err, res) {
        if (err) {
          return done(err);
        }
        blockHash = res.result[0];
      });
    });

  });

});
