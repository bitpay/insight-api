var Flocore_ = {
  btc: require('flocore-lib'),
  bch: require('flocore-lib-cash')
};

var _ = require('lodash');

function AddressTranslator() {
};


AddressTranslator.getAddressCoin = function(address) {
  try {
    new Flocore_['btc'].Address(address);
    return 'btc';
  } catch (e) {
    try {
      new Flocore_['bch'].Address(address);
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
    var orig = new Flocore_[origCoin].Address(x).toObject();
    return Flocore_[coin].Address.fromObject(orig).toString();
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
