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
        // Here we would check the message's client id, location and topic
        // to see if it is on the "no send list" for this round of changes
        const acquiredId = await db.atomic(
          'updates',
          'dequeue-doc',
          results[index].id,
          { topic: 'mice' }
        );

        try {
          if (acquiredId) {
            var msg = await db.get(acquiredId);
            // Here we would use the monkey patched send to have this msg
            // sent, if this message cannot be sent or gets an exception in
            // sending ... then for this round of changes processing that
            // key gets blocked to avoid sending messages out of order to the
            // client id, location and topic handler
            //
            // The expectation is within the hour window we get the client
            // back up and would get the messages in order
            console.log(`"Sent" this msg ===>\n\t\t ${JSON.stringify(msg)}`);

            // Pretend all is okay
            sentOk = true;
            if (!sentOk) {
              // Here use another update function to reset state to re-queue
              // for this id IOW unacquire it
            } else {
              // Here if we sent it, we consider it done.
              // Delete it silently - catch any exceptions
              // this is just to be clean but it will not be picked up
              // by next change list loop since it should be in the dequeued state
              // a sweeper job can try again for old - dequeued docs that exceed
              // the look back window.
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
      //
      changesSince = last_seq;
    }
  } else {
    changesSince = last_seq;
  }
  console.log(`changes since is ${changesSince}`);
}

// Will most likely use setTimer and reset after
// completing each processing loop. This is because
// setInterval seems to fire again even if the prior
// intervalFunc has not completed.
setInterval(intervalFunc, 6000);
