var common = require('../lib/common');
var should = require('should');
var sinon = require('sinon');

describe('common', function() {
  function invokeHandle(index, value, handler, err, result) {
    var callback;

    handler.args[index][0].should.equal(value);
    callback = handler.args[index][1];
    callback(err, result);
  }

  describe('batch', function() {
    var handler;
    var next;
    var outkey;
    var req;
    var res;

    beforeEach(function() {
      handler = sinon.stub();
      next = sinon.spy();
      outkey = 'qwerty';
      req = {};
      res = {};
    });

    it('should single input data', function() {
      common.batch(handler, outkey)(req, res, next, '123');

      handler.callCount.should.equal(1);
      invokeHandle(0, '123', handler, null, 'r123');
      handler.callCount.should.equal(1);

      should(req).have.property(outkey, 'r123');
    });

    it('should multi input data', function() {
      common.batch(handler, outkey)(req, res, next, '0,1,2');

      handler.callCount.should.equal(1);
      invokeHandle(0, '0', handler, null, 'r0');
      handler.callCount.should.equal(2);
      invokeHandle(1, '1', handler, null, 'r1');
      handler.callCount.should.equal(3);
      invokeHandle(2, '2', handler, null, 'r2');
      handler.callCount.should.equal(3);

      should(req).have.property(outkey).with.lengthOf(3);
      req[outkey][0].should.equal('r0');
      req[outkey][1].should.equal('r1');
      req[outkey][2].should.equal('r2');
    });
  });
});
