const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
const Nano = require('nano');
const nano = Nano('http://admin:admin@localhost:5984');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbname = 'my_queue';
const db = nano.db.use(dbname);

app.post('/messages', (req, res) => {
  const id = uuidv4();
  const message = {
    created_ts: Date.now(),
    type: 'message',
    status: 'queued',
    msg_body: { ...req.body, id },
  };

  console.log(`Gonna post this ${JSON.stringify(message)}`);

  // Here we would save the message to the db
  db.insert(message)
    .then((v) => {
      console.log('Success');
      return res.send({ status: 'OK', sent: req.body });
    })
    .catch((err) => {
      next(err);
    });
});

app.listen(process.env.PORT || 8888, () =>
  console.log(`Example app listening on port ${process.env.PORT || 8888}!`)
);

exports.app = app;
