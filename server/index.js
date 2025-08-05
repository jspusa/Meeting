const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'bookings.json');

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    return { bookings: [], past: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function archivePast(data) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [];
  data.bookings.forEach(b => {
    if (b.date < today) data.past.push(b);
    else upcoming.push(b);
  });
  data.bookings = upcoming;
}

app.get('/api/bookings', (req, res) => {
  const data = readData();
  archivePast(data);
  writeData(data);
  res.json(data.bookings);
});

app.get('/api/past', (req, res) => {
  const data = readData();
  res.json(data.past);
});

app.post('/api/bookings', (req, res) => {
  const booking = req.body;
  const data = readData();
  const conflict = data.bookings.some(b =>
    b.office === booking.office &&
    b.room === booking.room &&
    b.date === booking.date &&
    !(booking.endTime <= b.startTime || booking.startTime >= b.endTime)
  );
  if (conflict) return res.status(400).json({ error: 'Conflict' });
  data.bookings.push(booking);
  writeData(data);
  res.status(201).json(booking);
});

app.delete('/api/bookings/:idx', (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const data = readData();
  if (idx >= 0 && idx < data.bookings.length) {
    data.bookings.splice(idx, 1);
    writeData(data);
    return res.sendStatus(204);
  }
  res.sendStatus(404);
});

app.delete('/api/past/:idx', (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const data = readData();
  if (idx >= 0 && idx < data.past.length) {
    data.past.splice(idx, 1);
    writeData(data);
    return res.sendStatus(204);
  }
  res.sendStatus(404);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
