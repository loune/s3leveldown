const PouchDB = require('pouchdb');

PouchDB.plugin(require('./pouchdb-s3leveldown'));

if (!process.env.S3_TEST_BUCKET) {
  console.error("Please set the S3_TEST_BUCKET environment variable to run the test");
  process.exit(1);
  return;
}

const db = new PouchDB(process.env.S3_TEST_BUCKET, { adapter: 's3leveldown' });

function addTodo(text) {
  const todo = {
    _id: `todo:${text}`,
    title: text,
    completed: false
  };
  db.put(todo, (err, result) => {
    if (!err) {
      console.log('Successfully posted a todo!');
    }
    else {
      console.log(err);
    }
  });
}

function showTodos() {
  db.allDocs({include_docs: true, descending: true}, (err, doc) => {
    if (!err) {
      console.log(doc.rows);
    }
    else {
      console.log(err);
    }
  });
}

addTodo('shopping');
addTodo('isolate');
addTodo('exercise');

showTodos();
