// Shared helpers for Vercel serverless functions.
import { createClient } from '@supabase/supabase-js';

const allowedOrigin = process.env.PUBLIC_SITE_URL || ''; // e.g. https://my-app.vercel.app

export function applyCors(req, res) {
  const origin = req.headers.origin || '';
  if (allowedOrigin && origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// Build an admin client (full privileges — server-side only).
export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Verify the caller's JWT and confirm they are super_admin.
// Returns the user object or throws.
export async function requireSuperAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { const e = new Error('Missing bearer token'); e.statusCode = 401; throw e; }

  // Verify the JWT by asking Supabase who it belongs to.
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) { const e = new Error('Invalid token'); e.statusCode = 401; throw e; }

  // Confirm role.
  const admin = adminClient();
  const { data: row, error: rErr } = await admin
    .from('user_roles').select('role').eq('id', user.id).maybeSingle();
  if (rErr) { const e = new Error('Role lookup failed'); e.statusCode = 500; throw e; }
  if (!row || row.role !== 'super_admin') {
    const e = new Error('Forbidden — super_admin only'); e.statusCode = 403; throw e;
  }
  return user;
}
