const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

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
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const weekStart = monday.toISOString().slice(0, 10);
  const upcoming = [];
  data.bookings.forEach(b => {
    if (b.date < weekStart) data.past.push(b);
    else upcoming.push(b);
  });
  data.bookings = upcoming;
}

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // Serve frontend
  if (req.method === 'GET' && parsed.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(INDEX_FILE).pipe(res);
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/bookings') {
    const data = readData();
    archivePast(data);
    writeData(data);
    return sendJSON(res, 200, data.bookings);
  }

  if (req.method === 'GET' && parsed.pathname === '/api/past') {
    const data = readData();
    return sendJSON(res, 200, data.past);
  }

  if (req.method === 'POST' && parsed.pathname === '/api/bookings') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const booking = JSON.parse(body || '{}');
        const data = readData();
        data.bookings.push(booking);
        writeData(data);
        return sendJSON(res, 201, booking);
      } catch {
        return sendJSON(res, 400, { error: 'Bad JSON' });
      }
    });
    return;
  }

  if (req.method === 'DELETE' && parsed.pathname === '/api/past') {
    const data = readData();
    data.past = [];
    writeData(data);
    res.writeHead(204).end();
    return;
  }

  const delMatch = parsed.pathname.match(/^\/api\/(bookings|past)\/(\d+)$/);
  if (req.method === 'DELETE' && delMatch) {
    const type = delMatch[1];
    const idx = parseInt(delMatch[2], 10);
    const data = readData();
    const list = type === 'bookings' ? data.bookings : data.past;
    if (idx >= 0 && idx < list.length) {
      list.splice(idx, 1);
      writeData(data);
      res.writeHead(204).end();
    } else {
      res.writeHead(404).end();
    }
    return;
  }

  res.writeHead(404).end();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
