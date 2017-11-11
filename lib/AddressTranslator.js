var Bitcore_ = {
  btc: require('bitcore-lib'),
  bch: require('bitcore-lib-cash')
};

var _ = require('lodash');

function AddressTranslator() {
};


AddressTranslator.getAddressCoin = function(address) {
  try {
    new Bitcore_['btc'].Address(address);
    return 'btc';
  } catch (e) {
    try {
      new Bitcore_['bch'].Address(address);
      return 'bch';
    } catch (e) {
      return;
    }
  }
};


AddressTranslator.translate = function(address, coin, origCoin) {
  origCoin = origCoin || AddressTranslator.getAddressCoin(address);
  var origAddress = new Bitcore_[origCoin].Address(address);
  var origObj = origAddress.toObject();

  var result = Bitcore_[coin].Address.fromObject(origObj)
  return result.toString();
};


module.exports = AddressTranslator;
