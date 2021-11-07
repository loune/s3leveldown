const levelup = require('levelup');
const s3leveldown = require('s3leveldown');

// AWS.config.update({ region:'ap-southeast-2' });

if (!process.env.S3_TEST_BUCKET) {
  console.error("Please set the S3_TEST_BUCKET environment variable to run the test");
  process.exit(1);
  return;
}

(async () => {
  // create DB
  const db = levelup(s3leveldown(process.env.S3_TEST_BUCKET));

  // put items
  await db.batch()
    .put('name', 'Pikachu')
    .put('dob', 'February 27, 1996')
    .put('occupation', 'Pokemon')
    .write();
  
  // read items
  await db.createReadStream()
    .on('data', data => { console.log('data', `${data.key.toString()}=${data.value.toString()}`); })
    .on('close', () => { console.log('done!') });
})();
