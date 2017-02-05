# S3LevelDOWN

An implementation of [LevelDOWN](https://github.com/rvagg/node-leveldown) that uses [Amazon S3](https://aws.amazon.com/s3/) as a backing store. S3 is actually a giant key-value store on the cloud, even though it is marketed as a file store. Use as a backend to [LevelUP](https://github.com/rvagg/node-levelup).

To use this optimally, please read Performance considerations and Warning about concurrency!

You could also just use this as an alternate API to read/write S3. Much simpler to code, compared to the AWS SDK!

## Installation

```bash
$ npm install s3leveldown
```

And install levelup as required:

```bash
$ npm install levelup
```

## Example

Please refer to the [AWS SDK docs to set up your API credentials](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html) before using.

```js
var levelup = require('levelup')
  , db = levelup('my_bucket', { db: require('s3leveldown') })

db.batch()
  .put('name', 'Pikachu')
  .put('dob', 'February 27, 1996')
  .put('occupation', 'Pokemon')
  .write(function () { 
    db.readStream()
      .on('data', console.log)
      .on('close', function () { console.log('Pika pi!') })
  });
```

## Sub folders

You can create your Level DB in a subfolder in your S3 bucket, just use `my_bucket/sub_folder` when passing the location.

## Performance considerations

There are a few performance caveats due to the limited API provided by the AWS S3 API:

* When iterating, getting values is expensive. A seperate S3 API call is made to get the value of each key. If you don't need the value, pass `{ values: false }` in the options. Each S3 API call can return 1000 keys, so if there are 3000 results, 3 calls are made to list the keys, and if getting values as well, another 3000 API calls are made.

* Avoid iterating large datasets when passing `{ reverse: true }`. Since the S3 API call do not allow retriving keys in reverse order, the entire result set needs to stored in memory and reversed. If your database is large ( >5k keys ) be sure to provide start (`gt`, `gte`) and end (`lt`, `lte`), or the entire database will need to be fetched.

* By default when iterating, 1000 keys will be returned. If you only want 10 keys for example, set `{ limit: 10 }` and the S3 API call will only request 10 keys. Note that if you have `{ reverse: true }`, this optimisation does not apply as we need to fetch everything from start to end and reverse it in memory. To override the default number of keys to return in a single API call,  you can set the ` s3ListObjectMaxKeys` option when creating the iterator. The maximum accepted by the S3 API is 1000.

* Specify the AWS region of the bucket to improve performance, by calling `AWS.config.update({ region: 'ap-southeast-2' });` replace `ap-southeast-2` with your region.

## Warning about concurrency

Individual operations (`put` `get` `del`) are atomic as guaranteed by S3, but the implementation of `batch` is not atomic. Two concurrent batch calls will have their operations interwoven. Don't use any plugins which require this to be atomic or you will end up with your database corrupted! However, if you can guarantee that only one process will write the S3 bucket at a time, then this should not be an issue. Ideally, you want to avoid race conditions where two processes are writing to the same key at the same time. In those cases the last write wins.

When iterating through a list of keys that may be modified, you may get the changes, similar to dirty reads.

## Tests and debug

S3LevelDOWN uses [debug](https://github.com/visionmedia/debug). To see debug message set the environment variable `DEBUG=S3LevelDOWN`

To run the test suite, you to set a S3 bucket to the environment variable `S3_TEST_BUCKET`. Also be sure to [set your AWS credentials](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html)

```bash
$ S3_TEST_BUCKET=my-test-bucket npm run test
```

## License

MIT
