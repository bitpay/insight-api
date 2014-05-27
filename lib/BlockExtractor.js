'use strict';
var  bitcore  = require('bitcore'),
     Block    = bitcore.Block,
     networks = bitcore.networks,
     Parser   = bitcore.BinaryParser,
     fs       = require('fs'),
     Buffer   = bitcore.Buffer,
     glob     = require('glob'),
     async    = require('async');

function BlockExtractor(dataDir, network) {

  var self = this;
  var path = dataDir + '/blocks/blk*.dat';

  self.dataDir = dataDir;
  self.files   = glob.sync(path);
  self.nfiles  = self.files.length;

  if (self.nfiles === 0)
    throw new Error('Could not find block files at: ' + path);

  self.currentFileIndex = 0;
  self.isCurrentRead    = false;
  self.currentBuffer    = null;
  self.currentParser    = null;
  self.network = network === 'testnet' ? networks.testnet: networks.livenet;
  self.magic   = self.network.magic.toString('hex');
}

BlockExtractor.prototype.currentFile = function() {
  var self = this;

  return self.files[self.currentFileIndex];
};


BlockExtractor.prototype.nextFile = function() {
  var self = this;

  if (self.currentFileIndex < 0) return false;

  var ret  = true;

  self.isCurrentRead = false;
  self.currentBuffer = null;
  self.currentParser = null;

  if (self.currentFileIndex < self.nfiles - 1) {
    self.currentFileIndex++;
  }
  else {
    self.currentFileIndex=-1;
    ret = false;
  }
  return ret;
};

BlockExtractor.prototype.readCurrentFileSync = function() {
  var self = this;

  if (self.currentFileIndex < 0 || self.isCurrentRead) return;


  self.isCurrentRead = true;

  var fname = self.currentFile();
  if (!fname) return;


  var stats = fs.statSync(fname);

  var size = stats.size;

  console.log('Reading Blockfile %s [%d MB]',
            fname, parseInt(size/1024/1024));

  var fd = fs.openSync(fname, 'r');

  var buffer = new Buffer(size);

  fs.readSync(fd, buffer, 0, size, 0);

  self.currentBuffer = buffer;
  self.currentParser = new Parser(buffer);
};



BlockExtractor.prototype.getNextBlock = function(cb) {
  var self = this;

  var b;
  var magic;
  async.series([
    function (a_cb) {

      async.whilst(
        function() {
          return (!magic || magic === '00000000');
        },
        function(w_cb) {
          magic = null;

          self.readCurrentFileSync();
          if (self.currentFileIndex < 0) return cb();

          var byte0 = self.currentParser ? self.currentParser.buffer(1).toString('hex') : null;

          if (byte0) {
            // Grab 3 bytes from block without removing them
            var p = self.currentParser.pos;
            var bytes123 = self.currentParser.subject.toString('hex',p,p+3);
            magic = byte0 + bytes123;

            if (magic !=='00000000' && magic !== self.magic) {

              if (self.errorCount++ > 4) 
                return cb(new Error('CRITICAL ERROR: Magic number mismatch: ' +
                    magic + '!=' + self.magic));

              magic=null;
            }
          } 

          if (!self.currentParser || self.currentParser.eof() ) {
            if (self.nextFile()) 
              console.log('Moving forward to file:' + self.currentFile() );
            else 
              console.log('Finished all files');

            magic = null;
            return w_cb();
          }
          else {
            return w_cb();
          }
        }, a_cb);
    },
    function (a_cb) {
      if (!magic) return a_cb();
      // Remove 3 bytes from magic and spacer
      self.currentParser.buffer(3+4);
      return a_cb();
    },
    function (a_cb) {
      if (!magic) return a_cb();

      b = new Block();
      b.parse(self.currentParser);
      b.getHash();
      self.errorCount=0;
      return a_cb();
    },
  ], function(err) {
    return cb(err,b);
  });
};

module.exports = require('soop')(BlockExtractor);

