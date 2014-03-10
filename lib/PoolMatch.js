'use strict';

var imports     = require('soop').imports();
var fs          = require('fs');
var buffertools = require('buffertools');
var db          = imports.db || JSON.parse( fs.readFileSync(imports.poolMatchFile || './poolMatchFile.json'));

var PoolMatch = function() {
  var self = this;

  self.strings = {};
  db.forEach(function(pool) {
    pool.searchStrings.forEach(function(s) {
      self.strings[s] = {
        poolName: pool.poolName,
        url: pool.url
      };
    });
  });
};


PoolMatch.prototype.match = function(buffer) {
  var self = this;
  for(var k in self.strings) {
    if (buffertools.indexOf(buffer, k) >= 0) {
      return self.strings[k];
    }
  }
};

module.exports = require('soop')(PoolMatch);
