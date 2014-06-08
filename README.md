# *insight API*

*insight API* is an open-source bitcoin blockchain  REST
and websocket API. Insight API runs in NodeJS and use LevelDB for storage. 

*Insight API* allows to develop bitcoin related applications such as wallets that 
require certain information from the blockchain that bitcoind does not provide.

A blockchain explorer front-end have been developed to top of *Insight API*, it can
be downloaded at [Github Insight Repository](https://github.com/bitpay/insight).

## IMPORTANT: Upgrading from  v0.1 to v0.2
In order to optimize some queries, the key-value layout in Level DB has been changed.
If you are running v0.1.x, a total resync needs to be done, running `$ util/sync.js -D`. This
needs to run while *insight-api* is shut off. See details at: **Synchronization**.


## IMPORTANT: v0.2 Caching schema

In v0.2 a new cache schema has been introduced. Only information from transactions with
INSIGHT_SAFE_CONFIRMATIONS+ settings will be cached (by default SAFE_CONFIRMATIONS=6). There 
are 3 different caches:
 * nr. of confirmations 
 * transaction spent information
 * scriptPubKey for unspent transactions

Cache data is only populated on request, i.e., only after accessing the required data for
the first time, the information is cached, there is not pre-caching procedure.  To ignore 
cache by default, use INSIGHT_IGNORE_CACHE. Also, address related calls support `?noCache=1`
to ignore the cache in a particular API request.

## Prerequisites

* **bitcoind** - Download and Install [Bitcoin](http://bitcoin.org/en/download)

*insight API* needs a *trusted* bitcoind node to run. *insight API* will connect to the node
thru the RPC API, Peer-to-peer protocol and will even read its raw .dat files for syncing.

Configure bitcoind to listen to RPC calls and set `txindex` to true.
The easiest way to do this is by copying `./etc/bitcoind/bitcoin.conf` to your
bitcoin data directory (usually `"~/.bitcoin"` on Linux, `"%appdata%\Bitcoin\"` on Windows,
or `"~/Library/Application Support/Bitcoin"` on Mac OS X).

bitcoind must be running and must have finished downloading the blockchain **before** running *insight API*.


* **Node.js v0.10.x** - Download and Install [Node.js](http://www.nodejs.org/download/).

* **NPM** - Node.js package manager, should be automatically installed when you get node.js.

## Quick Install
  Check the Prerequisites section above before installing.

  To install Insight API, clone the main repository:

    $ git clone https://github.com/bitpay/insight-api && cd insight-api

  Install dependencies:

    $ npm install

  Run the main application:

    $ node insight.js

  Then open a browser and go to:

    http://localhost:3001

  Please note that the app will need to sync its internal database
  with the blockchain state, which may take some time. You can check
  sync progress from within the web interface.


## Configuration

All configuration is specified in the [config](config/) folder, particularly the [config.js](config/config.js) file. There you can specify your application name and database name. Certain configuration values are pulled from environment variables if they are defined:

```
BITCOIND_HOST         # RPC bitcoind host
BITCOIND_PORT         # RPC bitcoind Port
BITCOIND_P2P_PORT     # P2P bitcoind Port
BITCOIND_USER         # RPC username
BITCOIND_PASS         # RPC password
BITCOIND_DATADIR      # bitcoind datadir. 'testnet3' will be appended automatically if testnet is used. NEED to finish with '/'. e.g: `/vol/data/`
INSIGHT_NETWORK [= 'livenet' | 'testnet']
INSIGHT_DB            # Path where to store insight's internal DB. (defaults to $HOME/.insight)
INSIGHT_SAFE_CONFIRMATIONS=6  # Nr. of confirmation needed to start caching transaction information   
INSIGHT_IGNORE_CACHE  # True to ignore cache of spents in transaction, with more than INSIGHT_SAFE_CONFIRMATIONS confirmations. This is useful for tracking double spents for old transactions.

```

Make sure that bitcoind is configured to [accept incoming connections using 'rpcallowip'](https://en.bitcoin.it/wiki/Running_Bitcoin).

In case the network is changed (testnet to livenet or vice versa) levelDB database needs to be deleted. This can be performed running:
```util/sync.js -D``` and waiting for *insight* to synchronize again.  Once the database is deleted, the sync.js process can be safely interrupted (CTRL+C) and continued from the synchronization process embedded in main app.

## Synchronization

The initial synchronization process scans the blockchain from the paired bitcoind server to update addresses and balances. *insight* needs one (and only one) trusted bitcoind node to run. This node must have finished downloading the blockchain before running *insight*.

While *insight* is synchronizing the website can be accessed (the sync process is embedded in the webserver), but there may be missing data or incorrect balances for addresses. The 'sync' status is shown on the top-right of all pages.

The blockchain can be read from bitcoind's raw `.dat` files or RPC interface. Reading the information from the `.dat` files is much faster so it's the recommended (and default) alternative. `.dat` files are scanned in the default location for each platform. In case a non-standard location is used, it needs to be defined (see the Configuration section). The synchronization type being used can be seen at the [Status page](http://localhost:3001/status).  As of June 2014, using `.dat` files the sync process takes 9 hrs. for livenet and 30 mins. for testnet.

While synchronizing the blockchain, *insight* listens for new blocks and transactions relayed by the bitcoind node. Those are also stored on *insight*'s database. In case *insight* is shutdown for a period of time, restarting it will trigger a partial (historic) synchronization of the blockchain. Depending on the size of that synchronization task, a reverse RPC or forward `.dat` syncing strategy will be used.

If bitcoind is shutdown, *insight* needs to be stopped and restarted once bitcoind is restarted.

### Syncing old blockchain data manualy

  Old blockchain data can be manually synced issuing:

    $ util/sync.js

  Check util/sync.js --help for options, particulary -D to erase the current DB.

  *NOTE* that there is no need to run this manually since the historic synchronization is embedded on the web application, so by running you will trigger the historic sync automatically.


### DB storage requirement

To store the blockchain and address related information, *insight* uses LevelDB. Two DBs are created: txs and blocks. By default these are stored on
  ```<user's home>/db```
Please note that previous version's of Insight-API store that on `<insight's root>/db`

this can be changed on config/config.js. As of June 2014, storing the livenet blockchain takes ~35GB of disk space (2GB for the testnet).

## Development

To run insight locally for development with grunt:

```$ NODE_ENV=development grunt```

To run the tests

```$ grunt test```


Contributions and suggestions are welcomed at [insight-api github repository](https://github.com/bitpay/insight-api).


## API

By default, insight provides a REST API at `/api`, but this prefix is configurable from the var `apiPrefix` in the `config.js` file.

The end-points are:


### Block
```
  /api/block/[:hash]
  /api/block/00000000a967199a2fad0877433c93df785a8d8ce062e5f9b451cd1397bdbf62
```
### Transaction
```
  /api/tx/[:txid]
  /api/tx/525de308971eabd941b139f46c7198b5af9479325c2395db7f2fb5ae8562556c
```
### Address
```
  /api/addr/[:addr][?noTxList=1&noCache=1]
  /api/addr/mmvP3mTe53qxHdPqXEvdu8WdC7GfQ2vmx5?noTxList=1
```
### Unspent Outputs
```
  /api/addr/[:addr]/utxo[?noCache=1]
```
Sample return:
``` json
[
    {
    address: "n2PuaAguxZqLddRbTnAoAuwKYgN2w2hZk7",
    txid: "dbfdc2a0d22a8282c4e7be0452d595695f3a39173bed4f48e590877382b112fc",
    vout: 0,
    ts: 1401276201,
    scriptPubKey: "76a914e50575162795cd77366fb80d728e3216bd52deac88ac",
    amount: 0.001,
    confirmations: 3
    },
    {
    address: "n2PuaAguxZqLddRbTnAoAuwKYgN2w2hZk7",
    txid: "e2b82af55d64f12fd0dd075d0922ee7d6a300f58fe60a23cbb5831b31d1d58b4",
    vout: 0,
    ts: 1401226410,
    scriptPubKey: "76a914e50575162795cd77366fb80d728e3216bd52deac88ac",
    amount: 0.001,
    confirmation: 6    
    confirmationsFromCache: true,
    }
]
```
Please note that in case confirmations are cached (because the number of confirmations if bigger that INSIGHT_SAFE_CONFIRMATIONS) the return will include the pair confirmationsFromCache:true, and confirmations will equal INSIGHT_SAFE_CONFIRMATIONS. See noCache and INSIGHT_IGNORE_CACHE options for details.



### Unspent Outputs for multiple addresses
GET method:
```
  /api/addrs/[:addrs]/utxo
  /api/addrs/2NF2baYuJAkCKo5onjUKEPdARQkZ6SYyKd5,2NAre8sX2povnjy4aeiHKeEh97Qhn97tB1f/utxo
```

POST method:
```
  /api/addrs/utxo
```

POST params:
```
addrs: 2NF2baYuJAkCKo5onjUKEPdARQkZ6SYyKd5,2NAre8sX2povnjy4aeiHKeEh97Qhn97tB1f
```

### Transactions by Block
```
  /api/txs/?block=HASH
  /api/txs/?block=00000000fa6cf7367e50ad14eb0ca4737131f256fc4c5841fd3c3f140140e6b6
```
### Transactions by Address
```
  /api/txs/?address=ADDR
  /api/txs/?address=mmhmMNfBiZZ37g1tgg2t8DDbNoEdqKVxAL
```

### Historic blockchain data sync status
```
  /api/sync
```

### Live network p2p data sync status
```
  /api/peer
```

### Status network
```
  /api/status?q=xxx
```

Where "xxx" can be:

 * getInfo
 * getDifficulty
 * getTxOutSetInfo
 * getBestBlockHash
 * getLastBlockHash

## Web Socket API
The web socket API is served using [socket.io](http://socket.io) at:
```
  /socket.io/1/
```

Bitcoin network events published are:
'tx': new transaction received from network. Data will be a app/models/Transaction object.
Sample output:
```
{
  "txid":"00c1b1acb310b87085c7deaaeba478cef5dc9519fab87a4d943ecbb39bd5b053",
  "processed":false
  ...
}
```


'block': new block received from network. Data will be a app/models/Block object.
Sample output:
```
{
  "hash":"000000004a3d187c430cd6a5e988aca3b19e1f1d1727a50dead6c8ac26899b96",
  "time":1389789343,
  ...
}
```

'sync': every 1% increment on the sync task, this event will be triggered.

Sample output:
```
{
  blocksToSync: 164141,
  syncedBlocks: 475,
  upToExisting: true,
  scanningBackward: true,
  isEndGenesis: true,
  end: "000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943",
  isStartGenesis: false,
  start: "000000009f929800556a8f3cfdbe57c187f2f679e351b12f7011bfc276c41b6d"
}
```


## License
(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
