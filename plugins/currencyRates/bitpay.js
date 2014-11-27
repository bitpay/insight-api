var _ = require('lodash');

module.exports.id = 'BitPay';
module.exports.url = 'https://bitpay.com/api/rates/';

module.exports.parseFn = function(raw) {
  var rates = _.compact(_.map(raw, function(d) {
    if (!d.code || !d.rate) return null;
    return {
      code: d.code,
      rate: d.rate,
    };
  }));
  return rates;
};
