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

async function chfiltered(dbname, since) {
  console.log('>>> Going to read the changes \n');
  try {
    const resp = await nano.db.changes(dbname, {
      filter: 'filters/active-doc',
      since,
    });
    console.log('>> Pushing response\n');
    return resp;
    console.log(`The monade \n\n ${JSON.stringify(monade)}`);
  } catch (err) {
    console.error(`We cannot get changes ${err}`);
  }

  console.log('Returning from chfiltered');
}

async function intervalFunc() {
  console.log("Let's see the clients list");
  console.log(`${JSON.stringify(wss.clients)}`);

  const { results, last_seq } = await chfiltered(dbname, changesSince);

  console.log(`The returned \n\n ${JSON.stringify(results)}`);
  if (results.length > 0) {
    var processed = [];
    for (let index = 0; index < results.length; index++) {
      try {
        var msg = await db.get(results[index].id);
        console.log(`"Sent" this msg ===>\n\t\t ${JSON.stringify(msg)}`);
      } catch (err) {
        console.error(err);
      }
      processed.push(results[index].id);
    }

    console.log(`${processed.length} == ${results.length}?`);
    if (processed.length == results.length) {
      changesSince = last_seq;
    }
  } else {
    changesSince = last_seq;
  }
  console.log(`changes since is ${changesSince}`);
}

setInterval(intervalFunc, 6000);
