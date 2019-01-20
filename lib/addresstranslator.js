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

AddressTranslator.translate = function(addresses, coin, origCoin) {
  var wasArray = true;
  if (!_.isArray(addresses)) {
    wasArray = false;
    addresses = [addresses];
  }
  origCoin = origCoin || AddressTranslator.getAddressCoin(addresses[0]);
  var ret =  _.map(addresses, function(x) {
    var orig = new Bitcore_[origCoin].Address(x).toObject();
    if (origCoin === 'bch') {
      return Bitcore_[coin].Address.fromObject(orig).toString();
    }
    var oldBitpayBchAddress = Bitcore_[coin].Address.fromObject(orig).toString();
    var cash = require('bitcore-lib-cash');
    var Address = cash.Address;
    var newFormatAddress = new Address(oldBitpayBchAddress);
    var newFormatAddressString = newFormatAddress.toCashAddress().replace(/^bitcoincash\:/, ''); 
    return newFormatAddressString;
  });

  if (wasArray) 
    return ret;
  else 
    return ret[0];

};

AddressTranslator.translateInput = function(addresses) {
  return this.translate(addresses, 'btc', 'bch');
}

AddressTranslator.translateOutput = function(addresses) {
  return this.translate(addresses, 'bch', 'btc');
}




module.exports = AddressTranslator;
