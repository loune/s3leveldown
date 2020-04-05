# S3LevelDOWN PouchDB example

This is an example of using S3LevelDown with [PouchDB](https://github.com/pouchdb/pouchdb) allowing you to use S3 as a backend to PouchDB.

WARNING: Concurrent writes are not supported and will result in database corruption. See this [blog post](https://loune.net/2017/04/using-aws-s3-as-a-database-with-pouchdb/) for more information.

## Running

Set `S3_TEST_BUCKET` to your test S3 bucket.

```bash
$ S3_TEST_BUCKET=mybucket npm start
```
