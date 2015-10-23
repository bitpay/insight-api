'use strict';

var should = require('should');
var sinon = require('sinon');
var InsightAPI = require('../lib/index');

describe('Index', function() {
  describe('#cache', function() {
    it('will set cache control header', function(done) {
      var index = new InsightAPI({
        enableCache: true
      });
      var req = {};
      var res = {
        header: sinon.stub()
      };
      var middle = index.cache(10);
      middle(req, res, function() {
        res.header.callCount.should.equal(1);
        res.header.args[0][0].should.equal('Cache-Control');
        res.header.args[0][1].should.equal('public, max-age=10');
        done();
      });
    });
    it('will NOT set cache control header', function(done) {
      var index = new InsightAPI({
        enableCache: false
      });
      var req = {};
      var res = {
        header: sinon.stub()
      };
      var middle = index.cache(10);
      middle(req, res, function() {
        res.header.callCount.should.equal(0);
        done();
      });
    });
  });
  describe('#cacheShort', function() {
    it('will set SHORT cache control header', function(done) {
      var index = new InsightAPI({
        enableCache: true,
        cacheShortSeconds: 35
      });
      var req = {};
      var res = {
        header: sinon.stub()
      };
      var middle = index.cacheShort();
      middle(req, res, function() {
        res.header.callCount.should.equal(1);
        res.header.args[0][0].should.equal('Cache-Control');
        res.header.args[0][1].should.equal('public, max-age=35');
        done();
      });
    });
    it('will set SHORT DEFAULT cache control header', function(done) {
      var index = new InsightAPI({
        enableCache: true
      });
      var req = {};
      var res = {
        header: sinon.stub()
      };
      var middle = index.cacheShort();
      middle(req, res, function() {
        res.header.callCount.should.equal(1);
        res.header.args[0][0].should.equal('Cache-Control');
        res.header.args[0][1].should.equal('public, max-age=30');
        done();
      });
    });
  });
  describe('#cacheLong', function() {
    it('will set LONG cache control header', function(done) {
      var index = new InsightAPI({
        enableCache: true,
        cacheLongSeconds: 86400000
      });
      var req = {};
      var res = {
        header: sinon.stub()
      };
      var middle = index.cacheLong();
      middle(req, res, function() {
        res.header.callCount.should.equal(1);
        res.header.args[0][0].should.equal('Cache-Control');
        res.header.args[0][1].should.equal('public, max-age=86400000');
        done();
      });
    });
    it('will set LONG DEFAULT cache control header', function(done) {
      var index = new InsightAPI({
        enableCache: true
      });
      var req = {};
      var res = {
        header: sinon.stub()
      };
      var middle = index.cacheLong();
      middle(req, res, function() {
        res.header.callCount.should.equal(1);
        res.header.args[0][0].should.equal('Cache-Control');
        res.header.args[0][1].should.equal('public, max-age=86400');
        done();
      });
    });
  });
});
