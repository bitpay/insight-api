#!/usr/bin/env node 
'use strict';

 var   levelup     = require('levelup');



var dbPath = process.argv[2];
var s       = process.argv[3];
console.log('DB: ',dbPath); //TODO



var db = levelup(dbPath );


db.createReadStream({start: s, end: s+'~'})
  .on('data', function (data) {
    console.log(data.key + ' => ' + data.value); //TODO
  })
  .on('error', function () {
  })
  .on('end', function () {
  });


