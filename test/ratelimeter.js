'use strict';

var should = require('should');
var sinon = require('sinon');

var RateLimiter = require('../lib/ratelimiter');

describe('RateLimiter', function() {

  describe('@constructor', function() {
    it('will instantiate without options', function() {
      var limiter = new RateLimiter();
      should.exist(limiter);
    });
    it('will instantiate without new', function() {
      /* jshint newcap:false */
      var limiter = RateLimiter();
      should.exist(limiter);
    });
    it('will instantiate with options', function() {
      var whitelist = [];
      var blacklist = [];
      var node = {};
      var limiter = new RateLimiter({
        node: node,
        whitelist: whitelist,
        blacklist: blacklist,
        limit: 1,
        interval: 1,
        whitelistLimit: 1,
        whitelistInterval: 1,
        blacklistLimit: 1,
        blacklistInterval: 1
      });
      should.exist(limiter);
      should.exist(limiter.config);
      should.exist(limiter.clients);
      should.exist(limiter.node);
      limiter.whitelist.should.equal(whitelist);
      limiter.blacklist.should.equal(blacklist);
      limiter.config.whitelist.totalRequests.should.equal(1);
      limiter.config.whitelist.interval.should.equal(1);
      limiter.config.blacklist.totalRequests.should.equal(1);
      limiter.config.blacklist.interval.should.equal(1);
      limiter.config.normal.interval.should.equal(1);
      limiter.config.normal.totalRequests.should.equal(1);
    });
  });

  describe('#middleware', function() {
  });

  describe('#exceeded', function() {
    it('should not be exceeded', function() {
      var node = {};
      var limiter = new RateLimiter({node: node});
      var client = limiter.addClient('127.0.0.1');
      var exceeded = limiter.exceeded(client);
      exceeded.should.equal(false);
    });
    it('should be exceeded', function() {
      var node = {};
      var limiter = new RateLimiter({node: node});
      var client = limiter.addClient('127.0.0.1');
      client.visits = 3 * 60 * 60 + 1;
      var exceeded = limiter.exceeded(client);
      exceeded.should.equal(true);
    });
    it('should exclude whitelisted with no limit', function() {
      var node = {};
      var limiter = new RateLimiter({
        whitelist: [
          '127.0.0.1'
        ],
        node: node,
        whitelistLimit: -1
      });
      var client = limiter.addClient('127.0.0.1');
      client.visits = Infinity;
      var exceeded = limiter.exceeded(client);
      exceeded.should.equal(false);
    });
  });

  describe('#getClientName', function() {
    it('should get client name from cloudflare header', function() {
      var node = {};
      var limiter = new RateLimiter({node: node});
      var req = {
        headers: {
          'cf-connecting-ip': '127.0.0.1'
        }
      };
      var name = limiter.getClientName(req);
      name.should.equal('127.0.0.1');
    });
    it('should get client name from x forwarded header', function() {
      var node = {};
      var limiter = new RateLimiter({node: node});
      var req = {
        headers: {
          'x-forwarded-for': '127.0.0.1'
        }
      };
      var name = limiter.getClientName(req);
      name.should.equal('127.0.0.1');
    });
    it('should get client name from connection remote address', function() {
      var node = {};
      var limiter = new RateLimiter({node: node});
      var req = {
        headers: {},
        connection: {
          remoteAddress: '127.0.0.1'
        }
      };
      var name = limiter.getClientName(req);
      name.should.equal('127.0.0.1');
    });
  });

  describe('#addClient', function() {
    var sandbox = sinon.sandbox.create();
    afterEach(function() {
      sandbox.restore();
    });
    it('will remove client after interval', function() {
      var THREE_HOURS_PLUS = 3 * 60 * 60 * 1000 + 1;
      var clock = sandbox.useFakeTimers();
      var node = {};
      var limiter = new RateLimiter({node: node});
      limiter.addClient('127.0.0.1');
      should.exist(limiter.clients['127.0.0.1']);
      clock.tick(THREE_HOURS_PLUS);
      should.not.exist(limiter.clients['127.0.0.1']);
    });
  });

});
