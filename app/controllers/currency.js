'use strict';

var config = require('../../config/config');

// Set the initial vars
var timestamp = +new Date(),
    delay = config.currencyRefresh * 60000,
    usdRate = 0;

exports.index = function(req, res) {

  var _xhr = function() {
    if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest !== null) {
      return new XMLHttpRequest();
    } else if (typeof require !== 'undefined' && require !== null) {
      var XMLhttprequest = require('xmlhttprequest').XMLHttpRequest;
      return new XMLhttprequest();
    }
  };

  var _request = function(url, cb) {
    var request;
    request = _xhr();
    request.open('GET', url, true);
    request.onreadystatechange = function() {
      if (request.readyState === 4) {
        if (request.status === 200) {
          return cb(false, request.responseText);
        }

        return cb(true, {
          status: request.status,
          message: 'Request error'
        });
      }
    };

    return request.send(null);
  };

  // Init
  var currentTime = +new Date();
  if (usdRate === 0 || currentTime >= (timestamp + delay)) {
    timestamp = currentTime;

    _request('http://coinmarketcap-nexuist.rhcloud.com/api/dgb', function(err, data) {
      if (!err) usdRate = parseFloat(JSON.parse(data).price.usd);

      res.jsonp({
        status: 200,
        data: { bitstamp: usdRate }
      });
    });
  } else {
    res.jsonp({
      status: 200,
      data: { bitstamp: usdRate }
    });
  }
};
