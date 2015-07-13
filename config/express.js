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
  app.use(config.apiPrefix, setHistoric);
  app.use(config.apiPrefix, setPeer);
  app.use(require('morgan')(':remote-addr :date[iso] ":method :url" :status :res[content-length] :response-time ":user-agent" '));
  
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.methodOverride());
  app.use(express.compress());

  if (config.enableEmailstore) {
    var allowCopayCrossDomain = function(req, res, next) {
      if ('OPTIONS' == req.method) {
        res.send(200);
        res.end();
        return;
      }
      next();
    }
    app.use(allowCopayCrossDomain);
  }

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

  //Assume 404 since no middleware responded
  app.use(function(req, res) {
    res.status(404).jsonp({
      status: 404,
      url: req.originalUrl,
      error: 'Not found'
    });
  });
};
