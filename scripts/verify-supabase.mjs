// One-shot Supabase setup verifier.
// Usage:
//   cd my-secure-td-controller
//   npm install --prefix scripts @supabase/supabase-js
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=eyJhbGciOi... \
//   ADMIN_EMAIL=you@example.com \
//   ADMIN_PASSWORD=yourSeedPassword \
//   node scripts/verify-supabase.mjs

import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

const missing = ['SUPABASE_URL','SUPABASE_ANON_KEY','ADMIN_EMAIL','ADMIN_PASSWORD']
  .filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing env vars:', missing.join(', '));
  process.exit(1);
}

const ok = (msg) => console.log('  \x1b[32m✓\x1b[0m', msg);
const bad = (msg) => { console.error('  \x1b[31m✗\x1b[0m', msg); process.exitCode = 1; };
const step = (msg) => console.log('\n' + msg);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

step('1. Connectivity & anon key');
try {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  if (!r.ok) bad(`auth settings endpoint returned ${r.status}`);
  else {
    const s = await r.json();
    ok('Supabase reachable, anon key accepted');
    if (s.disable_signup === false) bad('Public sign-up is still ENABLED — turn it off in Auth → Configuration');
    else ok('Public sign-up is disabled');
    if (s.mailer_autoconfirm === false) bad('"Confirm email" is still ON — operators will get stuck on email confirmation');
    else ok('Email confirmation is disabled (operators can sign in immediately)');
  }
} catch (e) { bad(`cannot reach ${SUPABASE_URL}: ${e.message}`); }

step('2. Sign in as seed super admin');
const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
  email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
});
if (signErr) {
  bad(`sign-in failed: ${signErr.message}`);
  console.error('\n  → fix this before continuing. Check email/password in Auth → Users.');
  process.exit(1);
}
ok(`signed in as ${signIn.user.email} (uid=${signIn.user.id})`);

step('3. user_roles table exists and is readable');
const { data: row, error: rErr } = await supabase
  .from('user_roles').select('role').eq('id', signIn.user.id).maybeSingle();
if (rErr) {
  bad(`user_roles query failed: ${rErr.message}`);
  console.error('  → run SUPABASE_SCHEMA.sql in the Supabase SQL editor');
} else {
  ok('user_roles table is queryable via RLS');
}

step('4. Seed user has super_admin role');
if (!row) {
  bad('no row in user_roles for this user');
  console.error(`  → run:  insert into public.user_roles (id, role) values ('${signIn.user.id}', 'super_admin');`);
} else if (row.role !== 'super_admin') {
  bad(`role is "${row.role}", expected "super_admin"`);
  console.error(`  → run:  update public.user_roles set role = 'super_admin' where id = '${signIn.user.id}';`);
} else {
  ok('role = super_admin');
}

step('5. JWT issued');
if (signIn.session?.access_token) ok('access_token present (this is what the relay will verify)');
else bad('no access_token returned');

await supabase.auth.signOut();
console.log('\n' + (process.exitCode ? '\x1b[31mFAILED\x1b[0m — fix the items above' : '\x1b[32mAll checks passed.\x1b[0m Supabase is good to go.'));
