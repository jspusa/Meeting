const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'bookings.json');
const INDEX_FILE = path.join(__dirname, '..', 'index.html');

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
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

function sendJSON(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    fs.readFile(INDEX_FILE, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/bookings') {
    const data = readData();
    archivePast(data);
    writeData(data);
    return sendJSON(res, 200, data.bookings);
  }

  if (req.method === 'GET' && url.pathname === '/api/past') {
    const data = readData();
    return sendJSON(res, 200, data.past);
  }

  if (req.method === 'POST' && url.pathname === '/api/bookings') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      let booking;
      try {
        booking = JSON.parse(body);
      } catch {
        return sendJSON(res, 400, { error: 'Invalid JSON' });
      }
      const data = readData();
      const conflict = data.bookings.some(b =>
        b.office === booking.office &&
        b.room === booking.room &&
        b.date === booking.date &&
        !(booking.endTime <= b.startTime || booking.startTime >= b.endTime)
      );
      if (conflict) return sendJSON(res, 400, { error: 'Conflict' });
      data.bookings.push(booking);
      writeData(data);
      sendJSON(res, 201, booking);
    });
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/bookings/')) {
    const idx = parseInt(url.pathname.split('/').pop(), 10);
    const data = readData();
    if (idx >= 0 && idx < data.bookings.length) {
      data.bookings.splice(idx, 1);
      writeData(data);
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/past/')) {
    const idx = parseInt(url.pathname.split('/').pop(), 10);
    const data = readData();
    if (idx >= 0 && idx < data.past.length) {
      data.past.splice(idx, 1);
      writeData(data);
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));