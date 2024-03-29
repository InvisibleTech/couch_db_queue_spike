const Nano = require('nano');
const nano = Nano('http://admin:admin@localhost:5984');

const dbname = 'my_queue';
const db = nano.db.use(dbname);

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8686 });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    console.log(`Received message => ${message}`);
  });
  ws.send('Hello! Message From Server!!');
});

var changesSince = 0;

async function chfiltered(since) {
  console.log('>>> Going to read the changes \n');
  try {
    const resp = await db.changes({
      filter: 'filters/active-doc',
      since: since,
    });
    console.log('>> Pushing response\n');
    return resp;
  } catch (err) {
    console.error(`We cannot get changes ${err}`);
  }

  console.log('Returning from chfiltered');
  return { results: [], last_seq: 0 };
}

async function intervalFunc() {
  console.log("Let's see the clients list");
  console.log(`${JSON.stringify(wss.clients)}`);

  const { results, last_seq } = await chfiltered(changesSince);

  console.log(`The returned \n\n ${JSON.stringify(results)}`);
  if (results.length > 0) {
    var processed = [];
    for (let index = 0; index < results.length; index++) {
      try {
        var sentOk = false;

        console.log(
          `>>>>>>> \n\n ${JSON.stringify(results[index])} \n\n <<<<<<<<`
        );
        // TODO: For real implementation handle routing keys.
        // Here we would check the message's client id, location and topic
        // to see if it is on the "skip send list" for this round of changes.
        const acquiredId = await db.atomic(
          'updates',
          'dequeue-doc',
          results[index].id,
          { topic: 'mice' }
        );

        try {
          if (acquiredId) {
            var msg = await db.get(acquiredId);
            // TODO: Here we would use a monkey patched send to have this msg
            // sent using route keys. However, if no client is connected at the
            // start of this batch we will ignore this route and hope the next
            // time we still
            console.log(`"Sent" this msg ===>\n\t\t ${JSON.stringify(msg)}`);

            // Pretend the Web Socket Send is okay
            sentOk = true;
            if (!sentOk) {
              // TODO: Here use another update function to reset state to re-queue
              // for this id to unacquire it
            } else {
              // TODO: Here We have "Sent" the message and we can silently remove
              // it. If remove fails it is still in the dequeued state and so we
              // won't pick it up again. In addition, we can have a reaper task
              // periodically retry the deletes. At some point the record ages out.
              try {
                db.destroy(msg._id, msg._rev);
              } catch (err) {
                console.error(err);
              }
              processed.push(msg._id);
            }
          }
        } catch (err) {
          // So we got here on a fetch error
          // re-enqueue the document
        }
      } catch (err) {
        console.error(err);
      }
    }

    console.log(`${processed.length} == ${results.length}?`);
    if (processed.length == results.length) {
      // If we processed all the pending messages correctly then we
      // should advance the search. Eventually unsendable messages
      // age out and we can move foprward because the selected records
      // will work.
      changesSince = last_seq;
    }
  } else {
    // If no results meet our criteria we go for the next sequence number.
    changesSince = last_seq;
  }
  console.log(`changes since is ${changesSince}`);
}

// Will most likely use setTimer and reset after
// completing each processing loop. This is because
// setInterval will fire again even if the prior
// intervalFunc has not completed.
setInterval(intervalFunc, 6000);
