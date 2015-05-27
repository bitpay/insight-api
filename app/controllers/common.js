'use strict';

exports.notReady = function (err, res, p) {
  res.status(503).send('Server not yet ready. Sync Percentage:' + p);
};

exports.handleErrors = function (err, res) {
  if (err) {
    if (err.code)  {
      res.status(400).send(err.message + '. Code:' + err.code);
    }
    else {
      res.status(503).send(err.message);
    }
  }
  else {
    res.status(404).send('Not found');
  }
};
