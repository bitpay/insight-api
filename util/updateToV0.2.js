#!/usr/bin/env node 

'use strict';

var HistoricSync = require('../lib/HistoricSync');
var async = require('async');

//
// 1)
// var MAIN_PREFIX       = 'bma-';     // bma-<hash> =>    <height> (0 is unconnected)
// var TIP               = 'bti-';     // bti = <hash>:<height> last block on the chain
//
// var IN_BLK_PREFIX = 'btx-'; //btx-<txid> = <block> 
// v
// 2) DELETE txs/tx-
// 3) DELETE txs/txb
//


var historicSync = new HistoricSync({ shouldBroadcastSync: false });
var txDb=historicSync.sync.txDb;
var bDb=historicSync.sync.bDb;

var height  = 0;
var hash    = historicSync.genesis;
var tipHash;

async.series([
  function(c){
    txDb.checkVersion02(function(isV2){
      var err;
      if(isV2) err='Already in v0.2!';
      return c(err);
    });
  },
  function(c){
    var script=[];
    async.whilst(
      function() {
        return hash;
      },
      function (w_cb) {
        script=script.concat(bDb._setHeightScript(hash,height));
        bDb.getNext(hash,function(err,val){
          if (err) return w_cb(err);
          tipHash = hash;
          hash = val;
          height++;
          if (!(height%1000) || !hash) {
            console.log('\t%d blocks processed (set height 1/2)', height);
            bDb._runScript(script, function(err) {
              script=[];
              return w_cb(err);
            });
          }
          else return w_cb();
        });
      }, c);
  },
  function(c){
    bDb.setTip(tipHash, height-1, c);
  },
  ],function(err){
    if (err)
      console.log('## '+err);
    else
      console.log('Finished OK.');
});
