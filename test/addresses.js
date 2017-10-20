'use strict';

var should = require('should');
var sinon = require('sinon');
var AddressController = require('../lib/addresses');
var _ = require('lodash');
var bitcore = require('bitcore-lib');
var bcoin = require('bcoin');

var txinfos = {
  totalCount: 2,
  items: [
    {
      'address': 'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er',
      'satoshis': 2782729129,
      'height': 534105,
      'confirmations': 123,
      'timestamp': 1441068774,
      'fees': 35436,
      'outputIndexes': [
        0
      ],
      'inputIndexes': [],
      'tx': {
        'hash': 'bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7',
        'version': 1,
        'inputs': [
          {
            'prevTxId': 'ea5e5bafbf29cdf6f6097ab344128477e67889d4d6203cb43594836daa6cc425',
            'outputIndex': 1,
            'sequenceNumber': 4294967294,
            'script': '483045022100f4d169783bef70e3943d2a617cce55d9fe4e33fc6f9880b8277265e2f619a97002201238648abcdf52960500664e969046d41755f7fc371971ebc78002fc418465a6012103acdcd31d51272403ce0829447e59e2ac9e08ed0bf92011cbf7420addf24534e6',
            'scriptString': '72 0x3045022100f4d169783bef70e3943d2a617cce55d9fe4e33fc6f9880b8277265e2f619a97002201238648abcdf52960500664e969046d41755f7fc371971ebc78002fc418465a601 33 0x03acdcd31d51272403ce0829447e59e2ac9e08ed0bf92011cbf7420addf24534e6',
            'output': {
              'satoshis': 2796764565,
              'script': '76a91488b1fe8aec5ae4358a11447a2f22b2781faedb9b88ac'
            }
          }
        ],
        'outputs': [
          {
            'satoshis': 2782729129,
            'script': '76a9143583efb5e64a4668c6c54bb5fcc30af4417b4f2d88ac'
          },
          {
            'satoshis': 14000000,
            'script': '76a9149713201957f42379e574d7c70d506ee49c2c8ad688ac'
          }
        ],
        'nLockTime': 534089
      }
    },
    {
      'address': 'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er',
      'satoshis': -2782729129,
      'height': 534110,
      'confirmations': 118,
      'timestamp': 1441072817,
      'fees': 35437,
      'outputIndexes': [],
      'inputIndexes': [
        '0'
      ],
      'tx': {
        'hash': '01f700df84c466f2a389440e5eeacdc47d04f380c39e5d19dce2ce91a11ecba3',
        'version': 1,
        'inputs': [
          {
            'prevTxId': 'bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7',
            'outputIndex': 0,
            'sequenceNumber': 4294967294,
            'script': '47304402201ee69281db6b95bb1aa3074059b67581635b719e8f64e4c2694db6ec56ad9447022011e91528996ea459b1fb2c0b59363fecbefe4bc2ca90f7b2382bdaa358f2d5640121034cc057b12a68ee79df998004b9a1341bbb18b17ea4939bebaa3bac001e940f24',
            'scriptString': '71 0x304402201ee69281db6b95bb1aa3074059b67581635b719e8f64e4c2694db6ec56ad9447022011e91528996ea459b1fb2c0b59363fecbefe4bc2ca90f7b2382bdaa358f2d56401 33 0x034cc057b12a68ee79df998004b9a1341bbb18b17ea4939bebaa3bac001e940f24',
            'output': {
              'satoshis': 2782729129,
              'script': '76a9143583efb5e64a4668c6c54bb5fcc30af4417b4f2d88ac'
            }
          }
        ],
        'outputs': [
          {
            'satoshis': 2764693692,
            'script': '76a91456e446bc3489543d8324c6d0271524c0bd0506dd88ac'
          },
          {
            'satoshis': 18000000,
            'script': '76a914011d2963b619186a318f768dddfd98cd553912a088ac'
          }
        ],
        'nLockTime': 534099
      }
    }
  ]
};

var tx = {
  height: 534181,
  blockTimestamp: 1441116143,
  blockHash: '0000000000000041ddc94ecf4f86a456a83b2e320c36c6f0c13ff92c7e75f013',
  hex: '0100000002f379708395d0a0357514205a3758a0317926428356e54a09089852fc6f7297ea010000008a473044022054233934268b30be779fad874ef42e8db928ba27a1b612d5f111b3ee95eb271c022024272bbaf2dcc4050bd3b9dfa3c93884f6ba6ad7d257598b8245abb65b5ab1e40141040682fdb281a8533e21e13dfd1fcfa424912a85b6cdc4136b5842c85de05ac1f0e4a013f20702adeb53329de13b2ef388e5ed6244676f4f1ee4ee685ab607964dffffffffb758ffd4c31693d9620f326385404530a079d5e60a90b94e46d3c2dbc29c0a98020000008a473044022044938ac3f8fcb8da29011df6397ed28cc7e894cdc35d596d4f3623bd8c7e465f022014829c6e0bd7ee97a1bcfef6b85c5fd232653f289394fc6ce6ebb41c73403f1b014104d9ccf88efc6e5be3151fae5e848efd94c91d75e7bf621f9f724a8caff51415338525d3239fae6b93826edf759dd562f77693e55dfa852ffd96a92d683db590f2ffffffff03605b0300000000001976a914b9bbd76588d9e4e09f0369a9aa0b2749a11c4e8d88ac40992d03000000001976a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac256c0400000000001976a914583df9fa56ad961051e00ca93e68dfaf1eab9ec588ac00000000',
  hash: '63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73',
  version: 1,
  inputSatoshis: 53839829,
  outputSatoshis: 53829829,
  feeSatoshis: 10000,
  inputs: [
    {
      address: 'moFfnRwt77pApKnnU6m5uocFaa43aAYpt5',
      prevTxId: 'ea97726ffc529808094ae5568342267931a058375a20147535a0d095837079f3',
      outputIndex: 1,
      sequence: 4294967295,
      script: '473044022054233934268b30be779fad874ef42e8db928ba27a1b612d5f111b3ee95eb271c022024272bbaf2dcc4050bd3b9dfa3c93884f6ba6ad7d257598b8245abb65b5ab1e40141040682fdb281a8533e21e13dfd1fcfa424912a85b6cdc4136b5842c85de05ac1f0e4a013f20702adeb53329de13b2ef388e5ed6244676f4f1ee4ee685ab607964d',
      scriptAsm: '3044022054233934268b30be779fad874ef42e8db928ba27a1b612d5f111b3ee95eb271c022024272bbaf2dcc4050bd3b9dfa3c93884f6ba6ad7d257598b8245abb65b5ab1e401 040682fdb281a8533e21e13dfd1fcfa424912a85b6cdc4136b5842c85de05ac1f0e4a013f20702adeb53329de13b2ef388e5ed6244676f4f1ee4ee685ab607964d',
      satoshis: 53540000,
    },
    {
      address: 'n1XJBAyU4hNR4xRtY3UxnmAteoJX83p5qv',
      prevTxId: '980a9cc2dbc2d3464eb9900ae6d579a03045408563320f62d99316c3d4ff58b7',
      outputIndex: 2,
      sequence: 4294967295,
      script: '473044022044938ac3f8fcb8da29011df6397ed28cc7e894cdc35d596d4f3623bd8c7e465f022014829c6e0bd7ee97a1bcfef6b85c5fd232653f289394fc6ce6ebb41c73403f1b014104d9ccf88efc6e5be3151fae5e848efd94c91d75e7bf621f9f724a8caff51415338525d3239fae6b93826edf759dd562f77693e55dfa852ffd96a92d683db590f2',
      scriptAsm: '3044022044938ac3f8fcb8da29011df6397ed28cc7e894cdc35d596d4f3623bd8c7e465f022014829c6e0bd7ee97a1bcfef6b85c5fd232653f289394fc6ce6ebb41c73403f1b01 04d9ccf88efc6e5be3151fae5e848efd94c91d75e7bf621f9f724a8caff51415338525d3239fae6b93826edf759dd562f77693e55dfa852ffd96a92d683db590f2',
      satoshis: 299829,
    }
  ],
  outputs: [
    {
      satoshis: 220000,
      script: '76a914b9bbd76588d9e4e09f0369a9aa0b2749a11c4e8d88ac',
      scriptAsm: 'OP_DUP OP_HASH160 b9bbd76588d9e4e09f0369a9aa0b2749a11c4e8d OP_EQUALVERIFY OP_CHECKSIG',
      address: 'mxT2KzTUQvsaYYothDtjcdvyAdaHA9ofMp'
    },
    {
      satoshis: 53320000,
      address: 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK',
      script: '76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac',
      scriptAsm: 'OP_DUP OP_HASH160 d2ec20bb8e5f25a52f730384b803d95683250e0b OP_EQUALVERIFY OP_CHECKSIG'
    },
    {
      address: 'moZY18rGNmh4YCPeugtGW46AkkWMQttBUD',
      satoshis: 289829,
      script: '76a914583df9fa56ad961051e00ca93e68dfaf1eab9ec588ac',
      scriptAsm: 'OP_DUP OP_HASH160 583df9fa56ad961051e00ca93e68dfaf1eab9ec5 OP_EQUALVERIFY OP_CHECKSIG'
    }
  ],
  locktime: 0
};

var rawHex = "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0704ffff001d010bffffffff0100f2052a010000004341047211a824f55b505228e4c3d5194c1fcfaa15a456abdf37f9b9d97a4040afc073dee6c89064984f03385237d92167c13e236446b417ab79a0fcae412ae3316b77ac00000000";

var bcoinTx = bcoin.tx.fromRaw(rawHex, 'hex');
bcoinTx.__blockhash = '0000000000000041ddc94ecf4f86a456a83b2e320c36c6f0c13ff92c7e75f013';
bcoinTx.blockhash = '0000000000000041ddc94ecf4f86a456a83b2e320c36c6f0c13ff92c7e75f013';
bcoinTx.__height = 534181;
bcoinTx.__timestamp = 1441116143;
bcoinTx.outputSatoshis = 53829829;

var txinfos2 = {
  totalCount: 1,
  items: [ bcoinTx ]
};

var utxos = [
  {
    'address': 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK',
    'txid': '63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73',
    'vout': 1,
    'timestamp': 1441116143,
    'satoshis': 53320000,
    'scriptPubKey': '76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac',
    'height': 534181,
    'confirmations': 50
  },
  {
    'address': 'moZY18rGNmh4YCPeugtGW46AkkWMQttBUD',
    'txid': '63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73',
    'vout': 2,
    'timestamp': 1441116143,
    'satoshis': 289829,
    'scriptPubKey': '76a914583df9fa56ad961051e00ca93e68dfaf1eab9ec588ac',
    'height': 534181,
    'confirmations': 50
  }
];

describe('Addresses', function() {
  var summary = {
    balance: 0,
    totalReceivedSat: 2782729129,
    totalSentSat: 2782729129,
    unconfirmedBalance: 0,
    appearances: 2,
    unconfirmedAppearances: 0,
    txids: [
      'bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7',
      '01f700df84c466f2a389440e5eeacdc47d04f380c39e5d19dce2ce91a11ecba3'
    ]
  };
  describe('/addr/:addr', function() {
    var node = {

      services: {
        address: {
          getAddressSummary: sinon.stub().callsArgWith(2, null, summary)
        }
      }

    };

    var addresses = new AddressController(node);
    var req = {
      addr: 'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er',
      query: {}
    };

    it('handle error', function() {
      var testnode = {
        services: {
          address: {
            getAddressSummary: sinon.stub().callsArgWith(2, new Error('test'))
          }
        }
      };
      testnode.log = {};
      testnode.log.error = sinon.stub();
      var controller = new AddressController(testnode);
      var req = {
        query: {
          noTxList: 1
        },
        addr: 'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er'
      };
      var send = sinon.stub();
      var status = sinon.stub().returns({send: send});
      var res = {
        status: status
      };
      controller.show(req, res);
      send.callCount.should.equal(1);
      status.callCount.should.equal(1);
      status.args[0][0].should.equal(503);
      send.args[0][0].should.equal('test');
    });

    it('/balance', function(done) {
      var insight = 0;

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };
      addresses.balance(req, res);
    });

    it('/totalReceived', function(done) {
      var insight = 2782729129;

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };

      addresses.totalReceived(req, res);
    });

    it('/totalSent', function(done) {
      var insight = 2782729129;

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };

      addresses.totalSent(req, res);
    });

    it('/unconfirmedBalance', function(done) {
      var insight = 0;

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };

      addresses.unconfirmedBalance(req, res);
    });
  });

  describe('/addr/:addr/utxo', function() {
    it('should have correct data', function(done) {
      var insight = [
        {
          'address': 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK',
          'txid': '63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73',
          'vout': 1,
          'ts': 1441116143,
          'scriptPubKey': '76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac',
          'amount': 0.5332,
          'confirmations': 50,
          'height': 534181,
          'satoshis': 53320000,
          'confirmationsFromCache': true
        }
      ];

      var todos = [
        {
          confirmationsFromCache: true
        }
      ];

      var node = {
        services: {
          block: {
            getTip: sinon.stub().returns({ height: 534230 })
          },
          address: {
            getAddressUnspentOutputs: sinon.stub().callsArgWith(2, null, utxos.slice(0, 1))
          }
        },

      };

      var addresses = new AddressController(node);

      var req = {
        addr: 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK'
      };

      var res = {
        jsonp: function(data) {
          var merged = _.merge(data, todos);
          should(merged).eql(insight);
          done();
        }
      };

      addresses.utxo(req, res);
    });
  });

  describe('/addrs/:addrs/utxo', function() {

    it('should have the correct data', function(done) {

      var insight = [
        {
          'address': 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK',
          'txid': '63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73',
          'vout': 1,
          'ts': 1441116143,
          'scriptPubKey': '76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac',
          'amount': 0.5332,
          'height': 534181,
          'satoshis': 53320000,
          'confirmations': 50
        },
        {
          'address': 'moZY18rGNmh4YCPeugtGW46AkkWMQttBUD',
          'txid': '63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73',
          'vout': 2,
          'ts': 1441116143,
          'scriptPubKey': '76a914583df9fa56ad961051e00ca93e68dfaf1eab9ec588ac',
          'amount': 0.00289829,
          'height': 534181,
          'satoshis': 289829,
          'confirmations': 50
        }
      ];

      var utxoStub = sinon.stub();
      utxoStub.onCall(0).callsArgWith(2, null, [utxos[0]]);
      utxoStub.onCall(1).callsArgWith(2, null, [utxos[1]]);

      var node = {
        services: {
          address: {
            getAddressUnspentOutputs: utxoStub
          },
          block: {
            getTip: sinon.stub().returns({ height: 534230 })
          }
        },

      };

      var addresses = new AddressController(node);

      var req = {
        addrs: 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK,moZY18rGNmh4YCPeugtGW46AkkWMQttBUD'
      };

      var finalData = '';

      var res = {
        write: function(data) {
          finalData += data;
        },
        end: function() {
          var finalObject = JSON.parse(finalData);
          finalObject.should.eql(insight);
          done();
        }
      };

      addresses.multiutxo(req, res);
    });
  });

  describe('/addrs/:addrs/txs', function() {

    it('should have correct data', function(done) {

      var insight = {
        'totalItems': 1,
        'from': 0,
        'to': 1,
        'items': [
          {
            'txid': '9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5',
            'version': 1,
            'isCoinBase': true,
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
                  'asm': '047211a824f55b505228e4c3d5194c1fcfaa15a456abdf37f9b9d97a4040afc073dee6c89064984f03385237d92167c13e236446b417ab79a0fcae412ae3316b77 OP_CHECKSIG',
                  'hex': '41047211a824f55b505228e4c3d5194c1fcfaa15a456abdf37f9b9d97a4040afc073dee6c89064984f03385237d92167c13e236446b417ab79a0fcae412ae3316b77ac',
                  'type': 'pubkeyhash',
                  'addresses': [
                    '1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1'
                  ]
                },
                spentHeight: null,
                spentIndex: null,
                spentTxId: null
              }
            ],
            'blockhash': '0000000000000041ddc94ecf4f86a456a83b2e320c36c6f0c13ff92c7e75f013',
            'blockheight': 534181,
            'confirmations': 52,
            'time': 1441116143,
            'blocktime': 1441116143,
            'valueOut': 0.53829829,
            'size': 134
          }
        ]
      };

      var node = {
        services: {
          address: {
            getAddressHistory: sinon.stub().callsArgWith(2, null, txinfos2),
          },
          block: {
            getTip: sinon.stub().returns({ height: 534232 })
          }
        }
      };

      var addresses = new AddressController(node);

      var req = {
        addrs: 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK,moZY18rGNmh4YCPeugtGW46AkkWMQttBUD',
        query: {},
        body: {}
      };

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };

      addresses.multitxs(req, res);
    });

    it('should have trimmed data', function(done) {
      var insight = {
        'totalItems': 1,
        'from': 0,
        'to': 1,
        'items': [
          {
            'txid': '9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5',
            'version': 1,
            'locktime': 0,
            'isCoinBase': true,
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
                  'type': 'pubkeyhash',
                  'addresses': [
                    '1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1'
                  ]
                }
              }
            ],
            'blockhash': '0000000000000041ddc94ecf4f86a456a83b2e320c36c6f0c13ff92c7e75f013',
            'blockheight': 534181,
            'confirmations': 52,
            'time': 1441116143,
            'blocktime': 1441116143,
            'valueOut': 0.53829829,
            'size': 134
          }
        ]
      };

      var node = {
        services: {
          address: {
            getAddressHistory: sinon.stub().callsArgWith(2, null, txinfos2),
          },
          block: {
            getTip: sinon.stub().returns({ height: 534232 })
          }
        }
      };

      var addresses = new AddressController(node);

      var req = {
        addrs: 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK,moZY18rGNmh4YCPeugtGW46AkkWMQttBUD',
        query: {noSpent: '1', noScriptSig: '1', noAsm: '1'},
        body: {}
      };

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };

      addresses.multitxs(req, res);
    });
  });
  describe('#_getTransformOptions', function() {

    it('will return false with value of string "0"', function() {
      var node = { services: { address: {}, block: {} } };
      var addresses = new AddressController(node);
      var req = {
        query: {
          noAsm: '0',
          noScriptSig: '0',
          noSpent: '0'
        }
      };
      var options = addresses._getTransformOptions(req);
      options.should.eql({
        noAsm: false,
        noScriptSig: false,
        noSpent: false
      });
    });

    it('will return true with value of string "1"', function() {
      var node = { services: { address: {}, block: {} } };
      var addresses = new AddressController(node);
      var req = {
        query: {
          noAsm: '1',
          noScriptSig: '1',
          noSpent: '1'
        }
      };
      var options = addresses._getTransformOptions(req);
      options.should.eql({
        noAsm: true,
        noScriptSig: true,
        noSpent: true
      });
    });

    it('will return true with value of number "1"', function() {
      var node = { services: { address: {}, block: {} } };
      var addresses = new AddressController(node);
      var req = {
        query: {
          noAsm: 1,
          noScriptSig: 1,
          noSpent: 1
        }
      };
      var options = addresses._getTransformOptions(req);
      options.should.eql({
        noAsm: true,
        noScriptSig: true,
        noSpent: true
      });
    });
  });
});
