#!/usr/bin/env node 

'use strict';

var HistoricSync = require('../lib/HistoricSync');
var async = require('async');


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
    console.log('[1/3] Migrating txs ... (this will take some minutes...)'); //TODO
    txDb.migrateV02(c);
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
          if (hash) height++;
          if (!(height%1000) || !hash) {
            console.log('[2/3] migrating blocks \t%d blocks processed', height);
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
    console.log('[3/3] Migrating txs... (this will take some minutes...)'); //TODO
    bDb.migrateV02(c);
  },
  function(c){
    bDb.setTip(tipHash, height, c);
  },
  function(c){
    bDb.migrateV02cleanup(c);
  },
  ],function(err){
    if (err)
      console.log('## '+err);
    else
      console.log('Finished OK.');
});
