var test = require('tape')
var suite = require('abstract-leveldown/test')
var s3leveldown = require('./s3leveldown')

if (!process.env.S3_TEST_BUCKET) {
  console.error("Please set the S3_TEST_BUCKET environment variable to run the test")
  process.exit(1)
  return
}

var bucketTestIndex = 0;
var testCommon = suite.common({
  test: test,
  factory: function () {
    return new s3leveldown(process.env.S3_TEST_BUCKET + "/__leveldown_test-" + (++bucketTestIndex))
  },
  snapshots: false,
  seek: false,
  bufferKeys: false,
  createIfMissing: false,
  errorIfExists: false
})

suite(testCommon)

// custom tests

var db

test('setUp common', testCommon.setUp)

test('setUp #1', function (t) {
  db = testCommon.factory()
  db.open(function () {
    db.batch()
      .put('foo', 'bar')
      .put('foo2', 'bar2')
      .put('foo3', 'bar3')
      .write(function() { t.end(); })
  })
})

test('lazy iterator next delete next', function (t) {
  var iterator = db.iterator()
    iterator.next(function (err, key, value) {
    t.equal(key.toString(), 'foo', 'correct key')
    db.del('foo2', function () {
      iterator.next(function (err, key, value) {
        t.error(err)
        t.equal(key.toString(), "foo3", 'correct key')
        iterator.end(t.end.bind(t))
      })
    })
  })
})
