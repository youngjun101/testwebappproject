# Secure Bidirectional TouchDesigner Web Controller

Production-ready web UI + admin dashboard that drives a local TouchDesigner instance over the internet. Built per the PRD: role-based access (super_admin / operator), Supabase auth, persistent WebSocket relay, and a TD-side Web Socket DAT.

```
my-secure-td-controller/
├── frontend/        Vercel: static UI + serverless admin APIs
├── backend/         Render or Railway: persistent WebSocket relay
└── touchdesigner/   Local machine: Web Socket DAT + Python callbacks
```

## What's implemented

- **Login screen** (`login.html`) — Supabase email/password auth.
- **Controller UI** (`index.html`) — multiple buttons (Effects, Scenes, Colors, Transport), throttled intensity slider, live log, connection status, auto-reconnect with exponential backoff.
- **Admin dashboard** (`admin.html`) — super_admin only; create/list/delete operators.
- **Serverless APIs** (`api/*.js`) — verify caller JWT, confirm super_admin, then hit Supabase Admin API. CORS locked to your site origin.
- **Relay server** (`backend/server.js`) — verifies Supabase JWTs with `jsonwebtoken`, recognizes TD by static service key, routes web→TD and TD→web.
- **TouchDesigner template** (`touchdesigner/websocket_callbacks.py`) — JSON action dispatcher with example handlers.

## What you need to do

See `SETUP_CHECKLIST.md` for the full step-by-step. Short version:

1. Create Supabase project → run `SUPABASE_SCHEMA.sql` → seed your super admin.
2. Fill in `frontend/public/config.js` with your Supabase URL, anon key, and the relay WSS URL.
3. Deploy `backend/` to Render or Railway with `SUPABASE_JWT_SECRET` and `TD_SERVICE_KEY` env vars.
4. Deploy `frontend/` to Vercel with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `PUBLIC_SITE_URL`.
5. In TouchDesigner, drop a Web Socket DAT, point it at your relay with `?token=YOUR_TD_SERVICE_KEY`, and paste in `websocket_callbacks.py`.

## Local dev

```bash
# Backend (relay)
cd backend
cp .env.example .env   # fill in real values
npm install
npm run dev            # listens on :8080

# Frontend (Vercel CLI required)
cd ../frontend
npm install
npx vercel dev         # serves on :3000 with API routes
```

For local-only testing of the UI without Vercel, you can also `python3 -m http.server -d public 5500` — but the admin APIs need `vercel dev` to run.
