const levelup = require('levelup');
const s3leveldown = require('s3leveldown');

// AWS.config.update({ region:'ap-southeast-2' });

if (!process.env.S3_TEST_BUCKET) {
  console.error("Please set the S3_TEST_BUCKET environment variable to run the test");
  process.exit(1);
  return;
}

const db = levelup(s3leveldown(process.env.S3_TEST_BUCKET));

db.batch()
  .put('name', 'Pikachu')
  .put('dob', 'February 27, 1996')
  .put('occupation', 'Pokemon')
  .write(function () { 
    db.readStream()
      .on('data', console.log)
      .on('close', function () { console.log('Pika pi!') })
  });
