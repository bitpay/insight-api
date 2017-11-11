
var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var assert = require('assert');
var should = chai.should;

var AddressTranslator = require('../lib/AddressTranslator');

describe('#AddressTranslator', function() {
  it('should translate address from btc to bch', function() {
    var res = AddressTranslator.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'bch');
    assert( res == 'CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
  });
  it('should translate address from bch to btc', function() {
    var res = AddressTranslator.translate('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS', 'btc');
    assert(res=='36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
  });

  it('should keep the address if there is nothing to do (bch)', function() {
    var res = AddressTranslator.translate('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz', 'bch');
    assert(res=='CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
  });
  it('should keep the address if there is nothing to do (btc)', function() {
    var res = AddressTranslator.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'btc');
    assert(res=='1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
  });
  it('should support 3 params NOK', function() {
    (function() {
    var res = AddressTranslator.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'btc', 'bch');
    }).should.throw('Address has mismatched network type.');
  });
  it('should support 3 params OK', function() {
    var res = AddressTranslator.translate('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS', 'btc', 'bch');
    assert(res=='36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
  });

});


