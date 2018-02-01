'use strict';

var request = require('request');

function CurrencyController(options) {
  this.node = options.node;
  var refresh = options.currencyRefresh || CurrencyController.DEFAULT_CURRENCY_DELAY;
  this.currencyDelay = refresh * 60000;
  this.currencySource  = options.currencySource || CurrencyController.DEFAULT_CURRENCY_SOURCE;
  this.bitstampRate = 0;
  this.timestamp = Date.now();
}

CurrencyController.DEFAULT_CURRENCY_DELAY = 10;
CurrencyController.DEFAULT_CURRENCY_SOURCE = 'cryptonator';

CurrencyController.PROVIDERS = {
  cryptonator:
  {
    url: 'https://api.cryptonator.com/api/ticker/vtc-usd',
    parseRate: function(data) {
      return parseFloat(data.ticker.price);
    }
  },
  coinmarketcap: {
    url: 'https://api.coinmarketcap.com/v1/ticker/vertcoin/?convert=USD',
    parseRate: function(data) {
      return parseFloat(data[0].price_usd);
    }
  }
};

CurrencyController.prototype.index = function(req, res) {
  var self = this;
  var currentTime = Date.now();
  if (self.bitstampRate === 0 || currentTime >= (self.timestamp + self.currencyDelay)) {
    self.timestamp = currentTime;
    var provider = CurrencyController.PROVIDERS[self.currencySource];
    request(provider.url, function(err, response, body) {
      if (err) {
        self.node.log.error(err);
      } else if (response.statusCode === 200) {
        try {
          self.bitstampRate = provider.parseRate(JSON.parse(body));
        } catch (e) {
          self.node.log.error(e);
        }
      }
      res.jsonp({
        status: 200,
        data: { 
          bitstamp: self.bitstampRate
        }
      });
    });
  } else {
    res.jsonp({
      status: 200,
      data: { 
        bitstamp: self.bitstampRate
      }
    });
  }

};

module.exports = CurrencyController;
