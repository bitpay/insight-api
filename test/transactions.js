'use strict';
var should = require('should');
var sinon = require('sinon');
var TxController = require('../lib/transactions');
var bcoin = require('bcoin');
var _ = require('lodash');

describe('Transactions', function() {

  describe('/tx/:txid', function() {

    it('should have correct data', function(done) {

      var insight = {
        'txid': 'eac9723230b8b632117ac3d75288d6f8eb81cf1ea553eb9fd42562d5f767d54a',
        'version': 1,
        'locktime': 0,
        'vin': [
          {
            'txid': '46e58a68bb9ec9b458a9599dc2bac1e1fa09ad15c29c7f923c8f6f0aa33d6456',
            'vout': 1,
            'sequence': 4294967295,
            'n': 0,
            'scriptSig': {
              'hex': '47304402203ddb49db43074b421ec6d5604ae91aac37f4715139e0c83ea1145379e8cbf02702207fbc92c4038ad501989b097844ae4e337c9388f0713110620b40e582b85fdff3012102cd90aa18ec8e3b35c0447ffc713c945cb837429d33d075d1b0f050c72ea838d2',
              'asm': '304402203ddb49db43074b421ec6d5604ae91aac37f4715139e0c83ea1145379e8cbf02702207fbc92c4038ad501989b097844ae4e337c9388f0713110620b40e582b85fdff301 02cd90aa18ec8e3b35c0447ffc713c945cb837429d33d075d1b0f050c72ea838d2'
            },
            'addr': '1NqgMfGUeELP2BfxD4hQuJSRq2d3DVJcCi',
            'valueSat': 1546063700,
            'value': 15.460637,
            'doubleSpentTxID': null,
            'isConfirmed': null,
            'confirmations': null,
            'unconfirmedInput': null
          }
        ],
        'vout': [
          {
            'value': '0.37100000',
            'n': 0,
            'scriptPubKey': {
              'hex': '76a914bc345e0e0e5b0dbddb7b35ef3430fedd528dd1b788ac',
              'asm': 'OP_DUP OP_HASH160 bc345e0e0e5b0dbddb7b35ef3430fedd528dd1b7 OP_EQUALVERIFY OP_CHECKSIG',
              'addresses': [
                '1JA8mcfrBv1YYsASAp9jtohm8x2q7LnUhs'
              ],
              'type': 'pubkeyhash'
            },
            'spentHeight': null,
            'spentIndex': null,
            'spentTxId': null
          },
          {
            'value': '15.08763700',
            'n': 1,
            'scriptPubKey': {
              'hex': '76a914c2c74d7519d4425fc1a253f066d980164341554a88ac',
              'asm': 'OP_DUP OP_HASH160 c2c74d7519d4425fc1a253f066d980164341554a OP_EQUALVERIFY OP_CHECKSIG',
              'addresses': [
                '1Jktr121Hm63qtWBMV8dCNJNW2KtWXy4fp'
              ],
              'type': 'pubkeyhash'
            },
            'spentHeight': null,
            'spentIndex': null,
            'spentTxId': null
          }
        ],
        'blockhash': '0000000000000000009d2e9b7a984d55c6c99ba62f98e9bc7dad8b1e779045a3',
        'blockheight': 481763,
        'confirmations': 4,
        'time': 1503507151,
        'blocktime': 1503507151,
        'valueOut': 15.458637,
        'size': 225,
        'valueIn': 15.460637,
        'fees': 0.002
      };

      var bcoinTx = bcoin.tx.fromRaw('010000000156643da30a6f8f3c927f9cc215ad09fae1c1bac29d59a958b4c99ebb688ae546010000006a47304402203ddb49db43074b421ec6d5604ae91aac37f4715139e0c83ea1145379e8cbf02702207fbc92c4038ad501989b097844ae4e337c9388f0713110620b40e582b85fdff3012102cd90aa18ec8e3b35c0447ffc713c945cb837429d33d075d1b0f050c72ea838d2ffffffff02e0193602000000001976a914bc345e0e0e5b0dbddb7b35ef3430fedd528dd1b788ac34e8ed59000000001976a914c2c74d7519d4425fc1a253f066d980164341554a88ac00000000', 'hex');

      bcoinTx.__blockhash = '0000000000000000009d2e9b7a984d55c6c99ba62f98e9bc7dad8b1e779045a3';
      bcoinTx.blockhash = '0000000000000000009d2e9b7a984d55c6c99ba62f98e9bc7dad8b1e779045a3';
      bcoinTx.__height = 481763;
      bcoinTx.__inputValues = [ 1546063700 ];
      bcoinTx.__timestamp = 1503507151;
      bcoinTx.inputSatoshis = [ 1546063700 ];
      bcoinTx.feeSatoshis = 200000;
      bcoinTx.outputSatoshis = 1545863700;

      var node = {
        services: {
          block: {
            getTip: sinon.stub().returns({ height: 481766 })
          },
          transaction: {
            getDetailedTransaction: sinon.stub().callsArgWith(2, null, bcoinTx)
          }
        }
      };

      var transactions = new TxController(node);
      var txid = 'eac9723230b8b632117ac3d75288d6f8eb81cf1ea553eb9fd42562d5f767d54a';
      var req = {
        params: {
          txid: txid
        }
      };

      var res = {};
      var next = function() {
        should(req.transaction).eql(insight);
        done();
      };

      transactions.transaction(req, res, next);
    });
  });

  describe('/txs', function() {

    var sandbox = sinon.sandbox.create();

    afterEach(function() {
      sandbox.restore();
    });

    it('by block hash', function(done) {

      var blockOverview = {
        hash: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
        height: 533974,
        chainWork: '0000000000000000000000000000000000000000000000054626b1839ade284a',
        prevHash: '00000000000001a55f3214e9172eb34b20e0bc5bd6b8007f3f149fca2c8991a4',
        txids: [
          '9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5'
        ]
      };

      var bcoinTx = bcoin.tx.fromRaw('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0704ffff001d010bffffffff0100f2052a010000004341047211a824f55b505228e4c3d5194c1fcfaa15a456abdf37f9b9d97a4040afc073dee6c89064984f03385237d92167c13e236446b417ab79a0fcae412ae3316b77ac00000000', 'hex');

      bcoinTx.__blockhash = '000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd';
      bcoinTx.blockhash = '000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd';
      bcoinTx.__height = 2;
      bcoinTx.__inputValues = [ 1546063700 ];
      bcoinTx.__timestamp = 1231469744;
      bcoinTx.inputSatoshis = [ 1546063700 ];
      bcoinTx.feeSatoshis = 0;
      bcoinTx.outputSatoshis = 5000000000;

      var node = {

        services: {
          block: {
            getTip: sinon.stub().returns({ height: 481773 }),
            getBlockOverview: sinon.stub().callsArgWith(1, null, blockOverview),
          },

          transaction: {
            getDetailedTransaction: sinon.stub().callsArgWith(2, null, bcoinTx)
          }
        }

      };

      var transactions = new TxController(node);

      var insight = {
        'pagesTotal': 1,
        'txs': [
          {
            'txid': '9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5',
            'version': 1,
            'locktime': 0,
            'vin': [
              {
                'coinbase': '04ffff001d010b',
                'sequence': 4294967295,
                'n': 0
              }
            ],
            'vout': [
              {
                'value': '50.00000000',
                'n': 0,
                'scriptPubKey': {
                  'hex': '41047211a824f55b505228e4c3d5194c1fcfaa15a456abdf37f9b9d97a4040afc073dee6c89064984f03385237d92167c13e236446b417ab79a0fcae412ae3316b77ac',
                  'asm': '047211a824f55b505228e4c3d5194c1fcfaa15a456abdf37f9b9d97a4040afc073dee6c89064984f03385237d92167c13e236446b417ab79a0fcae412ae3316b77 OP_CHECKSIG',
                  'addresses': [
                    '1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1'
                  ],
                  'type': 'pubkeyhash'
                },
                'spentHeight': null,
                'spentIndex': null,
                'spentTxId': null
              }
            ],
            'blockhash': '000000006a625f06636b8bb6ac7b960a8d03705d1ace08b1a19da3fdcc99ddbd',
            'blockheight': 2,
            'confirmations': 481772,
            'time': 1231469744,
            'blocktime': 1231469744,
            'isCoinBase': true,
            'valueOut': 50,
            'size': 134
          }
        ]
      };

      var req = {
        query: {
          block: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7'
        }
      };

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };

      transactions.list(req, res);
    });

    it('by address, single/coinbase', function(done) {

      var hex = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff3103835807244d696e656420627920416e74506f6f6c6a2f4542312f4144362f4e59412f1d205999aaa02b1200001fff0200ffffffff026fb2a54c000000001976a914ad7309dfc032d7f6b652e0c29ee353e63fffec6688ac0000000000000000266a24aa21a9ed55882e9fed16c5d3b6d77e4160a56f58c70d354d02888a99486125b638231c8100000000';

      var bcoinTx = bcoin.tx.fromRaw(hex, 'hex');
      bcoinTx.__height = 481411;
      bcoinTx.outputSatoshis = 1285927535;
      bcoinTx.__timestamp = 1503242912;
      bcoinTx.__blockhash = '000000000000000000926a0cd4a05ef116514cbf1852edc306d13eb951ec0b54';
      bcoinTx.blockhash = '000000000000000000926a0cd4a05ef116514cbf1852edc306d13eb951ec0b54';

      var node = {
        services: {
          block: {
            getTip: sinon.stub().returns({ height: 534223 })
          },
          address:  {
            getAddressHistory: sinon.stub().callsArgWith(2, null, {
              totalCount: 1,
              from: 0,
              to: 0xffffffff,
              items: [bcoinTx]
            })
          }
        }
      };

      var insight = {
        'pagesTotal': 1,
        'txs': [
          {
            'txid': '1c01a2090db0850e1f1049bea02e4bbf44b6790dfeb8e054f2beb69339ef52d4',
            'version': 1,
            'locktime': 0,
            'vin': [
              {
                'coinbase': '03835807244d696e656420627920416e74506f6f6c6a2f4542312f4144362f4e59412f1d205999aaa02b1200001fff0200',
                'sequence': 4294967295,
                'n': 0
              }
            ],
            'vout': [
              {
                'value': '12.85927535',
                'n': 0,
                'scriptPubKey': {
                  'hex': '76a914ad7309dfc032d7f6b652e0c29ee353e63fffec6688ac',
                  'asm': 'OP_DUP OP_HASH160 ad7309dfc032d7f6b652e0c29ee353e63fffec66 OP_EQUALVERIFY OP_CHECKSIG',
                  'addresses': [
                    '1Gp7iCzDGMZiV55Kt8uKsux6VyoHe1aJaN'
                  ],
                  'type': 'pubkeyhash'
                },
                'spentHeight': null,
                'spentIndex': null,
                'spentTxId': null
              },
              {
                'value': '0.00000000',
                'n': 1,
                'scriptPubKey': {
                  'hex': '6a24aa21a9ed55882e9fed16c5d3b6d77e4160a56f58c70d354d02888a99486125b638231c81',
                  'asm': 'OP_RETURN aa21a9ed55882e9fed16c5d3b6d77e4160a56f58c70d354d02888a99486125b638231c81'
                },
                'spentHeight': null,
                'spentIndex': null,
                'spentTxId': null
              }
            ],
            'blockhash': '000000000000000000926a0cd4a05ef116514cbf1852edc306d13eb951ec0b54',
            'blockheight': 481411,
            'confirmations': 52813,
            'time': 1503242912,
            'blocktime': 1503242912,
            'isCoinBase': true,
            'valueOut': 12.85927535,
            'size': 181
          }
        ]
      };

      var req = {
        query: {
          address: 'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er'
        }
      };

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };

      var transactions = new TxController(node);
      transactions.list(req, res);
    });
  });

  describe('/rawtx/:txid', function() {

    it('should give the correct data', function(done) {
      var hex = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff2303d6250800feb0aae355fe263600000963676d696e6572343208ae5800000000000000ffffffff01c018824a000000001976a91468bedce8982d25c3b6b03f6238cbad00378b8ead88ac00000000';

      var node = {
        services: {
          block: {
            getTip: sinon.stub().returns({ height: 534233 })
          },
          transaction: {
            getTransaction: sinon.stub().callsArgWith(1, null, bcoin.tx.fromRaw(new Buffer(hex, 'hex')))
          }
        }
      };

      var transactions = new TxController(node);

      var txid = '25a988e54b02e0e5df146a0f8fa7b9db56210533a9f04bdfda5f4ceb6f77aadd';
      var res = {};
      var req = {
        params: {
          txid: txid
        }
      };
      var next = function() {
        should(req.rawTransaction.rawtx).eql(hex);
        done();
      };
      transactions.rawTransaction(req, res, next);
    });
  });

  describe('#transformInvTransaction', function() {

    it('should give the correct data', function() {
      var insight = {
        'txid': 'a15a7c257af596704390d345ff3ea2eed4cd02ce8bfb8afb700bff82257e49fb',
        'valueOut': 0.02038504,
        'vout': [
          {
            '3DQYCLG6rZdtV2Xw8y4YtozZjNHYoKsLuo': 45000
          },
          {
            '12WvZmssxT85f81dD6wcmWznxbnFkEpNMS': 1993504
          }
        ],
        'isRBF': false
      };

      var rawTx = '01000000011760bc271a397bfb65b7506d430d96ebb1faff467ed957516238a9670e806a86010000006b483045022100f0056ae68a34cdb4194d424bd727c18f82653bca2a198e0d55ab6b4ee88bbdb902202a5745af4f72a5dbdca1e3d683af4667728a8b20e8001e0f8308a4d329ce3f96012102f3af6e66b61c9d99c74d9a9c3c1bec014a8c05d28bf339c8f5f395b5ce319e7dffffffff02c8af00000000000017a9148083b541ea15f1d18c5ca5e1fd47f9035cce24ed87206b1e00000000001976a91410a0e70cd91a45e0e6e409e227ab285bd61592b188ac00000000';
      var tx = bcoin.tx.fromRaw(rawTx, 'hex');

      var node = {
        services: { block: { getTip: sinon.stub().returns({ height: 534233 }) } },
        network: 'livenet'
      };

      var transactions = new TxController(node);

      var result = transactions.transformInvTransaction(tx);
      should(result).eql(insight);
    });

    it('will not include null values in vout array', function() {
      var insight = {
        'txid': '716d54157c31e52c820494c6c2b8af1b64352049f4dcc80632aa15742a7f82c4',
        'valueOut': 12.5002,
        'vout': [
          {
            'n4eY3qiP9pi32MWC6FcJFHciSsfNiYFYgR': 12.5002 * 1e8
          }
        ],
        'isRBF': false
      };

      var rawTx = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0403ebc108ffffffff04a0ca814a000000001976a914fdb9fb622b0db8d9121475a983288a0876f4de4888ac0000000000000000226a200000000000000000000000000000000000000000000000000000ffff0000000000000000000000001b6a1976a914fdb9fb622b0db8d9121475a983288a0876f4de4888ac0000000000000000326a303a791c8e85200500d89769b4f958e4db6b3ec388ddaa30233c4517d942d440c24ae903bff40d97ca06465fcf2714000000000000';
      var tx = bcoin.tx.fromRaw(rawTx, 'hex');

      var node = {
        services: { block: { getTip: sinon.stub().returns({ height: 534233 }) } },
        network: 'testnet'
      };

      var transactions = new TxController(node);

      var result = transactions.transformInvTransaction(tx);
      should(result).eql(insight);
    });

    it('should detect RBF txs', function() {
      var testCases = [
        {
          rawTx: '01000000017fa897c3556271c34cb28c03c196c2d912093264c9d293cb4980a2635474467d010000000f5355540b6f93598893578893588851ffffffff01501e0000000000001976a914aa2482ce71d219018ef334f6cc551ee88abd920888ac00000000',
          expected: false,
        }, {
          rawTx: '01000000017fa897c3556271c34cb28c03c196c2d912093264c9d293cb4980a2635474467d010000000f5355540b6f935988935788935888510000000001501e0000000000001976a914aa2482ce71d219018ef334f6cc551ee88abd920888ac00000000',
          expected: true,
        },
      ];

      var node = {
        services: { block: { getTip: sinon.stub().returns({ height: 534233 }) } },
        network: 'livenet'
      };

      var transactions = new TxController(node);

      _.each(testCases, function(tc) {
        var tx = bcoin.tx.fromRaw(tc.rawTx, 'hex');
        var result = transactions.transformInvTransaction(tx);
        should.exist(result.isRBF);
        result.isRBF.should.equal(tc.expected);
      });
    });

  });
});
