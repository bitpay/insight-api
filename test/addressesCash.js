'use strict';

var should = require('should');
var sinon = require('sinon');
var AddressController = require('../lib/addresses');
var _ = require('lodash');
var bitcore = require('bitcore-lib');
var bcoin = require('bcoin');



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
    'address': '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
    'txid': '63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73',
    'vout': 1,
    'timestamp': 1441116143,
    'satoshis': 53320000,
    'scriptPubKey': '76a914d2ec20bb8e5f25a52f730384b803d95683250e0b88ac',
    'height': 534181,
    'confirmations': 50
  },
  {
    'address': '3EDL9HSincwLGfYbWPQ7LXtc4VqdwGoraS',
    'txid': '63b68becb0e514b32317f4b29a5cf0627d4087e54ac17f686fcb1d9a27680f73',
    'vout': 2,
    'timestamp': 1441116143,
    'satoshis': 289829,
    'scriptPubKey': '76a914583df9fa56ad961051e00ca93e68dfaf1eab9ec588ac',
    'height': 534181,
    'confirmations': 50
  }
];

describe('Addresses / Bitcoin Cash', function() {
  var summary = {
    addrStr: 'CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz',
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

    var addresses = new AddressController(node, true);
    var req = {
      addr: '',
      query: {}
    };
    it('checkAddrs', function(done) {
      var insight = 0;

      var req = {
        query: {
          noTxList: 1
        },
        params: {
          addr: 'CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz'
        },
      };
 
      var send = sinon.stub();
      var status = sinon.stub().returns({send: send});

      var res = {
        status: status
      };

      addresses.checkAddrs(req, res, function(req2) { 
        req.addr.should.equal('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
        req.addrs[0].should.equal('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
        done();
      });
    });
  });


  describe('/addr/:addr/utxo', function() {
    it('should have correct data', function(done) {
      var insight = [
        {
          'address': 'CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz',
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

      var addresses = new AddressController(node, true);

      var req = {
        addr: 'CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz'
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
          'address': 'CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz',
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
          'address': 'HK3Sc5sodw9ztqRdN54GJvR969rejftcS9',
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

      var addresses = new AddressController(node, true);

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
                    'CYognBa8KGDnHMcyM7siKgxRkCkUqLb4YM'
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

      var addresses = new AddressController(node, true);

      var req = {
        addrs: 'CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz,HK3Sc5sodw9ztqRdN54GJvR969rejftcS9',
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
  });
});
