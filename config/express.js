'use strict';

/**
 * Module dependencies.
 */
var express = require('express');
var config = require('./config');
var path = require('path');
var logger = require('../lib/logger').logger;

module.exports = function(app, historicSync, peerSync) {


  //custom middleware
  var setHistoric = function(req, res, next) {
    req.historicSync = historicSync;
    next();
  };

  var setPeer = function(req, res, next) {
    req.peerSync = peerSync;
    next();
  };

  app.set('showStackError', true);
  app.set('json spaces', 0);

  app.enable('jsonp callback');
  app.use(config.apiPrefix + '/sync', setHistoric);
  app.use(config.apiPrefix + '/peer', setPeer);
  app.use(express.logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.methodOverride());
  app.use(express.compress());

  if (config.publicPath) {
    var staticPath = path.normalize(config.rootPath + '/../' + config.publicPath);
    //IMPORTANT: for html5mode, this line must to be before app.router
    app.use(express.static(staticPath));
  }

  app.use(function(req, res, next) {
    app.locals.config = config;
    next();
  });

  //routes should be at the last
  app.use(app.router);

  //Assume "not found" in the error msgs is a 404
  app.use(function(err, req, res, next) {
    if (~err.message.indexOf('not found')) return next();
    console.error(err.stack);
    res.status(500).jsonp({
      status: 500,
      error: err.stack
    });
  });

  //Assume 404 since no middleware responded
  app.use(function(req, res) {
    res.status(404).jsonp({
      status: 404,
      url: req.originalUrl,
      error: 'Not found'
    });
  });
};
