var levelup = require('levelup');
var bitcore = require('bitcore');
var _ = require('lodash');

var home = process.env['HOME'];
var db = new levelup(process.argv[2] || (home + '/.insight/testnet/emailstore'));
var newDb = new levelup(process.argv[3] || (home + '/.insight/testnet/emailstore.migrated'));

var transformStoredValue = function(key) {
  var oldKey = key.substr('credentials-store-'.length);
  return 'emailstore-' + bitcore.util.twoSha256(oldKey).toString('hex');
};

var transformPending = function(key) {
  var oldKey = key.substr('validation-code-'.length);
  return 'pending-' + oldKey;
};

var transformPassphrase = function(key) {
  var oldKey = key.substr('map-email-'.length);
  return 'email-to-passphrase-' + bitcore.util.twoSha256(oldKey).toString('hex');
};

var transformValidated = function(key) {
  var oldKey = key.substr('validated-email-'.length);
  return 'validated-' + bitcore.util.twoSha256(oldKey).toString('hex');
};

var checks = {
  'credentials-store-': transformStoredValue,
  'validation-code-': transformPending,
  'map-email-': transformPassphrase,
  'validated-email': transformValidated
};

db.createReadStream()
  .on('data', function(data) {
    console.log('- Analizing key: ' + data.key);
    _.each(checks, function(checkFunction, checkName) {

      if (data.key.indexOf(checkName) === 0) {
        db.get('migration-' + data.key, function(err, value) {
          if ((err && err.notFound) || data.value !== value) {

            var newKey = checkFunction(data.key);
            if (data.value !== value) {
              console.log('  - ' + newKey + ' outdated, migrating...')
            } else {
              console.log('  - ' + data.key + ' not migrated, migrating to ' + newKey);
            }

            newDb.put(newKey, data.value, function(err) {
              if (err) {
                console.log('    - Error migrating ' + data.key + '!', err);
              } else {
                db.put('migration-' + data.key, data.value, function() {});
              }
            });
          }
        });
      }
    });
  });
