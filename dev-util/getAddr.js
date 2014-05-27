#!/usr/bin/env node
'use strict';

var util = require('util'),
  config  = require('../config/config');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var A = require('../app/models/Address');

// var hash = process.argv[2] || '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';
var hash = process.argv[2] || 'mp3Rzxx9s1A21SY3sjJ3CQoa2Xjph7e5eS';

var a= new A(hash);
a.update(function(err) {
  console.log('Err:');
  console.log(err);

  console.log('Ret:');
  console.log(util.inspect(a,{depth:null}));

})



