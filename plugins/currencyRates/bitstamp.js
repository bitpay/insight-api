var _ = require('lodash');

module.exports.id = 'Bitstamp';
module.exports.url = 'https://www.bitstamp.net/api/ticker/';

module.exports.parseFn = function(raw) {
  return [{
    code: 'USD',
    rate: parseFloat(raw.last)
  }];
};
