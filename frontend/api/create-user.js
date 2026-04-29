import { applyCors, adminClient, requireSuperAdmin } from './_lib.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    await requireSuperAdmin(req);
  } catch (err) {
    return res.status(err.statusCode || 401).send(err.message);
  }

  const { email, password, role } = req.body || {};
  if (!email || !password || !role) return res.status(400).send('Missing email, password, or role');
  if (!['operator', 'super_admin'].includes(role)) return res.status(400).send('Invalid role');
  if (String(password).length < 8) return res.status(400).send('Password must be at least 8 characters');

  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) return res.status(400).send(error.message);

  const { error: insertErr } = await admin
    .from('user_roles').insert({ id: data.user.id, role });
  if (insertErr) {
    // Roll back the Auth user so we don't leave an orphan.
    await admin.auth.admin.deleteUser(data.user.id);
    return res.status(500).send(`Role insert failed: ${insertErr.message}`);
  }

  return res.status(200).json({ id: data.user.id, email: data.user.email, role });
}
