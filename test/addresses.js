'use strict';
var sinon = require('sinon');
var should = require('should');
var AddressController = require('../lib/addresses');
var _ = require('lodash');
var bitcore = require('bitcore-lib');

var txinfos = {
  totalCount: 2,
  items: [
    {
      "address": "mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er",
      "satoshis": 2782729129,
      "height": 534105,
      "confirmations": 123,
      "timestamp": 1441068774,
      "fees": 35436,
      "outputIndexes": [
        0
      ],
      "inputIndexes": [],
      "tx": {
        "hash": "bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7",
        "version": 1,
        "inputs": [
          {
            "prevTxId": "ea5e5bafbf29cdf6f6097ab344128477e67889d4d6203cb43594836daa6cc425",
            "outputIndex": 1,
            "sequenceNumber": 4294967294,
            "script": "483045022100f4d169783bef70e3943d2a617cce55d9fe4e33fc6f9880b8277265e2f619a97002201238648abcdf52960500664e969046d41755f7fc371971ebc78002fc418465a6012103acdcd31d51272403ce0829447e59e2ac9e08ed0bf92011cbf7420addf24534e6",
            "scriptString": "72 0x3045022100f4d169783bef70e3943d2a617cce55d9fe4e33fc6f9880b8277265e2f619a97002201238648abcdf52960500664e969046d41755f7fc371971ebc78002fc418465a601 33 0x03acdcd31d51272403ce0829447e59e2ac9e08ed0bf92011cbf7420addf24534e6",
            "output": {
              "satoshis": 2796764565,
              "script": "76a91488b1fe8aec5ae4358a11447a2f22b2781faedb9b88ac"
            }
          }
        ],
        "outputs": [
          {
            "satoshis": 2782729129,
            "script": "76a9143583efb5e64a4668c6c54bb5fcc30af4417b4f2d88ac"
          },
          {
            "satoshis": 14000000,
            "script": "76a9149713201957f42379e574d7c70d506ee49c2c8ad688ac"
          }
        ],
        "nLockTime": 534089
      }
    },
    {
      "address": "mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er",
      "satoshis": -2782729129,
      "height": 534110,
      "confirmations": 118,
      "timestamp": 1441072817,
      "fees": 35437,
      "outputIndexes": [],
      "inputIndexes": [
        "0"
      ],
      "tx": {
        "hash": "01f700df84c466f2a389440e5eeacdc47d04f380c39e5d19dce2ce91a11ecba3",
        "version": 1,
        "inputs": [
          {
            "prevTxId": "bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7",
            "outputIndex": 0,
            "sequenceNumber": 4294967294,
            "script": "47304402201ee69281db6b95bb1aa3074059b67581635b719e8f64e4c2694db6ec56ad9447022011e91528996ea459b1fb2c0b59363fecbefe4bc2ca90f7b2382bdaa358f2d5640121034cc057b12a68ee79df998004b9a1341bbb18b17ea4939bebaa3bac001e940f24",
            "scriptString": "71 0x304402201ee69281db6b95bb1aa3074059b67581635b719e8f64e4c2694db6ec56ad9447022011e91528996ea459b1fb2c0b59363fecbefe4bc2ca90f7b2382bdaa358f2d56401 33 0x034cc057b12a68ee79df998004b9a1341bbb18b17ea4939bebaa3bac001e940f24",
            "output": {
              "satoshis": 2782729129,
              "script": "76a9143583efb5e64a4668c6c54bb5fcc30af4417b4f2d88ac"
            }
          }
        ],
        "outputs": [
          {
            "satoshis": 2764693692,
            "script": "76a91456e446bc3489543d8324c6d0271524c0bd0506dd88ac"
          },
          {
            "satoshis": 18000000,
            "script": "76a914011d2963b619186a318f768dddfd98cd553912a088ac"
          }
        ],
        "nLockTime": 534099
      }
    }
  ]
};

var tx = bitcore.Transaction().fromObject({
  "hash": "63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73",
  "version": 1,
  "inputs": [
    {
      "prevTxId": "ea97726ffc529808094ae5568342267931a058375a20147535a0d095837079f3",
      "outputIndex": 1,
      "sequenceNumber": 4294967295,
      "script": "473044022054233934268b30be779fad874ef42e8db928ba27a1b612d5f111b3ee95eb271c022024272bbaf2dcc4050bd3b9dfa3c93884f6ba6ad7d257598b8245abb65b5ab1e40141040682fdb281a8533e21e13dfd1fcfa424912a85b6cdc4136b5842c85de05ac1f0e4a013f20702adeb53329de13b2ef388e5ed6244676f4f1ee4ee685ab607964d",
      "scriptString": "71 0x3044022054233934268b30be779fad874ef42e8db928ba27a1b612d5f111b3ee95eb271c022024272bbaf2dcc4050bd3b9dfa3c93884f6ba6ad7d257598b8245abb65b5ab1e401 65 0x040682fdb281a8533e21e13dfd1fcfa424912a85b6cdc4136b5842c85de05ac1f0e4a013f20702adeb53329de13b2ef388e5ed6244676f4f1ee4ee685ab607964d",
      "output": {
        "satoshis": 53540000,
        "script": "76a91454dcfbff9e109bf369e457f6b0f869f4e647076488ac"
      }
    },
    {
      "prevTxId": "980a9cc2dbc2d3464eb9900ae6d579a03045408563320f62d99316c3d4ff58b7",
      "outputIndex": 2,
      "sequenceNumber": 4294967295,
      "script": "473044022044938ac3f8fcb8da29011df6397ed28cc7e894cdc35d596d4f3623bd8c7e465f022014829c6e0bd7ee97a1bcfef6b85c5fd232653f289394fc6ce6ebb41c73403f1b014104d9ccf88efc6e5be3151fae5e848efd94c91d75e7bf621f9f724a8caff51415338525d3239fae6b93826edf759dd562f77693e55dfa852ffd96a92d683db590f2",
      "scriptString": "71 0x3044022044938ac3f8fcb8da29011df6397ed28cc7e894cdc35d596d4f3623bd8c7e465f022014829c6e0bd7ee97a1bcfef6b85c5fd232653f289394fc6ce6ebb41c73403f1b01 65 0x04d9ccf88efc6e5be3151fae5e848efd94c91d75e7bf621f9f724a8caff51415338525d3239fae6b93826edf759dd562f77693e55dfa852ffd96a92d683db590f2",
      "output": {
        "satoshis": 299829,
        "script": "76a914db731c9ebf3874d75ee26b9c19b692d278c283f788ac"
      }
    }
  ],
  "outputs": [
    {
      "satoshis": 220000,
      "script": "76a914b9bbd76588d9e4e09f0369a9aa0b2749a11c4e8d88ac"
    },
    {
      "satoshis": 53320000,
      "script": "76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac"
    },
    {
      "satoshis": 289829,
      "script": "76a914583df9fa56ad961051e00ca93e68dfaf1eab9ec588ac"
    }
  ],
  "nLockTime": 0
});

tx.__height = 534181;
tx.__timestamp = 1441116143;
tx.__blockHash = '0000000000000041ddc94ecf4f86a456a83b2e320c36c6f0c13ff92c7e75f013';
var txinfos2 = {
  totalCount: 1,
  items: [
    {
      tx: tx
    }
  ]
};

var utxos = [
  {
    "address": "mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK",
    "txid": "63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73",
    "outputIndex": 1,
    "timestamp": 1441116143,
    "satoshis": 53320000,
    "script": "76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac",
    "blockHeight": 534181,
    "confirmations": 50
  },
  {
    "address": "moZY18rGNmh4YCPeugtGW46AkkWMQttBUD",
    "txid": "63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73",
    "outputIndex": 2,
    "timestamp": 1441116143,
    "satoshis": 289829,
    "script": "76a914583df9fa56ad961051e00ca93e68dfaf1eab9ec588ac",
    "blockHeight": 534181,
    "confirmations": 50
  }
];

describe('Addresses', function() {
  var summary = {
    balance: 0,
    totalReceived: 2782729129,
    totalSpent: 2782729129,
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
      getAddressSummary: sinon.stub().callsArgWith(2, null, summary)
    };

    var addresses = new AddressController(node);
    var req = {
      addr: 'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er',
      query: {}
    };

    it('should have correct data', function(done) {
      var insight = {
          "addrStr": "mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er",
          "balance": 0,
          "balanceSat": 0,
          "totalReceived": 27.82729129,
          "totalReceivedSat": 2782729129,
          "totalSent": 27.82729129,
          "totalSentSat": 2782729129,
          "unconfirmedBalance": 0,
          "unconfirmedBalanceSat": 0,
          "unconfirmedTxApperances": 0,
          "txApperances": 2,
          "transactions": [
              "bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7",
              "01f700df84c466f2a389440e5eeacdc47d04f380c39e5d19dce2ce91a11ecba3"
          ]
      };

      var res = {
        jsonp: function(data) {
          should(data).eql(insight);
          done();
        }
      };
      addresses.show(req, res);
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
              "address": "mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK",
              "txid": "63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73",
              "vout": 1,
              "ts": 1441116143,
              "scriptPubKey": "76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac",
              "amount": 0.5332,
              "confirmations": 50,
              "confirmationsFromCache": true
          }
      ];

      var todos = [
        {
          confirmationsFromCache: true
        }
      ];

      var node = {
        getUnspentOutputs: sinon.stub().callsArgWith(2, null, utxos.slice(0, 1))
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
              "address": "mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK",
              "txid": "63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73",
              "vout": 1,
              "ts": 1441116143,
              "scriptPubKey": "76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac",
              "amount": 0.5332,
              "confirmations": 50,
              "confirmationsFromCache": true
          },
          {
              "address": "moZY18rGNmh4YCPeugtGW46AkkWMQttBUD",
              "txid": "63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73",
              "vout": 2,
              "ts": 1441116143,
              "scriptPubKey": "76a914583df9fa56ad961051e00ca93e68dfaf1eab9ec588ac",
              "amount": 0.00289829,
              "confirmations": 50,
              "confirmationsFromCache": true
          }
      ];

      var todos = [
        {
          confirmationsFromCache: true
        }, {
          confirmationsFromCache: true
        }
      ];

      var node = {
        getUnspentOutputs: sinon.stub().callsArgWith(2, null, utxos)
      };

      var addresses = new AddressController(node);

      var req = {
        addrs: 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK,moZY18rGNmh4YCPeugtGW46AkkWMQttBUD'
      };

      var res = {
        jsonp: function(data) {
          var merged = _.merge(data, todos);
          should(merged).eql(insight);
          done();
        }
      };

      addresses.multiutxo(req, res);
    });
  });

  describe('/addrs/:addrs/txs', function() {
    it('should have correct data', function(done) {
      var insight = {
          "totalItems": 1,
          "from": 0,
          "to": 1,
          "items": [
              {
                  "txid": "63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73",
                  "version": 1,
                  "locktime": 0,
                  "vin": [
                      {
                          "txid": "ea97726ffc529808094ae5568342267931a058375a20147535a0d095837079f3",
                          "vout": 1,
                          "scriptSig": {
                              "asm": "3044022054233934268b30be779fad874ef42e8db928ba27a1b612d5f111b3ee95eb271c022024272bbaf2dcc4050bd3b9dfa3c93884f6ba6ad7d257598b8245abb65b5ab1e401 040682fdb281a8533e21e13dfd1fcfa424912a85b6cdc4136b5842c85de05ac1f0e4a013f20702adeb53329de13b2ef388e5ed6244676f4f1ee4ee685ab607964d",
                              "hex": "473044022054233934268b30be779fad874ef42e8db928ba27a1b612d5f111b3ee95eb271c022024272bbaf2dcc4050bd3b9dfa3c93884f6ba6ad7d257598b8245abb65b5ab1e40141040682fdb281a8533e21e13dfd1fcfa424912a85b6cdc4136b5842c85de05ac1f0e4a013f20702adeb53329de13b2ef388e5ed6244676f4f1ee4ee685ab607964d"
                          },
                          "sequence": 4294967295,
                          "n": 0,
                          "addr": "moFfnRwt77pApKnnU6m5uocFaa43aAYpt5",
                          "valueSat": 53540000,
                          "value": 0.5354,
                          "doubleSpentTxID": null
                      },
                      {
                          "txid": "980a9cc2dbc2d3464eb9900ae6d579a03045408563320f62d99316c3d4ff58b7",
                          "vout": 2,
                          "scriptSig": {
                              "asm": "3044022044938ac3f8fcb8da29011df6397ed28cc7e894cdc35d596d4f3623bd8c7e465f022014829c6e0bd7ee97a1bcfef6b85c5fd232653f289394fc6ce6ebb41c73403f1b01 04d9ccf88efc6e5be3151fae5e848efd94c91d75e7bf621f9f724a8caff51415338525d3239fae6b93826edf759dd562f77693e55dfa852ffd96a92d683db590f2",
                              "hex": "473044022044938ac3f8fcb8da29011df6397ed28cc7e894cdc35d596d4f3623bd8c7e465f022014829c6e0bd7ee97a1bcfef6b85c5fd232653f289394fc6ce6ebb41c73403f1b014104d9ccf88efc6e5be3151fae5e848efd94c91d75e7bf621f9f724a8caff51415338525d3239fae6b93826edf759dd562f77693e55dfa852ffd96a92d683db590f2"
                          },
                          "sequence": 4294967295,
                          "n": 1,
                          "addr": "n1XJBAyU4hNR4xRtY3UxnmAteoJX83p5qv",
                          "valueSat": 299829,
                          "value": 0.00299829,
                          "doubleSpentTxID": null
                      }
                  ],
                  "vout": [
                      {
                          "value": "0.00220000",
                          "n": 0,
                          "scriptPubKey": {
                              "asm": "OP_DUP OP_HASH160 b9bbd76588d9e4e09f0369a9aa0b2749a11c4e8d OP_EQUALVERIFY OP_CHECKSIG",
                              "hex": "76a914b9bbd76588d9e4e09f0369a9aa0b2749a11c4e8d88ac",
                              "reqSigs": 1,
                              "type": "pubkeyhash",
                              "addresses": [
                                  "mxT2KzTUQvsaYYothDtjcdvyAdaHA9ofMp"
                              ]
                          }
                      },
                      {
                          "value": "0.53320000",
                          "n": 1,
                          "scriptPubKey": {
                              "asm": "OP_DUP OP_HASH160 d2ec20bb8e5f25a52f730384b803d95683250e0b OP_EQUALVERIFY OP_CHECKSIG",
                              "hex": "76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac",
                              "reqSigs": 1,
                              "type": "pubkeyhash",
                              "addresses": [
                                  "mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK"
                              ]
                          }
                      },
                      {
                          "value": "0.00289829",
                          "n": 2,
                          "scriptPubKey": {
                              "asm": "OP_DUP OP_HASH160 583df9fa56ad961051e00ca93e68dfaf1eab9ec5 OP_EQUALVERIFY OP_CHECKSIG",
                              "hex": "76a914583df9fa56ad961051e00ca93e68dfaf1eab9ec588ac",
                              "reqSigs": 1,
                              "type": "pubkeyhash",
                              "addresses": [
                                  "moZY18rGNmh4YCPeugtGW46AkkWMQttBUD"
                              ]
                          }
                      }
                  ],
                  "blockhash": "0000000000000041ddc94ecf4f86a456a83b2e320c36c6f0c13ff92c7e75f013",
                  "blockheight": 534181,
                  "confirmations": 52,
                  "time": 1441116143,
                  "blocktime": 1441116143,
                  "valueOut": 0.53829829,
                  "size": 470,
                  "valueIn": 0.53839829,
                  "fees": 0.0001,
                  "firstSeenTs": 1441108193
              }
          ]
      };

      var todos = {
        "items": [
          {
            "vin": [
              {
                "scriptSig": {
                  "asm": "3044022054233934268b30be779fad874ef42e8db928ba27a1b612d5f111b3ee95eb271c022024272bbaf2dcc4050bd3b9dfa3c93884f6ba6ad7d257598b8245abb65b5ab1e401 040682fdb281a8533e21e13dfd1fcfa424912a85b6cdc4136b5842c85de05ac1f0e4a013f20702adeb53329de13b2ef388e5ed6244676f4f1ee4ee685ab607964d"
                }
              },
              {
                "scriptSig": {
                  "asm": "3044022044938ac3f8fcb8da29011df6397ed28cc7e894cdc35d596d4f3623bd8c7e465f022014829c6e0bd7ee97a1bcfef6b85c5fd232653f289394fc6ce6ebb41c73403f1b01 04d9ccf88efc6e5be3151fae5e848efd94c91d75e7bf621f9f724a8caff51415338525d3239fae6b93826edf759dd562f77693e55dfa852ffd96a92d683db590f2"
                }
              }
            ],
            "vout": [
              {
                "scriptPubKey": {
                  "asm": "OP_DUP OP_HASH160 b9bbd76588d9e4e09f0369a9aa0b2749a11c4e8d OP_EQUALVERIFY OP_CHECKSIG",
                  "reqSigs": 1,
                  "type": "pubkeyhash",
                  "addresses": []
                }
              },
              {
                "scriptPubKey": {
                  "asm": "OP_DUP OP_HASH160 d2ec20bb8e5f25a52f730384b803d95683250e0b OP_EQUALVERIFY OP_CHECKSIG",
                  "reqSigs": 1,
                  "type": "pubkeyhash",
                  "addresses": []
                }
              },
              {
                "scriptPubKey": {
                  "asm": "OP_DUP OP_HASH160 583df9fa56ad961051e00ca93e68dfaf1eab9ec5 OP_EQUALVERIFY OP_CHECKSIG",
                  "reqSigs": 1,
                  "type": "pubkeyhash",
                  "addresses": []
                }
              }
            ],
            "firstSeenTs": 1441108193
          }
        ]
      };

      var node = {
        getAddressHistory: sinon.stub().callsArgWith(2, null, txinfos2),
        services: {
          db: {
            tip: {
              __height: 534232
            }
          },
          address: {
            getInputForOutput: sinon.stub().callsArgWith(3, null, false),
          }
        },
        network: 'testnet'
      };

      var addresses = new AddressController(node);

      var req = {
        addrs: 'mzkD4nmQ8ixqxySdBgsXTpgvAMK5iRZpNK,moZY18rGNmh4YCPeugtGW46AkkWMQttBUD',
        query: {},
        body: {}
      };

      var res = {
        jsonp: function(data) {
          var merged = _.merge(data, todos);
          should(merged).eql(insight);
          done();
        }
      };

      addresses.multitxs(req, res);
    });
  });
});
