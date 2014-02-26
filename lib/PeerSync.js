'use strict';
require('classtool');

function spec() {
  var fs = require('fs');
  var bitcoreUtil = require('bitcore/util/util');
  var Sync = require('./Sync').class();
  var Peer = require('bitcore/Peer').class();
  var config = require('../config/config');
  var networks = require('bitcore/networks');

  var peerdb_fn = 'peerdb.json';

  function PeerSync(opts) {
    this.connected = false;
    this.peerdb = undefined;
    this.allowReorgs = false;
    this.PeerManager = require('bitcore/PeerManager').createClass({
      network: (config.network === 'testnet' ? networks.testnet : networks.livenet)
    });
    this.peerman = new this.PeerManager();
    this.load_peers();
    this.sync = new Sync(opts);
  }

  PeerSync.prototype.load_peers = function() {
    this.peerdb = [{
      ipv4: config.bitcoind.host,
      port: config.bitcoind.p2pPort
    }];

    fs.writeFileSync(peerdb_fn, JSON.stringify(this.peerdb));
  };

  PeerSync.prototype.info = function() {
    return {
      connected: this.connected,
      host: this.peerdb[0].ipv4,
      port: this.peerdb[0].port
    };
  };

  PeerSync.prototype.handleInv = function(info) {
    var invs = info.message.invs;
    info.conn.sendGetData(invs);
  };

  PeerSync.prototype.handleTx = function(info) {
    var tx = info.message.tx.getStandardizedObject();
    tx.outs = info.message.tx.outs;
    tx.ins = info.message.tx.ins;
    console.log('[p2p_sync] Handle tx: ' + tx.hash);
    tx.time = tx.time || Math.round(new Date().getTime() / 1000);

    this.sync.storeTxs([tx], function(err) {
      if (err) {
        console.log('[p2p_sync] Error in handle TX: ' + JSON.stringify(err));
      }
    });
  };

  PeerSync.prototype.handleBlock = function(info) {
    var self = this;
    var block = info.message.block;
    var blockHash = bitcoreUtil.formatHashFull(block.calcHash());

    console.log('[p2p_sync] Handle block: %s (allowReorgs: %s)', blockHash, self.allowReorgs);

    var tx_hashes = block.txs.map(function(tx) {
      return bitcoreUtil.formatHashFull(tx.hash);
    });

    this.sync.storeTipBlock({
      'hash': blockHash,
      'tx': tx_hashes,
      'previousblockhash': bitcoreUtil.formatHashFull(block.prev_hash),
    }, self.allowReorgs, function(err) {
      if (err && err.message.match(/NEED_SYNC/) && self.historicSync) {
        console.log('[p2p_sync] Orphan block received. Triggering sync');
        self.historicSync.start({}, function(){
          console.log('[p2p_sync] Done resync.');
        });
      }
      else if (err) {
        console.log('[p2p_sync] Error in handle Block: ' + err);
      }
    });
  };

  PeerSync.prototype.handle_connected = function(data) {
    var peerman = data.pm;
    var peers_n = peerman.peers.length;
    console.log('[p2p_sync] Connected to ' + peers_n + ' peer' + (peers_n !== 1 ? 's' : ''));
  };

  PeerSync.prototype.run = function() {
    var self = this;

    this.peerdb.forEach(function(datum) {
      var peer = new Peer(datum.ipv4, datum.port);
      self.peerman.addPeer(peer);
    });

    this.peerman.on('connection', function(conn) {
      self.connected = true;
      conn.on('inv', self.handleInv.bind(self));
      conn.on('block', self.handleBlock.bind(self));
      conn.on('tx', self.handleTx.bind(self));
    });
    this.peerman.on('connect', self.handle_connected.bind(self));

    this.peerman.on('netDisconnected', function() {
      self.connected = false;
    });

    this.peerman.start();
  };

  PeerSync.prototype.close = function() {
    this.sync.close();
  };


  return PeerSync;

}
module.defineClass(spec);
