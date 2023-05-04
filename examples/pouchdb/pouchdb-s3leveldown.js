const CoreLevelPouch = require('pouchdb-adapter-leveldb-core');
const assign = require('pouchdb-utils').assign;
const S3LevelDown = require('s3leveldown');

function S3LevelDownPouch(opts, callback) {
  var _opts = assign({
    db: (bucket) => new S3LevelDown(bucket)
  }, opts);

  CoreLevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
S3LevelDownPouch.valid = function () {
  return true;
};
S3LevelDownPouch.use_prefix = false;

module.exports = function (PouchDB) {
  PouchDB.adapter('s3leveldown', S3LevelDownPouch, true);
}
