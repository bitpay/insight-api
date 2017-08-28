'use strict';

var expect = require('chai').expect;
var spawn = require('child_process').spawn;
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var fs = require('fs');
var async = require('async');
var RPC = require('bitcoind-rpc');
var http = require('http');

var rpc1Address;
var rpc2Address;
var tx1;
var tx2;
var block;

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
var bitcoinDataDirs = ['/tmp/bitcoin1', '/tmp/bitcoin2'];

var bitcoin = {
  args: {
    datadir: null,
    listen: 1,
    regtest: 1,
    server: 1,
    rpcuser: 'local',
    rpcpassword: 'localtest',
    //printtoconsole: 1
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
        'fee': {
          'rpc': {
            'user': 'local',
            'pass': 'localtest',
            'host': 'localhost',
            'protocol': 'http',
            'port': 58332
          }
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
  exec: 'bitcored',
  args: ['start'],
  process: null
};

var startBitcoind = function(count, callback) {

  var listenCount = 0;
  async.timesSeries(count, function(n, next) {

    var datadir = bitcoinDataDirs.shift();

    bitcoin.datadir = datadir;
    bitcoin.args.datadir = datadir;

    if (listenCount++ > 0) {
      bitcoin.args.listen = 0;
      bitcoin.args.rpcport++;
      bitcoin.args.connect = '127.0.0.1';
    }

    rimraf(datadir, function(err) {

      if(err) {
        return next(err);
      }

      mkdirp(datadir, function(err) {

        if(err) {
          return next(err);
        }

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

        next();

      });

    });
  }, function(err) {

      if (err) {
        return callback(err);
      }

      var pids = bitcoin.processes.map(function(process) {
        return process.pid;
      });

      console.log(count + ' bitcoind\'s started at pid(s): ' + pids);
      callback();
  });
};


var shutdownBitcoind = function(callback) {
  bitcoin.processes.forEach(function(process) {
    process.kill();
  });
  setTimeout(callback, 3000);
};

var shutdownBitcore = function(callback) {
  if (bitcore.process) {
    bitcore.process.kill();
  }
  callback();
};


var buildInitialChain = function(callback) {
  async.waterfall([
    function(next) {
      console.log('checking to see if bitcoind\'s are connected to each other.');
      rpc1.getinfo(function(err, res) {
        if (err || res.result.connections !== 1) {
          next(err || new Error('bitcoind\'s not connected to each other.'));
        }
        next();
      });
    },
    function(next) {
      console.log('generating 101 blocks');
      rpc1.generate(101, next);
    },
    function(res, next) {
      console.log('getting new address from rpc2');
      rpc2.getNewAddress(function(err, res) {
        if (err) {
          return next(err);
        }
        rpc2Address = res.result;
        console.log(rpc2Address);
        next(null, rpc2Address);
      });
    },
    function(addr, next) {
      rpc1.sendToAddress(rpc2Address, 25, next);
    },
    function(res, next) {
      tx1 = res.result;
      console.log('TXID: ' + res.result);
      console.log('generating 7 blocks');
      rpc1.generate(7, next);
    },
    function(res, next) {
      block = res.result[res.result.length - 1];
      rpc2.getBalance(function(err, res) {
        console.log(res);
        next();
      });
    },
    function(next) {
      console.log('getting new address from rpc1');
      rpc1.getNewAddress(function(err, res) {
        if (err) {
          return next(err);
        }
        rpc1Address = res.result;
        next(null, rpc1Address);
      });
    },
    function(addr, next) {
      rpc2.sendToAddress(rpc1Address, 20, next);
    },
    function(res, next) {
      tx2 = res.result;
      console.log('sending from rpc2Address TXID: ', res);
      console.log('generating 6 blocks');
      rpc2.generate(6, next);
    }
  ], function(err) {

    if (err) {
      return callback(err);
    }
    rpc1.getInfo(function(err, res) {
      console.log(res);
      callback();
    });
  });

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

describe('Status', function() {

  this.timeout(60000);

  before(function(done) {

    async.series([
      function(next) {
        startBitcoind(2, next);
      },
      function(next) {
        setTimeout(function() {
          buildInitialChain(next);
        }, 8000);
      },
      function(next) {
        setTimeout(function() {
          startBitcore(next);
        }, 6000);
      }
    ], function(err) {
        if (err) {
          return done(err);
        }
        setTimeout(done, 2000);
    });

  });

  after(function(done) {
    shutdownBitcore(function() {
      shutdownBitcoind(done);
    });
  });

  it('should get status: /status', function(done) {

    var request = http.request('http://localhost:53001/api/status', function(res) {

      var error;
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
        expect(data.info).to.not.be.null;
        done();
      });

    });
    request.write('');
    request.end();
  });

  it('should get status: /sync', function(done) {

    var request = http.request('http://localhost:53001/api/sync', function(res) {

      var error;
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
        console.log(data);
        expect(data.status).to.equal('finished');
        done();
      });

    });
    request.write('');
    request.end();
  });

  it('should get peer: /peer', function(done) {

    var request = http.request('http://localhost:53001/api/peer', function(res) {

      var error;
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
        console.log(data);
        expect(data.connected).to.be.true;
        done();
      });

    });
    request.write('');
    request.end();
  });

  it('should get version: /version', function(done) {

    var request = http.request('http://localhost:53001/api/version', function(res) {

      var error;
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
        console.log(data);
        expect(data.version).to.not.be.null;
        done();
      });

    });

    request.write('');
    request.end();

  });

  it('should estimate fee: /estimateFee', function(done) {

    var request = http.request('http://localhost:53001/api/utils/estimateFee', function(res) {

      var error;
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
        console.log(data);
        expect(data['2']).to.not.be.null;
        done();
      });

    });

    request.write('');
    request.end();

  });
});
