'use strict';

var sinon = require('sinon');
var should = require('should');
var UtilsController = require('../lib/utils');

describe('Utils', function() {
  describe('/utils/estimatefee', function() {
    it('should give the correct fee', function(done) {
      var node = {
        services: {
          bitcoind: {
            estimateFee: function(blocks) {
              switch(blocks) {
                case 1:
                  return 1000;
                case 3:
                  return 3000;
              }
            }
          }
        }
      };
      var utils = new UtilsController(node);

      var req = {
        query: {
          nbBlocks: '1, 3'
        }
      };

      var res = {
        jsonp: function(fees) {
          should(fees).eql({1: 0.00001, 3: 0.00003});
          done();
        }
      };
      utils.estimateFee(req, res);
    });
  });
});
