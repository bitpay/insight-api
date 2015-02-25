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
  var path = dataDir + '/blocks/blk*.dat';

  this.dataDir = dataDir;
  this.files   = glob.sync(path);
  this.nfiles  = this.files.length;

  if (this.nfiles === 0)
    throw new Error('Could not find block files at: ' + path);

  this.currentFileIndex = 0;
  this.isCurrentRead    = false;
  this.currentBuffer    = null;
  this.currentParser    = null;
  this.network = network === 'testnet' ? networks.testnet: networks.livenet;
  this.magic   = this.network.magic.toString('hex');
}

BlockExtractor.prototype.currentFile = function() {
  return this.files[this.currentFileIndex];
};


BlockExtractor.prototype.nextFile = function() {
  if (this.currentFileIndex < 0) return false;

  var ret  = true;

  this.isCurrentRead = false;
  this.currentBuffer = null;
  this.currentParser = null;

  if (this.currentFileIndex < this.nfiles - 1) {
    this.currentFileIndex++;
  }
  else {
    this.currentFileIndex=-1;
    ret = false;
  }
  return ret;
};

BlockExtractor.prototype.readCurrentFileSync = function() {
  if (this.currentFileIndex < 0 || this.isCurrentRead) return;

  this.isCurrentRead = true;

  var fname = this.currentFile();
  if (!fname) return;


  var stats = fs.statSync(fname);

  var size = stats.size;
  var mb = parseInt(size/1024/1024);
  
  console.log('Reading Blockfile %s [%d MB]',
            fname, mb);
            
  if(mb > 1023)
    throw new Error('CRITICAL ERROR: file size greater than 1023MB, use cat blk*.dat > bootstrap.dat to create new '
                          + 'dat files @128MB. (https://github.com/bitpay/insight-api/issues/35)');
    
  var fd = fs.openSync(fname, 'r');

  var buffer = new Buffer(size);

  fs.readSync(fd, buffer, 0, size, 0);

  this.currentBuffer = buffer;
  this.currentParser = new Parser(buffer);
};




BlockExtractor.prototype._getMagic = function() {
  if (!this.currentParser) 
    return null;

  var byte0 = this.currentParser ? this.currentParser.buffer(1).toString('hex') : null;



  // Grab 3 bytes from block without removing them
  var p = this.currentParser.pos;
  var bytes123 = this.currentParser.subject.toString('hex',p,p+3);
  var magic = byte0 + bytes123;

  if (magic !=='00000000' && magic !== this.magic) {
    if(this.errorCount++ > 4)
      throw new Error('CRITICAL ERROR: Magic number mismatch: ' +
                          magic + '!=' + this.magic);
    magic=null;
  }
  
  if (magic==='00000000') 
    magic =null;

  return magic;
};

BlockExtractor.prototype.getNextBlock = function(cb) {
  var b;
  var magic;
  var isFinished = 0;

  while(!magic && !isFinished)  {
    this.readCurrentFileSync();
    magic= this._getMagic();

    if (!this.currentParser || this.currentParser.eof() ) {

      if (this.nextFile()) {
        console.log('Moving forward to file:' + this.currentFile() );
        magic = null;
      } else {
        console.log('Finished all files');
        isFinished = 1;
      }
    }
  }
  if (isFinished)
    return cb();

  // Remove 3 bytes from magic and spacer
  this.currentParser.buffer(3+4);

  b = new Block();
  b.parse(this.currentParser);
  b.getHash();
  this.errorCount=0;
  return cb(null,b);
};

module.exports = require('soop')(BlockExtractor);

