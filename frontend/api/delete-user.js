import { applyCors, adminClient, requireSuperAdmin } from './_lib.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  let caller;
  try {
    caller = await requireSuperAdmin(req);
  } catch (err) {
    return res.status(err.statusCode || 401).send(err.message);
  }

  const { id } = req.body || {};
  if (!id) return res.status(400).send('Missing id');
  if (id === caller.id) return res.status(400).send('You cannot delete yourself');

  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return res.status(400).send(error.message);
  // user_roles row deletes via ON DELETE CASCADE.
  return res.status(200).json({ ok: true });
}
