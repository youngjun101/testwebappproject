import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, RELAY_URL } from '/config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = '/login.html'; }

document.getElementById('user-email').textContent = session.user.email;
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

// Show admin link only for super_admin role.
const { data: roleRow } = await supabase
  .from('user_roles').select('role').eq('id', session.user.id).maybeSingle();
if (roleRow?.role === 'super_admin') {
  document.getElementById('admin-link').hidden = false;
}

// ---------- WebSocket with exponential backoff ----------
const statusEl = document.getElementById('conn-status');
const logEl = document.getElementById('log');
let ws = null;
let reconnectAttempt = 0;
let reconnectTimer = null;
let manualClose = false;

function setStatus(state, text) {
  statusEl.className = `status status-${state}`;
  statusEl.textContent = text;
}

function log(line) {
  const ts = new Date().toLocaleTimeString();
  logEl.textContent += `[${ts}] ${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function backoffMs() {
  // 1s, 2s, 4s, 8s … capped at 30s, with jitter.
  const base = Math.min(30000, 1000 * 2 ** reconnectAttempt);
  return base + Math.floor(Math.random() * 500);
}

async function connect() {
  setStatus('connecting', 'Connecting…');

  // Refresh session to get a fresh JWT before each (re)connect.
  const { data: { session: fresh } } = await supabase.auth.getSession();
  if (!fresh) { window.location.href = '/login.html'; return; }
  const token = fresh.access_token;

  const url = `${RELAY_URL}?token=${encodeURIComponent(token)}`;
  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    reconnectAttempt = 0;
    setStatus('connected', 'Connected');
    log('WebSocket connected');
  });

  ws.addEventListener('message', (e) => {
    log(`◀ ${e.data}`);
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'status') {
        // Could update UI from TouchDesigner state pushes.
      }
    } catch { /* non-JSON message — fine */ }
  });

  ws.addEventListener('close', (e) => {
    setStatus('disconnected', 'Disconnected');
    log(`Socket closed (code=${e.code})`);
    if (manualClose) return;
    reconnectAttempt += 1;
    const wait = backoffMs();
    log(`Reconnecting in ${Math.round(wait/1000)}s…`);
    reconnectTimer = setTimeout(connect, wait);
  });

  ws.addEventListener('error', () => {
    log('Socket error');
  });
}

function send(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log('⚠ not connected — dropping message');
    return;
  }
  const msg = JSON.stringify(payload);
  ws.send(msg);
  log(`▶ ${msg}`);
}

// ---------- Wire up buttons ----------
document.querySelectorAll('button[data-action]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    let extra = {};
    if (btn.dataset.payload) {
      try { extra = JSON.parse(btn.dataset.payload); } catch {}
    }
    send({ action, ...extra, ts: Date.now() });
  });
});

// ---------- Throttled slider ----------
function throttle(fn, ms) {
  let last = 0; let pending = null; let timer = null;
  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      pending = args;
      clearTimeout(timer);
      timer = setTimeout(() => { last = Date.now(); fn(...pending); }, remaining);
    }
  };
}

const intensityEl = document.getElementById('intensity');
const intensityOut = document.getElementById('intensity-out');
const sendIntensity = throttle((v) => {
  send({ action: 'setIntensity', value: Number(v) / 100, ts: Date.now() });
}, 33); // ~30 fps

intensityEl.addEventListener('input', () => {
  intensityOut.textContent = intensityEl.value;
  sendIntensity(intensityEl.value);
});

// Clean up on logout/navigation.
window.addEventListener('beforeunload', () => {
  manualClose = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) ws.close();
});

connect();
