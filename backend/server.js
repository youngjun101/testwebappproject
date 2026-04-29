// Persistent WebSocket relay for the TouchDesigner Web Controller.
// - Verifies Supabase-issued JWTs from web clients.
// - Recognizes a single TouchDesigner client by static service key.
// - Routes web → TD and TD → all web clients.

import 'dotenv/config';
import http from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const TD_KEY = process.env.TD_SERVICE_KEY;

if (!JWT_SECRET || !TD_KEY) {
  console.error('FATAL: SUPABASE_JWT_SECRET and TD_SERVICE_KEY must be set.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  let token = null;
  try {
    const url = new URL(req.url, 'http://x');
    token = url.searchParams.get('token');
  } catch {}

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  let clientInfo;

  if (token === TD_KEY) {
    clientInfo = { isTouchDesigner: true, label: 'touchdesigner' };
  } else {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      clientInfo = {
        isTouchDesigner: false,
        userId: payload.sub,
        email: payload.email,
        label: `web:${payload.email || payload.sub}`,
      };
    } catch (err) {
      console.warn('JWT rejected:', err.message);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.info = clientInfo;
    wss.emit('connection', ws, req);
  });
});

let tdSocket = null;

wss.on('connection', (ws) => {
  console.log(`+ connected: ${ws.info.label}`);

  if (ws.info.isTouchDesigner) {
    if (tdSocket && tdSocket !== ws) {
      // Replace stale TD connection.
      try { tdSocket.close(1000, 'replaced'); } catch {}
    }
    tdSocket = ws;
    broadcastToWeb({ type: 'status', td: 'connected' });
  } else {
    // Tell the new web client whether TD is online.
    safeSend(ws, { type: 'status', td: tdSocket ? 'connected' : 'disconnected' });
  }

  ws.on('message', (raw) => {
    const text = raw.toString();
    if (ws.info.isTouchDesigner) {
      // TD → all web clients.
      broadcastToWeb(text);
    } else {
      // Web → TD only.
      if (tdSocket && tdSocket.readyState === 1) {
        tdSocket.send(text);
      } else {
        safeSend(ws, { type: 'error', message: 'TouchDesigner is not connected' });
      }
    }
  });

  ws.on('close', () => {
    console.log(`- disconnected: ${ws.info.label}`);
    if (ws.info.isTouchDesigner && tdSocket === ws) {
      tdSocket = null;
      broadcastToWeb({ type: 'status', td: 'disconnected' });
    }
  });

  ws.on('error', (err) => console.warn('socket error:', err.message));
});

function broadcastToWeb(msg) {
  const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
  for (const c of wss.clients) {
    if (!c.info?.isTouchDesigner && c.readyState === 1) c.send(text);
  }
}

function safeSend(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch {}
}

server.listen(PORT, () => {
  console.log(`Relay listening on :${PORT}`);
});
