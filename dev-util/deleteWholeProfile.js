#!usr/bin/env node

var email = process.argv[2];

if (!email) {
  console.log('\tdeleteWholeProfile.js <email>');
  process.exit(-1);
}

console.log('\t Deleting email:', email, process.env.INSIGHT_NETWORK);

var p = require('../plugins/emailstore');

p.init({});

p.deleteWholeProfile(email, function(err) {
  if (err)
    console.log('[err:]', err);
  else 
    console.log('done');
});
