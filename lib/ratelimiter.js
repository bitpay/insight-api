'use strict';

var THREE_HOURS = 3 * 60 * 60 * 1000;

/**
 * A rate limiter to be used as an express middleware.
 *
 * @param {Object} options
 * @param {Object} options.node - The bitcore node object
 * @param {Number} options.limit - Number of requests for normal rate limiter
 * @param {Number} options.interval - Interval of the normal rate limiter
 * @param {Array} options.whitelist - IP addresses that should have whitelist rate limiting
 * @param {Array} options.blacklist - IP addresses that should be blacklist rate limiting
 * @param {Number} options.whitelistLimit - Number of requests for whitelisted clients
 * @param {Number} options.whitelistInterval - Interval for whitelisted clients
 * @param {Number} options.blacklistLimit - Number of requests for blacklisted clients
 * @param {Number} options.blacklistInterval - Interval for blacklisted clients
 */
function RateLimiter(options) {
  if (!(this instanceof RateLimiter)) {
    return new RateLimiter(options);
  }

  if (!options){
    options = {};
  }

  this.node = options.node;
  this.clients = {};
  this.whitelist = options.whitelist || [];
  this.blacklist = options.blacklist || [];

  this.config = {
    whitelist: {
      totalRequests: options.whitelistLimit || 3 * 60 * 60 * 10, // 108,000
      interval: options.whitelistInterval || THREE_HOURS
    },
    blacklist: {
      totalRequests: options.blacklistLimit || 0,
      interval: options.blacklistInterval || THREE_HOURS
    },
    normal: {
      totalRequests: options.limit || 3 * 60 * 60, // 10,800
      interval: options.interval || THREE_HOURS
    }
  };

}

RateLimiter.prototype.middleware = function() {
  var self = this;
  return function(req, res, next) {
    self._middleware(req, res, next);
  };
};

RateLimiter.prototype._middleware = function(req, res, next) {

  var name = this.getClientName(req);
  var client = this.clients[name];

  res.ratelimit = {
    clients: this.clients,
    exceeded: false
  };

  if (!client) {
    client = this.addClient(name);
  }

  res.setHeader('X-RateLimit-Limit', this.config[client.type].totalRequests);
  res.setHeader('X-RateLimit-Remaining', this.config[client.type].totalRequests - client.visits);

  res.ratelimit.exceeded = this.exceeded(client);
  res.ratelimit.client = client;

  if (!this.exceeded(client)) {
    client.visits++;
    next();
  } else {
    this.node.log.warn('Rate limited:', client);
    res.status(429).jsonp({
      status: 429,
      error: 'Rate limit exceeded'
    });
  }
};

RateLimiter.prototype.exceeded = function(client) {
  if (this.config[client.type].totalRequests === -1) {
    return false;
  } else {
    return client.visits > this.config[client.type].totalRequests;
  }
};

RateLimiter.prototype.getClientType = function(name) {
  if (this.whitelist.indexOf(name) > -1) {
    return 'whitelist';
  }
  if (this.blacklist.indexOf(name) > -1) {
    return 'blacklist';
  }
  return 'normal';
};

RateLimiter.prototype.getClientName = function(req) {
  var name = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  return name;
};

RateLimiter.prototype.addClient = function(name) {
  var self = this;

  var client = {
    name: name,
    type: this.getClientType(name),
    visits: 1
  };

  var resetTime = this.config[client.type].interval;

  setTimeout(function() {
    delete self.clients[name];
  }, resetTime).unref();

  this.clients[name] = client;

  return client;

};

module.exports = RateLimiter;
