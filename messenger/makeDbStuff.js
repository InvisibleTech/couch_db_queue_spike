const Nano = require('nano');

const nano = Nano('http://admin:admin@localhost:5984');
const dbname = 'my_queue';
const db = nano.db.use(dbname);

async function createdb(dbname) {
  const db = await nano.db.create(dbname).catch((err) => {
    console.log(`Already created db ${err}`);
  });

  return db;
}

// Write real javascript that could be be unit tested
// and stringize on insert.
var postedCurrNotDeletedFilter = function (doc, req) {
  var maxPastTSMS = Date.now() - 60 * 60 * 1000;
  return (
    !doc._deleted &&
    doc.type === 'message' &&
    doc.status === 'queued' &&
    doc.created_ts >= maxPastTSMS
  );
};

// Define a filter design document, filters have the ability
// to take data from a POST body vs. Views. Also, given we
// are working against change logs for records thqat get deleted,
// it seems like Views would be not useful.
async function addFilter(db, func) {
  const ddoc = {
    _id: '_design/filters',
    filters: {
      'active-doc': func.toString(),
    },
  };

  await db.insert(ddoc);
}

var dequeueFunc = function (doc, req) {
  log('doc >>>>>>>>>>>>>>>\n\n');
  log(doc);
  log('doc >>>>>>>>>>>>>>>>\n\n');
  if (!doc) {
    // change nothing in database
    return [null, ''];
  }

  // Cannot have what is not yours to have
  if (!doc.status || doc.status != 'queued') {
    return [null, ''];
  }
  log('req body >>>>>>>>>>>>>>>\n\n');
  log(req.body);
  log('req body >>>>>>>>>>>>>>>>\n\n');

  // Here we match the key which in our real
  // version will include: client_id, client location
  // and client topic - for here just for giggles
  // we use topic - may not use this in real code
  if (doc.msg_body.topic == JSON.parse(req.body).topic) {
    // acquire it and process it
    doc.status = 'dequeued';
    return [doc, doc._id];
  } else {
    return [null, ''];
  }
};

var reEnqueueFunc = function (doc, req) {
  if (!doc) {
    // change nothing in database
    return [null, ''];
  }

  // Cannot have what is not yours to have
  if (!doc.status || doc.status != 'dequeued') {
    return [null, ''];
  }
  // Here we match the key which in our real
  // version will include: client_id, client location
  // and client topic - for here just for giggles
  // we use topic - may not use this in real code
  if (doc.msg_body.topic == JSON.parse(req.body).topic) {
    // acquire it and process it
    doc.status = 'queued';
    return [doc, doc._id];
  } else {
    return [null, ''];
  }
};

async function addUpdater(db, dqfunc, reqfunc) {
  const ddoc = {
    _id: '_design/updates',
    updates: {
      'dequeue-doc': dqfunc.toString(),
      'reenqueue-doc': reqfunc.toString(),
    },
  };

  await db.insert(ddoc);
}
