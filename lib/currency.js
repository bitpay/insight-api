'use strict';

var request = require('request');

function CurrencyController(options) {
  this.node = options.node;
  this.currency = options.currency;
  this._setApi();
  var refresh = options.currencyRefresh || CurrencyController.DEFAULT_CURRENCY_DELAY;
  this.currencyDelay = refresh * 60000;
  this.rate = 0;
  this.timestamp = Date.now();
}

CurrencyController.DEFAULT_CURRENCY_DELAY = 10;

CurrencyController.prototype._setApi = function() {
  if (this.currency === 'BCH') {
    this._api = this._kraken;
    this._apiLabel = 'kraken';
    return;
  }
  this._apiLabel = 'bitstamp';
  this._api = this._bitstamp;
};

CurrencyController.prototype._kraken = function(res) {

  var self = this;
  request('https://api.kraken.com/0/public/Ticker?pair=BCHUSD', function(err, response, body) {

    if (err) {
      self.node.log.error(err);
    }

    if (!err && response.statusCode === 200) {
      self.rate = parseFloat(JSON.parse(body).result.BCHUSD.c[0]);
    }

    res.jsonp({
      status: 200,
      data: {
        kraken: self.rate
      }
    });

  });
};

CurrencyController.prototype._bitstamp = function(res) {

  var self = this;

  request('https://www.bitstamp.net/api/ticker/', function(err, response, body) {

    if (err) {
      self.node.log.error(err);
    }

    if (!err && response.statusCode === 200) {
      self.rate = parseFloat(JSON.parse(body).last);
    }

    res.jsonp({
      status: 200,
      data: {
        bitstamp: self.rate
      }
    });

  });
};

CurrencyController.prototype.index = function(req, res) {

  var self = this;
  var currentTime = Date.now();

  if (self.rate === 0 || currentTime >= (self.timestamp + self.currencyDelay)) {

    self.timestamp = currentTime;
    self._api.call(self, res);

  } else {

    var data = {};
    data[self._apiLabel] = self.rate;

    res.jsonp({
      status: 200,
      data: data
    });

  }

};

module.exports = CurrencyController;
