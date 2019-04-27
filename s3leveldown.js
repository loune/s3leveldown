var inherits = require('inherits')
  , AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN
  , AbstractIterator = require('abstract-leveldown').AbstractIterator
  , ltgt = require('ltgt')
  , debug = require('debug')('S3LevelDOWN')
  , AWS = require('aws-sdk')

var staticS3 = new AWS.S3({ apiVersion: '2006-03-01' })

function lt(value) {
  return ltgt.compare(value, this._finish) < 0
}

function lte(value) {
  return ltgt.compare(value, this._finish) <= 0
}

function getStartAfterKey(key) {
  var keyMinusOneNum = (key.charCodeAt(key.length - 1) - 1)
  var keyMinusOne = keyMinusOneNum >= 0 ? (String.fromCharCode(keyMinusOneNum) + '\uFFFF') : ''
  return key.substring(0, key.length - 1) + keyMinusOne
}

function nullEmptyUndefined(v) {
  return typeof v === 'undefined' || v === null || v === ''
}

function S3Iterator (db, options) {
  var self = this
  AbstractIterator.call(this, db)
  self._limit   = options.limit

  if (self._limit === -1)
    self._limit = Infinity

  self.keyAsBuffer = options.keyAsBuffer !== false
  self.valueAsBuffer = options.valueAsBuffer !== false
  self.fetchValues = options.values
  self._reverse   = options.reverse
  self._options = options
  self._done = 0
  self.bucket = db.bucket
  self.db = db
  self.s3ListObjectMaxKeys = options.s3ListObjectMaxKeys || 1000
  if (!self._reverse && self._limit < self.s3ListObjectMaxKeys) {
    self.s3ListObjectMaxKeys = self._limit
  }

  self._start = ltgt.lowerBound(options)
  self._finish = ltgt.upperBound(options)
  if (!nullEmptyUndefined(self._finish)) {
    if (ltgt.upperBoundInclusive(options))
      self._test = lte
    else
      self._test = lt
  }

  if (!nullEmptyUndefined(self._start))
    self.startAfter = ltgt.lowerBoundInclusive(options) ? getStartAfterKey(self._start) : self._start
    
  debug('new iterator %o', self._options)
}

inherits(S3Iterator, AbstractIterator)

S3Iterator.prototype._next = function (callback) {
  var self = this

  if (self._done++ >= self._limit || 
    (self.data && self.dataUpto == self.data.length && !self.s3nextContinuationToken))
    return setImmediate(callback)

  if (!self.data || self.dataUpto == self.data.length) {
    listObjects()
  } else {
    fireCallback()
  }

  function listObjects() {
    var params = {
      Bucket: self.bucket,
      MaxKeys: self.s3ListObjectMaxKeys
    }

    if (self.db.folderPrefix !== '') {
      params.Prefix = self.db.folderPrefix
    }

    if (self.s3nextContinuationToken) {
      params.ContinuationToken = self.s3nextContinuationToken
      debug('listObjectsV2 ContinuationToken %s', params.ContinuationToken)
    }
    else if (typeof self.startAfter !== 'undefined') {
      params.StartAfter = self.db.folderPrefix + self.startAfter
    }

    self.db.s3.listObjectsV2(params, function(err, data) {
      if (err) {
        debug('listObjectsV2 error %s', err.message)
        callback(err)
      } else {
        if (data.Contents.length === 0) {
          debug('listObjectsV2 empty')
          return setImmediate(callback)
        }

        debug('listObjectsV2 %d keys', data.Contents.length)

        if (self.data && self.dataUpto === 0) {
          self.data = self.data.concat(data.Contents)
        } else {
          self.data = data.Contents
        }

        self.dataUpto = 0
        self.s3nextContinuationToken = data.NextContinuationToken

        if (self._reverse && self.s3nextContinuationToken &&
          data.Contents.every(function(x) {
            return self._test(x.Key.substring(self.db.folderPrefix.length, x.Key.length)) })
          ) {
          listObjects()
        } else {
          fireCallback()
        }
      }
    })
  }


  function fireCallback() {
    var index, key
    for(;;) {
      index = (!self._reverse) ? self.dataUpto : (self.data.length - 1 - self.dataUpto)
      var awskey = self.data[index].Key
      key = awskey.substring(self.db.folderPrefix.length, awskey.length)
      debug('iterator data index %d: %s', index, key)
      self.dataUpto++

      if (self._test(key)) {
        break
      }

      if (!self._reverse || self.dataUpto === self.data.length) {
        return setImmediate(callback)
      }
    }

    if (self.fetchValues) {
      if (self.data[index].Size === 0)
        getCallback(null, '')
      else
        self.db._get(key, null, getCallback)
    }
    else
      getCallback()

    function getCallback(err, value) {
      if (err) {
        if (err.message == 'NotFound') {
          // collection changed while we were iterating, skip this key
          return setImmediate(function () {
            self._next(callback)
          })
        }
        return setImmediate(function () {
          callback(err)
        })
      }

      if (self.keyAsBuffer && !(key instanceof Buffer))
        key = new Buffer(key)
      if (!self.keyAsBuffer && (value instanceof Buffer))
        key = key.toString('utf8')

      if (self.fetchValues) {
        if (self.valueAsBuffer && !(value instanceof Buffer))
          value = new Buffer(value)
        if (!self.valueAsBuffer && (value instanceof Buffer))
          value = value.toString('utf8')
      }

      setImmediate(function () {
        debug('_next result %s=%s', key, value)
        callback(null, key, value)
      })
    }
  }
}

S3Iterator.prototype._test = function () { return true }

function S3LevelDOWN (location, s3) {
  if (!(this instanceof S3LevelDOWN))
    return new S3LevelDOWN(location)

  if (typeof location !== 'string') {
    throw new Error('constructor requires a location string argument')
  }

  this.s3 = s3 || staticS3;

  if (location.indexOf('/') !== -1) {
    this.folderPrefix = location.substring(location.indexOf('/') + 1, location.length) + '/'
    this.bucket = location.substring(0, location.indexOf('/'))
  } else {
    this.folderPrefix = ''
    this.bucket = location
  }

  debug('db init %s %s', this.bucket, this.folderPrefix)

  AbstractLevelDOWN.call(this)
}

inherits(S3LevelDOWN, AbstractLevelDOWN)

S3LevelDOWN.prototype._open = function (options, callback) {
  this.s3.headBucket({ Bucket: this.bucket }, (err) => {
    if (err) {
      console.log(err);

      // error, bucket is not found
      if (options.createIfMissing) {
        // try to create it
        this.s3.createBucket({ Bucket: this.bucket }, (err) => {
          if (err) {
            setImmediate(() => callback(err))
          } else {
            setImmediate(callback)
          }
        })
      } else {
        setImmediate(() => callback(new Error(`Bucket ${this.bucket} does not exists or is inaccessible`)))
      }
    } else {
      setImmediate(callback)
    }
  })
}

S3LevelDOWN.prototype._put = function (key, value, options, callback) {
  if (nullEmptyUndefined(value))
    value = new Buffer('')

  if (!(value instanceof Buffer || value instanceof String))
    value = String(value)

  this.s3.upload({
    Bucket: this.bucket,
    Key: this.folderPrefix + key,
    Body: value
  }, function(err) {
    if (err) {
      debug('Error s3 upload: %s %s', key, err.message)
      callback(err)
    } else {
      debug('Successful s3 upload: %s', key)
      callback()
    }
  })
}

S3LevelDOWN.prototype._get = function (key, options, callback) {
  this.s3.getObject({
    Bucket: this.bucket,
    Key: this.folderPrefix + key
  }, function (err, data) {
    if (err) {
      debug('Error s3 getObject: %s %s', key, err.message)
      if (err.code === 'NoSuchKey') {
        callback(new Error('NotFound'))
      } else {
        callback(err)
      }
    } else {
      var value = data.Body
      if (options && options.asBuffer && !(value instanceof Buffer))
        value = new Buffer(value)
      if ((!options || !options.asBuffer) && (value instanceof Buffer))
        value = value.toString('utf8')

      debug('getObject: %s', key)
      callback(null, value)
    }
  })

}

S3LevelDOWN.prototype._del = function (key, options, callback) {
  this.s3.deleteObject({
    Bucket: this.bucket,
    Key: this.folderPrefix + key
  }, function (err) {
    if (err) {
      debug('Error s3 delete: %s %s', key, err.message)
      callback(err)
    } else {
      debug('Successful s3 delete: %s', key)
      callback()
    }
  })
}

S3LevelDOWN.prototype._batch = function (array, options, callback) {
  var i = 0
    , len = array.length
    , self = this

    function act(action, cb) {
      if (!action) {
        return setImmediate(cb)
      }

      var key = (action.key instanceof Buffer) ? action.key : String(action.key)
      var value = action.value

      if (action.type === 'put') {
        self._put(key, value, null, cb)
      } else if (action.type === 'del') {
        self._del(key, null, cb)
      }
    }

    function actCallback(err) {
      if (err) {
        return setImmediate(function() { callback(err) })
      }

      if (++i >= len) {
        return setImmediate(callback)
      }

      act(array[i], actCallback)
    }

    act(array[i], actCallback)
}

S3LevelDOWN.prototype._iterator = function (options) {
  return new S3Iterator(this, options)
}

module.exports = S3LevelDOWN
