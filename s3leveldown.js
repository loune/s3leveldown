const AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN
  , AbstractIterator = require('abstract-leveldown').AbstractIterator
  , ltgt = require('ltgt')
  , debug = require('debug')('S3LevelDown')
  , AWS = require('@aws-sdk/client-s3')

const staticS3 = new AWS.S3Client({ apiVersion: '2006-03-01' })

function lt(value) {
  return ltgt.compare(value, this._finish) < 0
}

function lte(value) {
  return ltgt.compare(value, this._finish) <= 0
}

function getStartAfterKey(key) {
  const keyMinusOneNum = (key.charCodeAt(key.length - 1) - 1)
  const keyMinusOne = keyMinusOneNum >= 0 ? (String.fromCharCode(keyMinusOneNum) + '\uFFFF') : ''
  return key.substring(0, key.length - 1) + keyMinusOne
}

function nullEmptyUndefined(v) {
  return typeof v === 'undefined' || v === null || v === ''
}

class S3Iterator extends AbstractIterator {
  constructor(db, options) {
    super(db)
    const self = this
    self._limit = options.limit

    if (self._limit === -1)
      self._limit = Infinity

    self.keyAsBuffer = options.keyAsBuffer !== false
    self.valueAsBuffer = options.valueAsBuffer !== false
    self.fetchValues = options.values
    self._reverse = options.reverse
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

  _next(callback) {
    const self = this

    if (self._done++ >= self._limit ||
      (self.data && self.dataUpto == self.data.length && !self.s3nextContinuationToken))
      return setImmediate(callback)

    if (!self.data || self.dataUpto == self.data.length) {
      listObjects()
    } else {
      fireCallback()
    }

    function listObjects() {
      const params = {
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

      self.db.s3.send(new AWS.ListObjectsV2Command(params), function (err, data) {
        if (err) {
          debug('listObjectsV2 error %s', err.message)
          callback(err)
        } else {
          if (data.KeyCount === 0) {
            debug('listObjectsV2 empty')
            return setImmediate(callback)
          }

          debug('listObjectsV2 %d keys', data.KeyCount)

          if (self.data && self.dataUpto === 0) {
            self.data = self.data.concat(data.Contents)
          } else {
            self.data = data.Contents
          }

          self.dataUpto = 0
          self.s3nextContinuationToken = data.NextContinuationToken

          if (self._reverse && self.s3nextContinuationToken &&
            data.Contents.every(function (x) {
              return self._test(x.Key.substring(self.db.folderPrefix.length, x.Key.length))
            })) {
            listObjects()
          } else {
            fireCallback()
          }
        }
      })
    }

    function fireCallback() {
      let index, key
      for (; ;) {
        index = (!self._reverse) ? self.dataUpto : (self.data.length - 1 - self.dataUpto)
        const awskey = self.data[index].Key
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
          self.db._get(key, { asBuffer: self.valueAsBuffer }, getCallback)
      }
      else
        getCallback()

      function getCallback(err, value) {
        debug('iterator data getCallback %s = %s', key, value)
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
          key = Buffer.from(key)
        if (!self.keyAsBuffer && (key instanceof Buffer))
          key = key.toString('utf8')

        if (self.fetchValues) {
          if (self.valueAsBuffer && !(value instanceof Buffer))
            value = Buffer.from(value)
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

  _test() { return true }
}


class S3LevelDown extends AbstractLevelDOWN {
  constructor(location, s3) {
    super()
    if (typeof location !== 'string') {
      throw new Error('constructor requires a location string argument')
    }

    this.s3 = s3 || staticS3

    if (location.indexOf('/') !== -1) {
      this.folderPrefix = location.substring(location.indexOf('/') + 1, location.length) + '/'
      this.bucket = location.substring(0, location.indexOf('/'))
    } else {
      this.folderPrefix = ''
      this.bucket = location
    }

    debug('db init %s %s', this.bucket, this.folderPrefix)
  }

  _open(options, callback) {
    this.s3.send(new AWS.HeadBucketCommand({ Bucket: this.bucket }), (err) => {
      if (err) {
        // error, bucket is not found
        if (options.createIfMissing && err['$metadata'].httpStatusCode === 404) {
          // try to create it
          this.s3.send(new AWS.CreateBucketCommand({ Bucket: this.bucket }), (err) => {
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

  _put(key, value, options, callback) {
    if (nullEmptyUndefined(value))
      value = Buffer.from('')

    if (!(value instanceof Buffer || value instanceof String))
      value = String(value)

    this.s3.send(new AWS.PutObjectCommand({
      Bucket: this.bucket,
      Key: this.folderPrefix + key,
      Body: value
    }), function (err) {
      if (err) {
        debug('Error s3 upload: %s %s', key, err.message)
        callback(err)
      } else {
        debug('Successful s3 upload: %s', key)
        callback()
      }
    })
  }

  _get(key, options, callback) {
    this.s3.send(new AWS.GetObjectCommand({
      Bucket: this.bucket,
      Key: this.folderPrefix + key
    }), async function (err, data) {
      if (err) {
        debug('Error s3 getObject: %s %s', key, err.message)
        if (err.Code === 'NoSuchKey') {
          callback(new Error('NotFound'))
        } else {
          callback(err)
        }
      } else {
        let value
        try {
          debug('s3 getObject callback as %s: %s', options.asBuffer ? 'buf' : 'string', key)
          if (options && options.asBuffer) {
            const byteArray = await data.Body?.transformToByteArray()
            value = Buffer.from(byteArray.buffer, byteArray.byteOffset, byteArray.byteLength)
          } else {
            value = await data.Body?.transformToString('utf8')
          }
        } catch (err) {
          callback(err, null)
          return
        }
        callback(null, value)
      }
    })
  }

  _del(key, options, callback) {
    this.s3.send(new AWS.DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.folderPrefix + key
    }), function (err) {
      if (err) {
        debug('Error s3 delete: %s %s', key, err.message)
        callback(err)
      } else {
        debug('Successful s3 delete: %s', key)
        callback()
      }
    })
  }

  _batch(array, options, callback) {
    const len = array.length, self = this
    let i = 0;

    function act(action, cb) {
      if (!action) {
        return setImmediate(cb)
      }

      const key = (action.key instanceof Buffer) ? action.key : String(action.key)
      const value = action.value

      if (action.type === 'put') {
        self._put(key, value, null, cb)
      } else if (action.type === 'del') {
        self._del(key, null, cb)
      }
    }

    function actCallback(err) {
      if (err) {
        return setImmediate(function () { callback(err) })
      }

      if (++i >= len) {
        return setImmediate(callback)
      }

      act(array[i], actCallback)
    }

    act(array[i], actCallback)
  }

  _iterator(options) {
    return new S3Iterator(this, options)
  }
}

module.exports = S3LevelDown
