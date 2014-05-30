#!/usr/bin/env node
'use strict';

var util = require('util'),
  config  = require('../config/config');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var TransactionDb = require('../lib/TransactionDb.js').default();
var hash = process.argv[2] || '4286d6fc82a314348af4e9d3ce649f78ce4569937e9ad6613563755f0d14e3d1';

var t= TransactionDb.fromIdWithInfo(hash,function(err,tx) {
  console.log('Err:');
  console.log(err);

  console.log('Ret:');
  console.log(util.inspect(tx,{depth:null}));
});



