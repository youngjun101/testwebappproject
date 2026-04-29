import { applyCors, adminClient, requireSuperAdmin } from './_lib.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    await requireSuperAdmin(req);
  } catch (err) {
    return res.status(err.statusCode || 401).send(err.message);
  }

  const admin = adminClient();
  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return res.status(500).send(error.message);

  const { data: roles, error: rErr } = await admin.from('user_roles').select('id, role');
  if (rErr) return res.status(500).send(rErr.message);

  const roleMap = Object.fromEntries((roles || []).map(r => [r.id, r.role]));
  const users = list.users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    role: roleMap[u.id] || null,
  }));
  return res.status(200).json({ users });
}
