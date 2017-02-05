var test = require('tape')
var s3leveldown = require('./s3leveldown')
var testCommon = require('./testCommon')
var testBuffer = new Buffer('hello')

if (!process.env.S3_TEST_BUCKET) {
  console.log("Please set the S3_TEST_BUCKET environment variable to run the test")
  process.exit(1)
  return
}

require('abstract-leveldown/abstract/leveldown-test').args(s3leveldown, test)
require('abstract-leveldown/abstract/open-test').args(s3leveldown, test, testCommon)
require('abstract-leveldown/abstract/open-test').open(s3leveldown, test, testCommon)
require('abstract-leveldown/abstract/del-test').all(s3leveldown, test, testCommon)
require('abstract-leveldown/abstract/put-test').all(s3leveldown, test, testCommon)
require('abstract-leveldown/abstract/get-test').all(s3leveldown, test, testCommon)
require('abstract-leveldown/abstract/put-get-del-test').all(
  s3leveldown, test, testCommon, testBuffer)
require('abstract-leveldown/abstract/close-test').close(s3leveldown, test, testCommon)
//require('abstract-leveldown/abstract/iterator-test').all(s3leveldown, test, testCommon)

require('abstract-leveldown/abstract/batch-test').all(s3leveldown, test, testCommon)
require('abstract-leveldown/abstract/chained-batch-test').all(s3leveldown, test, testCommon)

require('abstract-leveldown/abstract/ranges-test').all(s3leveldown, test, testCommon)


var db

test('setUp common', testCommon.setUp)

test('setUp #1', function (t) {
  db = s3leveldown(testCommon.location())
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
