var path      = require('path')
  , leveldown = require('./s3leveldown')

var dbidx = 0
  , bucket = process.env.S3_TEST_BUCKET
  , location = function () {
      return bucket + "/__leveldown_test-" + (++dbidx)
    }

  , lastLocation = function () {
      return bucket + "/__leveldown_test-" + dbidx
    }

  , cleanup = function (callback) {
      var db = leveldown(lastLocation())
      db.open(function () {
        collectEntries(db.iterator({ keyAsBuffer: false, values: false }), function (err, data) {
          for (var i in data) {
            data[i].type = 'del'
          }

          db.batch(data, callback)
        })
      })
      
    }

  , setUp = function (t) {
      cleanup(function (err) {
        t.error(err, 'cleanup returned an error')
        t.end()
      })
    }

  , tearDown = function (t) {
      setUp(t) // same cleanup!
    }

  , collectEntries = function (iterator, callback) {
      var data = []
        , next = function () {
            iterator.next(function (err, key, value) {
              if (err) return callback(err)
              if (!arguments.length) {
                return iterator.end(function (err) {
                  callback(err, data)
                })
              }
              data.push({ key: key, value: value })
              setTimeout(next, 0)
            })
          }
      next()
    }

module.exports = {
    location       : location
  , cleanup        : cleanup
  , lastLocation   : lastLocation
  , setUp          : setUp
  , tearDown       : tearDown
  , collectEntries : collectEntries
}
