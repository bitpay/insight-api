'use strict';
var should = require('should');
var sinon = require('sinon');
var bitcore = require('bitcore-lib');
var TxController = require('../lib/transactions');
var _ = require('lodash');

describe('Transactions', function() {
  describe('/tx/:txid', function() {
    it('should have correct data', function(done) {
      var insight = {
        'txid': 'b85334bf2df35c6dd5b294efe92ffc793a78edff75a2ca666fc296ffb04bbba0',
        'version': 1,
        'locktime': 0,
        'vin': [
          {
            'txid': '87c9b0f27571fff14b8c2d69e55614eacedd0f59fcc490b721320f9dae145aad',
            'vout': 0,
            'scriptSig': {
              'asm': '30450221008e5df62719cd92d7b137d00bbd27f153f2909bcad3a300960bc1020ec6d5e961022039df51600ff4fb5da5a794d1648c6b47c1f7d277fd5877fb5e52a730a3595f8c01 04eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
              'hex': '4830450221008e5df62719cd92d7b137d00bbd27f153f2909bcad3a300960bc1020ec6d5e961022039df51600ff4fb5da5a794d1648c6b47c1f7d277fd5877fb5e52a730a3595f8c014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307'
            },
            'sequence': 4294967295,
            'n': 0,
            'addr': 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
            'valueSat': 18535505,
            'value': 0.18535505,
            'doubleSpentTxID': null,
            'isConfirmed': true,
            'confirmations': 242,
            'unconfirmedInput': false
          },
          {
            'txid': 'd8a10aaedf3dd33b5ddf8979273f3dbf61e4638d1aa6a93c59ea22bc65ac2196',
            'vout': 0,
            'scriptSig': {
              'asm': '30440220761464d7bab9515d92260762a97af82a9b25d202d8f7197b1aaec81b6fed541f022059f99606de6b06e17b2cd102dceb3807ebdd9e777a5b77c9a0b3672f5eabcb3101 04eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
              'hex': '4730440220761464d7bab9515d92260762a97af82a9b25d202d8f7197b1aaec81b6fed541f022059f99606de6b06e17b2cd102dceb3807ebdd9e777a5b77c9a0b3672f5eabcb31014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307'
            },
            'sequence': 4294967295,
            'n': 1,
            'addr': 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
            'valueSat': 16419885,
            'value': 0.16419885,
            'doubleSpentTxID': null,
            'isConfirmed': true,
            'confirmations': 242,
            'unconfirmedInput': false
          }
        ],
        'vout': [
          {
            'value': '0.21247964',
            'n': 0,
            'scriptPubKey': {
              'asm': 'OP_DUP OP_HASH160 4b7b335f978f130269fe661423258ae9642df8a1 OP_EQUALVERIFY OP_CHECKSIG',
              'hex': '76a9144b7b335f978f130269fe661423258ae9642df8a188ac',
              'reqSigs': 1,
              'type': 'pubkeyhash',
              'addresses': [
                'mnQ4ZaGessNgdxmWPxbTHcfx4b8R6eUr1X'
              ]
            },
            'spentTxId': null,
            'spentIndex': null,
            'spentHeight': null
          },
          {
            'value': '0.13677426',
            'n': 1,
            'scriptPubKey': {
              'asm': 'OP_DUP OP_HASH160 6efcf883b4b6f9997be9a0600f6c095fe2bd2d92 OP_EQUALVERIFY OP_CHECKSIG',
              'hex': '76a9146efcf883b4b6f9997be9a0600f6c095fe2bd2d9288ac',
              'reqSigs': 1,
              'type': 'pubkeyhash',
              'addresses': [
                'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f'
              ]
            },
            'spentTxId': '614fe1708825f9c21732394e4784cc6808ac1d8b939736bfdead970567561eec',
            'spentIndex': 1,
            'spentHeight': 10,
            'spentTs': 1440997099
          }
        ],
        'blockhash': '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
        'blockheight': 533974,
        'confirmations': 230,
        'time': 1440987503,
        'blocktime': 1440987503,
        'valueOut': 0.3492539,
        'size': 437,
        'valueIn': 0.3495539,
        'fees': 0.0003
      };

      var spentTxId = '614fe1708825f9c21732394e4784cc6808ac1d8b939736bfdead970567561eec';
      var spentIndex = 1;
      var detailedTransaction = {
        hex: '7b5485d3628922f004f470f497f6a83f6df4df347e1bce15831a964623f8072b565f7c7bc5dcbc717c6e2a2301a2f6b4a19e65042ad88c9f5d037628de38603c4f137f625e135691e2bd0169cab74e1368abe858f3c3d116e9d13c4c85ead129d9edf0245a3fb1b35561bd230607dca0dcaf3cffc735a3982d8384a1ecc5d622a7bb4db8b5d47d061701978b1f45e2e39946d66c3394f8a20b8ac8c931a6786f761da2d0f3fa2c7c93edee9f2a94de7c47510498767c3d87afe68815bd6058710bf5d8c850a5d20fc217943d9c00da58a4908d92a0912578247746f2086e54cb7b81b6a9e3cc1741457e956d41bdeaae06c441db96ec39a2d17147dd8f468eeaeaaa78dc2e53d66188a791c46b2a4965639ad72a2b90ee52786e36db1a8cf924346b105a40b41a3027dae657782ef7e8b56d6da86062184cb5366d4886cd2ce27471d9d62d1df447f2e5a9641e1f8d1f2b628054d3bd915bf7932bcec6f2dd4965e2406b1dba445b5493ee475757de332618220318dd806b880a7364370c5c0c3b736a653f97b2901fdb5cf4b5b2230b09b2d7bd324a392633d51c598765f9bd286421239a1f25db34a9a61f645eb601e59f10fc1b',
        hash: 'b85334bf2df35c6dd5b294efe92ffc793a78edff75a2ca666fc296ffb04bbba0',
        version: 1,
        blockHash: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
        height: 533974,
        blockTimestamp: 1440987503,
        inputSatoshis: 34955390,
        outputSatoshis: 34925390,
        feeSatoshis: 30000,
        inputs: [
          {
            address: 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
            prevTxId: '87c9b0f27571fff14b8c2d69e55614eacedd0f59fcc490b721320f9dae145aad',
            outputIndex: 0,
            sequence: 4294967295,
            script: '4830450221008e5df62719cd92d7b137d00bbd27f153f2909bcad3a300960bc1020ec6d5e961022039df51600ff4fb5da5a794d1648c6b47c1f7d277fd5877fb5e52a730a3595f8c014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
            scriptAsm: '30450221008e5df62719cd92d7b137d00bbd27f153f2909bcad3a300960bc1020ec6d5e961022039df51600ff4fb5da5a794d1648c6b47c1f7d277fd5877fb5e52a730a3595f8c01 04eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
            satoshis: 18535505,
          },
          {
            address: 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
            prevTxId: 'd8a10aaedf3dd33b5ddf8979273f3dbf61e4638d1aa6a93c59ea22bc65ac2196',
            outputIndex: 0,
            sequence: 4294967295,
            script: '4730440220761464d7bab9515d92260762a97af82a9b25d202d8f7197b1aaec81b6fed541f022059f99606de6b06e17b2cd102dceb3807ebdd9e777a5b77c9a0b3672f5eabcb31014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
            scriptAsm: '30440220761464d7bab9515d92260762a97af82a9b25d202d8f7197b1aaec81b6fed541f022059f99606de6b06e17b2cd102dceb3807ebdd9e777a5b77c9a0b3672f5eabcb3101 04eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
            satoshis: 16419885,
          }
        ],
        outputs: [
          {
            satoshis: 21247964,
            script: '76a9144b7b335f978f130269fe661423258ae9642df8a188ac',
            scriptAsm: 'OP_DUP OP_HASH160 4b7b335f978f130269fe661423258ae9642df8a1 OP_EQUALVERIFY OP_CHECKSIG',
            address: 'mnQ4ZaGessNgdxmWPxbTHcfx4b8R6eUr1X'
          },
          {
            address: 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
            satoshis: 13677426,
            scriptAsm: 'OP_DUP OP_HASH160 6efcf883b4b6f9997be9a0600f6c095fe2bd2d92 OP_EQUALVERIFY OP_CHECKSIG',
            script: '76a9146efcf883b4b6f9997be9a0600f6c095fe2bd2d9288ac',
            spentTxId: spentTxId,
            spentIndex: spentIndex,
            spentHeight: 10
          }
        ],
        locktime: 0
      };

      var todos = {
        vin: [
          {
            isConfirmed: true,
            confirmations: 242,
            unconfirmedInput: false
          },
          {
            isConfirmed: true,
            confirmations: 242,
            unconfirmedInput: false
          }
        ],
        vout: [
          {
            scriptPubKey: {
              reqSigs: 1
            }
          },
          {
            scriptPubKey: {
              reqSigs: 1
            },
            spentTs: 1440997099
          }
        ]
      };

      var node = {
        getDetailedTransaction: sinon.stub().callsArgWith(1, null, detailedTransaction),
        services: {
          bitcoind: {
            height: 534203
          },
        },
        network: 'testnet'
      };

      var transactions = new TxController(node);
      var txid = 'b85334bf2df35c6dd5b294efe92ffc793a78edff75a2ca666fc296ffb04bbba0';
      var req = {
        params: {
          txid: txid
        }
      };
      var res = {};
      var next = function() {
        var merged = _.merge(req.transaction, todos);
        should(merged).eql(insight);
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
          '25a988e54b02e0e5df146a0f8fa7b9db56210533a9f04bdfda5f4ceb6f77aadd',
          'b85334bf2df35c6dd5b294efe92ffc793a78edff75a2ca666fc296ffb04bbba0',
          '2e01c7a4a0e335112236b711c4aaddd02e8dc59ba2cda416e8f80ff06dddd7e1'
        ]
      };

      var transactionDetails = {
        '25a988e54b02e0e5df146a0f8fa7b9db56210533a9f04bdfda5f4ceb6f77aadd': {
          hex: '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff2303d6250800feb0aae355fe263600000963676d696e6572343208ae5800000000000000ffffffff01c018824a000000001976a91468bedce8982d25c3b6b03f6238cbad00378b8ead88ac00000000',
          coinbase: true,
          version: 1,
          blockTimestamp: 1440987503,
          blockHash: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
          height: 533974,
          inputSatoshis: 0,
          outputSatoshis: 1250040000,
          feeSatoshis: 0,
          locktime: 0,
          hash: '25a988e54b02e0e5df146a0f8fa7b9db56210533a9f04bdfda5f4ceb6f77aadd',
          inputs: [
            {
              script: '03d6250800feb0aae355fe263600000963676d696e6572343208ae5800000000000000',
              sequence: 4294967295
            }
          ],
          outputs: [
            {
              address: 'mq4oDPjmNWnBxbzx7qouzhpCSTMePUtYDF',
              script: '76a91468bedce8982d25c3b6b03f6238cbad00378b8ead88ac',
              scriptAsm: 'OP_DUP OP_HASH160 68bedce8982d25c3b6b03f6238cbad00378b8ead OP_EQUALVERIFY OP_CHECKSIG',
              satoshis: 1250040000
            }
          ]
        },
        'b85334bf2df35c6dd5b294efe92ffc793a78edff75a2ca666fc296ffb04bbba0': {
          hex: '0100000002ad5a14ae9d0f3221b790c4fc590fddceea1456e5692d8c4bf1ff7175f2b0c987000000008b4830450221008e5df62719cd92d7b137d00bbd27f153f2909bcad3a300960bc1020ec6d5e961022039df51600ff4fb5da5a794d1648c6b47c1f7d277fd5877fb5e52a730a3595f8c014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307ffffffff9621ac65bc22ea593ca9a61a8d63e461bf3d3f277989df5d3bd33ddfae0aa1d8000000008a4730440220761464d7bab9515d92260762a97af82a9b25d202d8f7197b1aaec81b6fed541f022059f99606de6b06e17b2cd102dceb3807ebdd9e777a5b77c9a0b3672f5eabcb31014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307ffffffff02dc374401000000001976a9144b7b335f978f130269fe661423258ae9642df8a188ac72b3d000000000001976a9146efcf883b4b6f9997be9a0600f6c095fe2bd2d9288ac00000000',
          inputSatoshis: 34955390,
          outputSatoshis: 34925390,
          feeSatoshis: 30000,
          version: 1,
          hash: 'b85334bf2df35c6dd5b294efe92ffc793a78edff75a2ca666fc296ffb04bbba0',
          blockTimestamp: 1440987503,
          height: 533974,
          blockHash: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
          locktime: 0,
          inputs: [
            {
              satoshis: 18535505,
              address: 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
              script: '4830450221008e5df62719cd92d7b137d00bbd27f153f2909bcad3a300960bc1020ec6d5e961022039df51600ff4fb5da5a794d1648c6b47c1f7d277fd5877fb5e52a730a3595f8c014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
              scriptAsm: '30450221008e5df62719cd92d7b137d00bbd27f153f2909bcad3a300960bc1020ec6d5e961022039df51600ff4fb5da5a794d1648c6b47c1f7d277fd5877fb5e52a730a3595f8c01 04eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
              prevTxId: '87c9b0f27571fff14b8c2d69e55614eacedd0f59fcc490b721320f9dae145aad',
              outputIndex: 0,
              sequence: 4294967295
            },
            {
              address: 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
              script: '4730440220761464d7bab9515d92260762a97af82a9b25d202d8f7197b1aaec81b6fed541f022059f99606de6b06e17b2cd102dceb3807ebdd9e777a5b77c9a0b3672f5eabcb31014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
              scriptAsm: '30440220761464d7bab9515d92260762a97af82a9b25d202d8f7197b1aaec81b6fed541f022059f99606de6b06e17b2cd102dceb3807ebdd9e777a5b77c9a0b3672f5eabcb3101 04eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
              satoshis: 16419885,
              sequence: 4294967295,
              prevTxId: 'd8a10aaedf3dd33b5ddf8979273f3dbf61e4638d1aa6a93c59ea22bc65ac2196',
              outputIndex: 0
            }
          ],
          outputs: [
            {
              address: 'mnQ4ZaGessNgdxmWPxbTHcfx4b8R6eUr1X',
              script: '76a9144b7b335f978f130269fe661423258ae9642df8a188ac',
              scriptAsm: 'OP_DUP OP_HASH160 4b7b335f978f130269fe661423258ae9642df8a1 OP_EQUALVERIFY OP_CHECKSIG',
              satoshis: 21247964
            },
            {
              script: '76a9146efcf883b4b6f9997be9a0600f6c095fe2bd2d9288ac',
              scriptAsm: 'OP_DUP OP_HASH160 6efcf883b4b6f9997be9a0600f6c095fe2bd2d92 OP_EQUALVERIFY OP_CHECKSIG',
              address: 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
              satoshis: 13677426,
              spentTxId: '614fe1708825f9c21732394e4784cc6808ac1d8b939736bfdead970567561eec',
              spentIndex: 1,
              spentHeight: 200
            }
          ]
        },
        '2e01c7a4a0e335112236b711c4aaddd02e8dc59ba2cda416e8f80ff06dddd7e1': {
          hex: '0100000002060d3cb6dfb7ffe85e2908010fea63190c9707e96fc7448128eb895b5e222771030000006b483045022100f67cffc0ae23adb236ff3edb4a9736e277605db30cc7708dfab8cf1e1483bbce022052396aa5d664ec1cb65992c423fd9a17e94dc7af328d2d559e90746dd195ca5901210346134da14907581d8190d3980caaf46d95e4eb9c1ca8e70f1fc6007fefb1909dfeffffff7b2d8a8263cffbdb722e2a5c74166e6f2258634e277c0b08f51b578b667e2fba000000006a473044022077222a91cda23af69179377c62d84a176fb12caff6c5cbf6ae9e5957ff3b1afe0220768edead76819228dcba18cca3c9a5a5d4c32919720f21df21a297ba375bbe5c012103371ea5a4dfe356b3ea4042a537d7ab7ee0faabd43e21b6cc076fda2240629eeefeffffff02209a1d00000000001976a9148e451eec7ca0a1764b4ab119274efdd2727b3c8588ac40420f00000000001976a914d0fce8f064cd1059a6a11501dd66fe42368572b088accb250800',
          blockHash: '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
          blockTimestamp: 1440987503,
          height: 533974,
          locktime: 533963,
          inputSatoshis: 2950000,
          outputSatoshis: 2940000,
          feeSatoshis: 10000,
          version: 1,
          hash: '2e01c7a4a0e335112236b711c4aaddd02e8dc59ba2cda416e8f80ff06dddd7e1',
          inputs: [
            {
              address: 'mgZK8zpudWoAaAwpLQSgc9t9PJJyEBpBdJ',
              satoshis: 990000,
              script: '483045022100f67cffc0ae23adb236ff3edb4a9736e277605db30cc7708dfab8cf1e1483bbce022052396aa5d664ec1cb65992c423fd9a17e94dc7af328d2d559e90746dd195ca5901210346134da14907581d8190d3980caaf46d95e4eb9c1ca8e70f1fc6007fefb1909d',
              scriptAsm: '3045022100f67cffc0ae23adb236ff3edb4a9736e277605db30cc7708dfab8cf1e1483bbce022052396aa5d664ec1cb65992c423fd9a17e94dc7af328d2d559e90746dd195ca5901 0346134da14907581d8190d3980caaf46d95e4eb9c1ca8e70f1fc6007fefb1909d',
              sequence: 4294967294,
              outputIndex: 3,
              prevTxId: '7127225e5b89eb288144c76fe907970c1963ea0f0108295ee8ffb7dfb63c0d06'
            },
            {
              address: 'n4oM7bPuC4ZPdCEDvtw9xGYQC7jmi5S6F4',
              satoshis: 1960000,
              script: '473044022077222a91cda23af69179377c62d84a176fb12caff6c5cbf6ae9e5957ff3b1afe0220768edead76819228dcba18cca3c9a5a5d4c32919720f21df21a297ba375bbe5c012103371ea5a4dfe356b3ea4042a537d7ab7ee0faabd43e21b6cc076fda2240629eee',
              scriptAsm: '3044022077222a91cda23af69179377c62d84a176fb12caff6c5cbf6ae9e5957ff3b1afe0220768edead76819228dcba18cca3c9a5a5d4c32919720f21df21a297ba375bbe5c01 03371ea5a4dfe356b3ea4042a537d7ab7ee0faabd43e21b6cc076fda2240629eee',
              prevTxId: 'ba2f7e668b571bf5080b7c274e6358226f6e16745c2a2e72dbfbcf63828a2d7b',
              sequence: 4294967294,
              outputIndex : 0
            }
          ],
          outputs: [
            {
              spentTxId: '9a213b879da9073a9a30606f9046f35f36f268cbf03f6242993a97c4c07c00b9',
              spentIndex: 1,
              spentHeight: 200,
              satoshis: 1940000,
              script: '76a9148e451eec7ca0a1764b4ab119274efdd2727b3c8588ac',
              scriptAsm: 'OP_DUP OP_HASH160 8e451eec7ca0a1764b4ab119274efdd2727b3c85 OP_EQUALVERIFY OP_CHECKSIG',
              address: 'mtVD3tdifBNujYzZ5N7PgXfKk4Bc85tDKA'
            },
            {
              spentTxId: '418d3eb60275957b3456b96902e908abf962e71be4c4f09486564254664951bc',
              spentIndex: 34,
              spentHeight: 200,
              script: '76a914d0fce8f064cd1059a6a11501dd66fe42368572b088ac',
              scriptAsm: 'OP_DUP OP_HASH160 d0fce8f064cd1059a6a11501dd66fe42368572b0 OP_EQUALVERIFY OP_CHECKSIG',
              address: 'mzZypShcs1B35udnkqeYeJy8rUdgHDDvKG',
              satoshis: 1000000
            }
          ]
        }
      };

      var node = {
        getBlockOverview: sinon.stub().callsArgWith(1, null, blockOverview),
        getDetailedTransaction: function(txid, callback) {
          callback(null, transactionDetails[txid]);
        },
        services: {
          bitcoind: {
            height: 534209
          }
        },
        network: 'testnet'
      };

      var transactions = new TxController(node);

      var insight = {
        'pagesTotal': 1,
        'txs': [
          {
            'txid': '25a988e54b02e0e5df146a0f8fa7b9db56210533a9f04bdfda5f4ceb6f77aadd',
            'version': 1,
            'locktime': 0,
            'vin': [
              {
                'coinbase': '03d6250800feb0aae355fe263600000963676d696e6572343208ae5800000000000000',
                'sequence': 4294967295,
                'n': 0
              }
            ],
            'vout': [
              {
                'value': '12.50040000',
                'n': 0,
                'scriptPubKey': {
                  'asm': 'OP_DUP OP_HASH160 68bedce8982d25c3b6b03f6238cbad00378b8ead OP_EQUALVERIFY OP_CHECKSIG',
                  'hex': '76a91468bedce8982d25c3b6b03f6238cbad00378b8ead88ac',
                  'reqSigs': 1,
                  'type': 'pubkeyhash',
                  'addresses': [
                    'mq4oDPjmNWnBxbzx7qouzhpCSTMePUtYDF'
                  ]
                },
                'spentTxId': null,
                'spentIndex': null,
                'spentHeight': null
              }
            ],
            'blockhash': '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
            'blockheight': 533974,
            'confirmations': 236,
            'time': 1440987503,
            'blocktime': 1440987503,
            'isCoinBase': true,
            'valueOut': 12.5004,
            'size': 120
          },
          {
            'txid': 'b85334bf2df35c6dd5b294efe92ffc793a78edff75a2ca666fc296ffb04bbba0',
            'version': 1,
            'locktime': 0,
            'vin': [
              {
                'txid': '87c9b0f27571fff14b8c2d69e55614eacedd0f59fcc490b721320f9dae145aad',
                'vout': 0,
                'scriptSig': {
                  'asm': '30450221008e5df62719cd92d7b137d00bbd27f153f2909bcad3a300960bc1020ec6d5e961022039df51600ff4fb5da5a794d1648c6b47c1f7d277fd5877fb5e52a730a3595f8c01 04eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
                  'hex': '4830450221008e5df62719cd92d7b137d00bbd27f153f2909bcad3a300960bc1020ec6d5e961022039df51600ff4fb5da5a794d1648c6b47c1f7d277fd5877fb5e52a730a3595f8c014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307'
                },
                'sequence': 4294967295,
                'n': 0,
                'addr': 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
                'valueSat': 18535505,
                'value': 0.18535505,
                'doubleSpentTxID': null
              },
              {
                'txid': 'd8a10aaedf3dd33b5ddf8979273f3dbf61e4638d1aa6a93c59ea22bc65ac2196',
                'vout': 0,
                'scriptSig': {
                  'asm': '30440220761464d7bab9515d92260762a97af82a9b25d202d8f7197b1aaec81b6fed541f022059f99606de6b06e17b2cd102dceb3807ebdd9e777a5b77c9a0b3672f5eabcb3101 04eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307',
                  'hex': '4730440220761464d7bab9515d92260762a97af82a9b25d202d8f7197b1aaec81b6fed541f022059f99606de6b06e17b2cd102dceb3807ebdd9e777a5b77c9a0b3672f5eabcb31014104eb1e0ccd9afcac42229348dd776e991c69551ae3474340fada12e787e51758397e1d3afdba360d6374261125ea3b6ea079a5f202c150dfd729e1062d9176a307'
                },
                'sequence': 4294967295,
                'n': 1,
                'addr': 'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f',
                'valueSat': 16419885,
                'value': 0.16419885,
                'doubleSpentTxID': null
              }
            ],
            'vout': [
              {
                'value': '0.21247964',
                'n': 0,
                'scriptPubKey': {
                  'asm': 'OP_DUP OP_HASH160 4b7b335f978f130269fe661423258ae9642df8a1 OP_EQUALVERIFY OP_CHECKSIG',
                  'hex': '76a9144b7b335f978f130269fe661423258ae9642df8a188ac',
                  'reqSigs': 1,
                  'type': 'pubkeyhash',
                  'addresses': [
                    'mnQ4ZaGessNgdxmWPxbTHcfx4b8R6eUr1X'
                  ]
                },
                'spentTxId': null,
                'spentIndex': null,
                'spentHeight': null
              },
              {
                'value': '0.13677426',
                'n': 1,
                'scriptPubKey': {
                  'asm': 'OP_DUP OP_HASH160 6efcf883b4b6f9997be9a0600f6c095fe2bd2d92 OP_EQUALVERIFY OP_CHECKSIG',
                  'hex': '76a9146efcf883b4b6f9997be9a0600f6c095fe2bd2d9288ac',
                  'reqSigs': 1,
                  'type': 'pubkeyhash',
                  'addresses': [
                    'mqdofsXHpePPGBFXuwwypAqCcXi48Xhb2f'
                  ]
                },
                'spentTxId': '614fe1708825f9c21732394e4784cc6808ac1d8b939736bfdead970567561eec',
                'spentIndex': 1,
                'spentHeight': 200,
                'spentTs': 1440997099
              }
            ],
            'blockhash': '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
            'blockheight': 533974,
            'confirmations': 236,
            'time': 1440987503,
            'blocktime': 1440987503,
            'valueOut': 0.3492539,
            'size': 437,
            'valueIn': 0.3495539,
            'fees': 0.0003
          },
          {
            'txid': '2e01c7a4a0e335112236b711c4aaddd02e8dc59ba2cda416e8f80ff06dddd7e1',
            'version': 1,
            'locktime': 533963,
            'vin': [
              {
                'txid': '7127225e5b89eb288144c76fe907970c1963ea0f0108295ee8ffb7dfb63c0d06',
                'vout': 3,
                'scriptSig': {
                  'asm': '3045022100f67cffc0ae23adb236ff3edb4a9736e277605db30cc7708dfab8cf1e1483bbce022052396aa5d664ec1cb65992c423fd9a17e94dc7af328d2d559e90746dd195ca5901 0346134da14907581d8190d3980caaf46d95e4eb9c1ca8e70f1fc6007fefb1909d',
                  'hex': '483045022100f67cffc0ae23adb236ff3edb4a9736e277605db30cc7708dfab8cf1e1483bbce022052396aa5d664ec1cb65992c423fd9a17e94dc7af328d2d559e90746dd195ca5901210346134da14907581d8190d3980caaf46d95e4eb9c1ca8e70f1fc6007fefb1909d'
                },
                'sequence': 4294967294,
                'n': 0,
                'addr': 'mgZK8zpudWoAaAwpLQSgc9t9PJJyEBpBdJ',
                'valueSat': 990000,
                'value': 0.0099,
                'doubleSpentTxID': null
              },
              {
                'txid': 'ba2f7e668b571bf5080b7c274e6358226f6e16745c2a2e72dbfbcf63828a2d7b',
                'vout': 0,
                'scriptSig': {
                  'asm': '3044022077222a91cda23af69179377c62d84a176fb12caff6c5cbf6ae9e5957ff3b1afe0220768edead76819228dcba18cca3c9a5a5d4c32919720f21df21a297ba375bbe5c01 03371ea5a4dfe356b3ea4042a537d7ab7ee0faabd43e21b6cc076fda2240629eee',
                  'hex': '473044022077222a91cda23af69179377c62d84a176fb12caff6c5cbf6ae9e5957ff3b1afe0220768edead76819228dcba18cca3c9a5a5d4c32919720f21df21a297ba375bbe5c012103371ea5a4dfe356b3ea4042a537d7ab7ee0faabd43e21b6cc076fda2240629eee'
                },
                'sequence': 4294967294,
                'n': 1,
                'addr': 'n4oM7bPuC4ZPdCEDvtw9xGYQC7jmi5S6F4',
                'valueSat': 1960000,
                'value': 0.0196,
                'doubleSpentTxID': null
              }
            ],
            'vout': [
              {
                'value': '0.01940000',
                'n': 0,
                'scriptPubKey': {
                  'asm': 'OP_DUP OP_HASH160 8e451eec7ca0a1764b4ab119274efdd2727b3c85 OP_EQUALVERIFY OP_CHECKSIG',
                  'hex': '76a9148e451eec7ca0a1764b4ab119274efdd2727b3c8588ac',
                  'reqSigs': 1,
                  'type': 'pubkeyhash',
                  'addresses': [
                    'mtVD3tdifBNujYzZ5N7PgXfKk4Bc85tDKA'
                  ]
                },
                'spentTxId': '9a213b879da9073a9a30606f9046f35f36f268cbf03f6242993a97c4c07c00b9',
                'spentIndex': 1,
                'spentHeight': 200,
                'spentTs': 1440992946
              },
              {
                'value': '0.01000000',
                'n': 1,
                'scriptPubKey': {
                  'asm': 'OP_DUP OP_HASH160 d0fce8f064cd1059a6a11501dd66fe42368572b0 OP_EQUALVERIFY OP_CHECKSIG',
                  'hex': '76a914d0fce8f064cd1059a6a11501dd66fe42368572b088ac',
                  'reqSigs': 1,
                  'type': 'pubkeyhash',
                  'addresses': [
                    'mzZypShcs1B35udnkqeYeJy8rUdgHDDvKG'
                  ]
                },
                'spentTxId': '418d3eb60275957b3456b96902e908abf962e71be4c4f09486564254664951bc',
                'spentIndex': 34,
                'spentHeight': 200,
                'spentTs': 1440999118
              }
            ],
            'blockhash': '0000000000000afa0c3c0afd450c793a1e300ec84cbe9555166e06132f19a8f7',
            'blockheight': 533974,
            'confirmations': 236,
            'time': 1440987503,
            'blocktime': 1440987503,
            'valueOut': 0.0294,
            'size': 373,
            'valueIn': 0.0295,
            'fees': 0.0001
          }
        ]
      };

      var todos = {
        txs: [
          {
            vout: [
              {
                scriptPubKey: {
                  reqSigs: 1
                }
              }
            ]
          },
          {
            vin: [
            ],
            vout: [
              {
                scriptPubKey: {
                  reqSigs: 1
                }
              },
              {
                scriptPubKey: {
                  reqSigs: 1
                },
                spentTs: 1440997099
              }
            ]
          },
          {
            vin: [
            ],
            vout: [
              {
                scriptPubKey: {
                  reqSigs: 1
                },
                spentTs: 1440992946
              },
              {
                scriptPubKey: {
                  reqSigs: 1
                },
                spentTs: 1440999118
              }
            ]
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
          _.merge(data, todos);
          should(data).eql(insight);
          done();
        }
      };

      transactions.list(req, res);
    });
    it('by address', function(done) {

      var txinfos = [
        {
          tx: {
            hex: '010000000125c46caa6d839435b43c20d6d48978e677841244b37a09f6f6cd29bfaf5b5eea010000006b483045022100f4d169783bef70e3943d2a617cce55d9fe4e33fc6f9880b8277265e2f619a97002201238648abcdf52960500664e969046d41755f7fc371971ebc78002fc418465a6012103acdcd31d51272403ce0829447e59e2ac9e08ed0bf92011cbf7420addf24534e6feffffff02a913dda5000000001976a9143583efb5e64a4668c6c54bb5fcc30af4417b4f2d88ac809fd500000000001976a9149713201957f42379e574d7c70d506ee49c2c8ad688ac49260800',
            hash: 'bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7',
            version: 1,
            inputs: [
              {
                prevTxId: 'ea5e5bafbf29cdf6f6097ab344128477e67889d4d6203cb43594836daa6cc425',
                outputIndex: 1,
                sequence: 4294967294,
                script: '483045022100f4d169783bef70e3943d2a617cce55d9fe4e33fc6f9880b8277265e2f619a97002201238648abcdf52960500664e969046d41755f7fc371971ebc78002fc418465a6012103acdcd31d51272403ce0829447e59e2ac9e08ed0bf92011cbf7420addf24534e6',
                scriptAsm: '3045022100f4d169783bef70e3943d2a617cce55d9fe4e33fc6f9880b8277265e2f619a97002201238648abcdf52960500664e969046d41755f7fc371971ebc78002fc418465a601 03acdcd31d51272403ce0829447e59e2ac9e08ed0bf92011cbf7420addf24534e6',
                satoshis: 2796764565,
                address: 'msyjRQQ88MabQmyafpKCjBHUwuJ49tVjcb'
              }
            ],
            outputs: [
              {
                satoshis: 2782729129,
                address: 'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er',
                script: '76a9143583efb5e64a4668c6c54bb5fcc30af4417b4f2d88ac',
                scriptAsm: 'OP_DUP OP_HASH160 3583efb5e64a4668c6c54bb5fcc30af4417b4f2d OP_EQUALVERIFY OP_CHECKSIG'
              },
              {
                satoshis: 14000000,
                address: 'muHmEsjhjmATf9i3T9gHyeQoce9LXe2dWz',
                script: '76a9149713201957f42379e574d7c70d506ee49c2c8ad688ac',
                scriptAsm: 'OP_DUP OP_HASH160 9713201957f42379e574d7c70d506ee49c2c8ad6 OP_EQUALVERIFY OP_CHECKSIG'
              }
            ],
            inputSatoshis: 2796764565,
            outputSatoshis: 2796729129,
            feeSatoshis: 35436,
            locktime: 534089
          }
        },
        {
          tx: {
            hex: '0100000001c7f1230d689647ccbff2aae4ddeeccf26aa8836fea709552c9fa0962b9c30ebb000000006a47304402201ee69281db6b95bb1aa3074059b67581635b719e8f64e4c2694db6ec56ad9447022011e91528996ea459b1fb2c0b59363fecbefe4bc2ca90f7b2382bdaa358f2d5640121034cc057b12a68ee79df998004b9a1341bbb18b17ea4939bebaa3bac001e940f24feffffff02bce0c9a4000000001976a91456e446bc3489543d8324c6d0271524c0bd0506dd88ac80a81201000000001976a914011d2963b619186a318f768dddfd98cd553912a088ac53260800',
            hash: '01f700df84c466f2a389440e5eeacdc47d04f380c39e5d19dce2ce91a11ecba3',
            version: 1,
            inputs: [
              {
                prevTxId: 'bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7',
                outputIndex: 0,
                sequence: 4294967294,
                script: '47304402201ee69281db6b95bb1aa3074059b67581635b719e8f64e4c2694db6ec56ad9447022011e91528996ea459b1fb2c0b59363fecbefe4bc2ca90f7b2382bdaa358f2d5640121034cc057b12a68ee79df998004b9a1341bbb18b17ea4939bebaa3bac001e940f24',
                scriptAsm: '304402201ee69281db6b95bb1aa3074059b67581635b719e8f64e4c2694db6ec56ad9447022011e91528996ea459b1fb2c0b59363fecbefe4bc2ca90f7b2382bdaa358f2d56401 034cc057b12a68ee79df998004b9a1341bbb18b17ea4939bebaa3bac001e940f24',
                satoshis: 2782729129,
                address: 'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er'
              }
            ],
            outputs: [
              {
                satoshis: 2764693692,
                address: 'moSPsU4p2C2gssiniJ1JNH4fB9xs633tLv',
                script: '76a91456e446bc3489543d8324c6d0271524c0bd0506dd88ac',
                scriptAsm: 'OP_DUP OP_HASH160 56e446bc3489543d8324c6d0271524c0bd0506dd OP_EQUALVERIFY OP_CHECKSIG'
              },
              {
                satoshis: 18000000,
                scriptAsm: 'OP_DUP OP_HASH160 011d2963b619186a318f768dddfd98cd553912a0 OP_EQUALVERIFY OP_CHECKSIG',
                script: '76a914011d2963b619186a318f768dddfd98cd553912a088ac',
                address: 'mfcquSAitCkUKXaYRZTRZQDfUegnL3kDew',
                spentTxId: '71a9e60c0341c9c258367f1a6d4253276f16e207bf84f41ff7412d8958a81bed'
              }
            ],
            inputSatoshis: 2782729129,
            outputSatoshis: 2782693692,
            feeSatoshis: 35437,
            locktime: 534099
          }
        }
      ];

      var historyResult = {
        totalCount: txinfos.length,
        items: txinfos
      };

      txinfos[0].tx.blockHash = '00000000000001001aba15de213648f370607fb048288dd27b96f7e833a73520';
      txinfos[0].tx.blockTimestamp = 1441068774;
      txinfos[0].tx.height = 534105;

      txinfos[1].tx.blockHash = '0000000000000a3acc1f7fe72917eb48bb319ed96c125a6dfcc0ba6acab3c4d0';
      txinfos[1].tx.blockTimestamp = 1441072817;
      txinfos[1].tx.height = 534110;

      txinfos[0].tx.outputs[0].spentTxId = '01f700df84c466f2a389440e5eeacdc47d04f380c39e5d19dce2ce91a11ecba3';
      txinfos[0].tx.outputs[0].spentIndex = 0;
      txinfos[0].tx.outputs[0].spentHeight = 199;

      txinfos[1].tx.outputs[0].spentTxId = '661194e5533a395ce9076f292b7e0fb28fe94cd8832a81b4aa0517ff58c1ddd2';
      txinfos[1].tx.outputs[0].spentIndex = 0;
      txinfos[1].tx.outputs[0].spentHeight = 134;

      txinfos[1].tx.outputs[1].spentTxId = '71a9e60c0341c9c258367f1a6d4253276f16e207bf84f41ff7412d8958a81bed';
      txinfos[1].tx.outputs[1].spentIndex = 0;
      txinfos[1].tx.outputs[1].spentHeight = 112;

      var node = {
        getAddressHistory: sinon.stub().callsArgWith(2, null, historyResult),
        services: {
          bitcoind: {
            height: 534223
          }
        },
        network: 'testnet'
      };

      var insight = {
        'pagesTotal': 1,
        'txs': [
          {
            'txid': 'bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7',
            'version': 1,
            'locktime': 534089,
            'vin': [
              {
                'txid': 'ea5e5bafbf29cdf6f6097ab344128477e67889d4d6203cb43594836daa6cc425',
                'vout': 1,
                'scriptSig': {
                  'asm': '3045022100f4d169783bef70e3943d2a617cce55d9fe4e33fc6f9880b8277265e2f619a97002201238648abcdf52960500664e969046d41755f7fc371971ebc78002fc418465a601 03acdcd31d51272403ce0829447e59e2ac9e08ed0bf92011cbf7420addf24534e6',
                  'hex': '483045022100f4d169783bef70e3943d2a617cce55d9fe4e33fc6f9880b8277265e2f619a97002201238648abcdf52960500664e969046d41755f7fc371971ebc78002fc418465a6012103acdcd31d51272403ce0829447e59e2ac9e08ed0bf92011cbf7420addf24534e6'
                },
                'sequence': 4294967294,
                'n': 0,
                'addr': 'msyjRQQ88MabQmyafpKCjBHUwuJ49tVjcb',
                'valueSat': 2796764565,
                'value': 27.96764565,
                'doubleSpentTxID': null
              }
            ],
            'vout': [
              {
                'value': '27.82729129',
                'n': 0,
                'scriptPubKey': {
                  'asm': 'OP_DUP OP_HASH160 3583efb5e64a4668c6c54bb5fcc30af4417b4f2d OP_EQUALVERIFY OP_CHECKSIG',
                  'hex': '76a9143583efb5e64a4668c6c54bb5fcc30af4417b4f2d88ac',
                  'reqSigs': 1,
                  'type': 'pubkeyhash',
                  'addresses': [
                    'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er'
                  ]
                },
                'spentTxId': '01f700df84c466f2a389440e5eeacdc47d04f380c39e5d19dce2ce91a11ecba3',
                'spentIndex': 0,
                'spentHeight': 199,
                'spentTs': 1441072817
              },
              {
                'value': '0.14000000',
                'n': 1,
                'scriptPubKey': {
                  'asm': 'OP_DUP OP_HASH160 9713201957f42379e574d7c70d506ee49c2c8ad6 OP_EQUALVERIFY OP_CHECKSIG',
                  'hex': '76a9149713201957f42379e574d7c70d506ee49c2c8ad688ac',
                  'reqSigs': 1,
                  'type': 'pubkeyhash',
                  'addresses': [
                    'muHmEsjhjmATf9i3T9gHyeQoce9LXe2dWz'
                  ]
                },
                'spentTxId': null,
                'spentIndex': null,
                'spentHeight': null
              }
            ],
            'blockhash': '00000000000001001aba15de213648f370607fb048288dd27b96f7e833a73520',
            'blockheight': 534105,
            'confirmations': 119,
            'time': 1441068774,
            'blocktime': 1441068774,
            'valueOut': 27.96729129,
            'size': 226,
            'valueIn': 27.96764565,
            'fees': 0.00035436
          },
          {
            'txid': '01f700df84c466f2a389440e5eeacdc47d04f380c39e5d19dce2ce91a11ecba3',
            'version': 1,
            'locktime': 534099,
            'vin': [
              {
                'txid': 'bb0ec3b96209fac9529570ea6f83a86af2cceedde4aaf2bfcc4796680d23f1c7',
                'vout': 0,
                'scriptSig': {
                  'asm': '304402201ee69281db6b95bb1aa3074059b67581635b719e8f64e4c2694db6ec56ad9447022011e91528996ea459b1fb2c0b59363fecbefe4bc2ca90f7b2382bdaa358f2d56401 034cc057b12a68ee79df998004b9a1341bbb18b17ea4939bebaa3bac001e940f24',
                  'hex': '47304402201ee69281db6b95bb1aa3074059b67581635b719e8f64e4c2694db6ec56ad9447022011e91528996ea459b1fb2c0b59363fecbefe4bc2ca90f7b2382bdaa358f2d5640121034cc057b12a68ee79df998004b9a1341bbb18b17ea4939bebaa3bac001e940f24'
                },
                'sequence': 4294967294,
                'n': 0,
                'addr': 'mkPvAKZ2rar6qeG3KjBtJHHMSP1wFZH7Er',
                'valueSat': 2782729129,
                'value': 27.82729129,
                'doubleSpentTxID': null
              }
            ],
            'vout': [
              {
                'value': '27.64693692',
                'n': 0,
                'scriptPubKey': {
                  'asm': 'OP_DUP OP_HASH160 56e446bc3489543d8324c6d0271524c0bd0506dd OP_EQUALVERIFY OP_CHECKSIG',
                  'hex': '76a91456e446bc3489543d8324c6d0271524c0bd0506dd88ac',
                  'reqSigs': 1,
                  'type': 'pubkeyhash',
                  'addresses': [
                    'moSPsU4p2C2gssiniJ1JNH4fB9xs633tLv'
                  ]
                },
                'spentTxId': '661194e5533a395ce9076f292b7e0fb28fe94cd8832a81b4aa0517ff58c1ddd2',
                'spentIndex': 0,
                'spentHeight': 134,
                'spentTs': 1441077236
              },
              {
                'value': '0.18000000',
                'n': 1,
                'scriptPubKey': {
                  'asm': 'OP_DUP OP_HASH160 011d2963b619186a318f768dddfd98cd553912a0 OP_EQUALVERIFY OP_CHECKSIG',
                  'hex': '76a914011d2963b619186a318f768dddfd98cd553912a088ac',
                  'reqSigs': 1,
                  'type': 'pubkeyhash',
                  'addresses': [
                    'mfcquSAitCkUKXaYRZTRZQDfUegnL3kDew'
                  ]
                },
                'spentTxId': '71a9e60c0341c9c258367f1a6d4253276f16e207bf84f41ff7412d8958a81bed',
                'spentIndex': 0,
                'spentHeight': 112,
                'spentTs': 1441069523
              }
            ],
            'blockhash': '0000000000000a3acc1f7fe72917eb48bb319ed96c125a6dfcc0ba6acab3c4d0',
            'blockheight': 534110,
            'confirmations': 114,
            'time': 1441072817,
            'blocktime': 1441072817,
            'valueOut': 27.82693692,
            'size': 225,
            'valueIn': 27.82729129,
            'fees': 0.00035437
          }
        ]
      };

      var todos = {
        'txs': [
          {
            'vin': [
            ],
            'vout': [
              {
                'scriptPubKey': {
                  'reqSigs': 1
                },
                'spentTs': 1441072817
              },
              {
                'scriptPubKey': {
                  'reqSigs': 1
                }
              }
            ]
          },
          {
            'vin': [
            ],
            'vout': [
              {
                'scriptPubKey': {
                  'reqSigs': 1
                },
                'spentTs': 1441077236
              },
              {
                'scriptPubKey': {
                  'reqSigs': 1
                },
                'spentTs': 1441069523
              }
            ]
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
          var merged = _.merge(data, todos);
          should(merged).eql(insight);
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
        getTransaction: sinon.stub().callsArgWith(1, null, bitcore.Transaction().fromBuffer(new Buffer(hex, 'hex')))
      };

      var transactions = new TxController(node);

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
      var txid = '25a988e54b02e0e5df146a0f8fa7b9db56210533a9f04bdfda5f4ceb6f77aadd';
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
      var tx = bitcore.Transaction().fromBuffer(new Buffer(rawTx, 'hex'));

      var node = {
        network: bitcore.Networks.livenet
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
      var tx = bitcore.Transaction().fromBuffer(new Buffer(rawTx, 'hex'));

      var node = {
        network: bitcore.Networks.testnet
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
        network: bitcore.Networks.livenet
      };

      var transactions = new TxController(node);

      _.each(testCases, function(tc) {
        var tx = bitcore.Transaction().fromBuffer(new Buffer(tc.rawTx, 'hex'));
        var result = transactions.transformInvTransaction(tx);
        should.exist(result.isRBF);
        result.isRBF.should.equal(tc.expected);
      });
    });

  });
});
