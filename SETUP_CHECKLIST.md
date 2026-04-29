# Setup checklist

Things only you can do — accounts, secrets, deployments. Work through these in order. Each ☐ is a single step; check it off as you go.

---

## 1. Supabase (database + auth)

☐ **Create project** at https://supabase.com → New project. Pick any name and a strong DB password (you won't need it day-to-day).

☐ **Disable email confirmation.** Authentication → Providers → Email → turn **OFF** "Confirm email".

☐ **Disable public sign-ups.** Authentication → Configuration → toggle **OFF** "Allow new users to sign up".

☐ **Run the schema.** SQL Editor → New query → paste contents of `SUPABASE_SCHEMA.sql` → Run.

☐ **Seed your super admin user.**
  - Authentication → Users → Add user → enter your email + a password.
  - Copy the new user's UUID (click the user, copy `id`).
  - SQL Editor → run:
    ```sql
    insert into public.user_roles (id, role) values ('PASTE-UUID-HERE', 'super_admin');
    ```

☐ **Collect these values** (you'll paste them into Vercel and your config.js shortly):
  - Project Settings → API → **Project URL** → this is `SUPABASE_URL`
  - Project Settings → API → **anon public key** → this is `SUPABASE_ANON_KEY`
  - Project Settings → API → **service_role secret** → this is `SUPABASE_SERVICE_ROLE_KEY` (KEEP SECRET — never put in frontend)
  - Project Settings → API → **JWT Secret** → this is `SUPABASE_JWT_SECRET`

---

## 2. Generate a TouchDesigner service key

☐ Generate a long random string. In a terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Save this as `TD_SERVICE_KEY`. You'll paste it into the relay's env vars AND into the TouchDesigner Web Socket DAT URL.

---

## 3. Deploy the relay (Render or Railway)

Pick ONE. Render is the easier free path.

### Option A — Render
☐ Push the repo to GitHub (or connect via Render's "deploy from local" flow).
☐ Render → New → Web Service → connect your repo → set **Root Directory** to `backend`.
☐ Build Command: `npm install` · Start Command: `npm start` · Instance Type: free is fine.
☐ Environment → add:
  - `SUPABASE_JWT_SECRET` = (from step 1)
  - `TD_SERVICE_KEY` = (from step 2)
☐ Deploy. Note the public URL, e.g. `https://my-td-relay.onrender.com`. The WebSocket URL is the same with `wss://`.

### Option B — Railway
☐ Same idea: new project → service from repo → root `backend` → set the same two env vars → deploy → note the public URL.

☐ **Smoke test:** open `https://YOUR-RELAY.onrender.com/health` in a browser. It should print `ok`.

---

## 4. Deploy the frontend (Vercel)

☐ `npm i -g vercel` (if you don't already have the CLI).

☐ From `frontend/`, run `vercel` and follow the prompts to link the project.

☐ In the Vercel dashboard for this project → Settings → Environment Variables, add:
  - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
  - `SUPABASE_SERVICE_ROLE_KEY` = your Supabase **service_role** key (mark as Secret)
  - `PUBLIC_SITE_URL` = your final Vercel URL, e.g. `https://my-td-controller.vercel.app` (used for CORS allowlist)

☐ **Edit `frontend/public/config.js`** and replace the three placeholders:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `RELAY_URL` = `wss://YOUR-RELAY.onrender.com` (no trailing slash, no `?token=`)

☐ `vercel --prod` to deploy.

☐ Visit your Vercel URL. You should land on the login page. Sign in with the seed super admin credentials.

---

## 5. Wire up TouchDesigner

☐ Open TouchDesigner. In your project, drop a **Web Socket DAT**.

☐ In its parameters:
  - **Network Address:** `wss://YOUR-RELAY.onrender.com?token=YOUR_TD_SERVICE_KEY`
  - **Active:** On
  - **Auto-Reconnect:** On

☐ Open the auto-created callbacks DAT and replace its contents with `touchdesigner/websocket_callbacks.py`.

☐ Edit `ACTION_HANDLERS` paths in that script to point at the real operators in your network.

☐ Save the .toe file.

---

## 6. End-to-end test

☐ Both relay AND TouchDesigner are connected (the controller UI's "Disconnected" pill should flip to "Connected" once the page is open and TD is live).

☐ Click each button on the controller. Watch TD — the matching action should fire.

☐ Drag the intensity slider — it should update smoothly without flooding (it's throttled to ~30 fps).

☐ Sign in to `/admin.html` as super admin → create an `operator` user → sign out → sign in as that operator → confirm the Admin link is hidden but the controller works.

☐ Kill the relay (or your wifi) for a few seconds. The status pill should switch to "Connecting…" and the UI should auto-recover when it comes back.

---

## Common gotchas

- **Login works but socket immediately closes with 401:** double-check `SUPABASE_JWT_SECRET` matches the value from Project Settings → API → JWT Secret.
- **TouchDesigner can't connect:** the `?token=...` value MUST be the exact `TD_SERVICE_KEY` set in the relay env. Spaces, line breaks, or quotes around it will break the match.
- **Admin APIs return 403:** the calling user is signed in but missing a row in `public.user_roles` with `role = 'super_admin'`.
- **CORS errors on /api/*:** make sure `PUBLIC_SITE_URL` exactly matches your Vercel URL (https, no trailing slash). For local dev with `vercel dev`, set it to `http://localhost:3000`.
- **Free Render instance sleeps:** the relay sleeps after 15 min of inactivity on Render's free tier. First request after sleep will take ~30s to wake. For production, upgrade to a paid instance.
