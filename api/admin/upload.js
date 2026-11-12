const { query, audit } = require('../../lib/db');
const { requireUser, send, readBody, route } = require('../../lib/auth');

// POST /api/admin/upload {user, upload} → adds one call list to an agronomist's desk.
// The list is appended to that desk's saved uploads on the server, so nothing else in the desk is overwritten.
module.exports = route(async (req, res) => {
  const me = await requireUser(req, res, 'admin'); if (!me) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const b = await readBody(req), uid = Number(b.user), u = b.upload;
  const { rows: who } = await query(`SELECT id, name FROM users WHERE id = $1 AND role = 'agronomist'`, [uid]);
  if (!who[0]) return send(res, 404, { error: 'Agronomist not found.' });
  if (!u || typeof u !== 'object' || !u.id || !Array.isArray(u.rows) || !Array.isArray(u.farmers) || !u.rows.length)
    return send(res, 400, { error: 'This call list has no farmers to add.' });
  if (u.rows.length > 5000) return send(res, 400, { error: 'This list is too long (more than 5000 rows). Split it into smaller files.' });
  const entry = { id: String(u.id), name: String(u.name || 'Call list'), at: new Date().toISOString(), rows: u.rows, farmers: u.farmers,
    counts: u.counts && typeof u.counts === 'object' ? u.counts : {}, by: { id: me.id, name: me.name, role: 'admin' } };
  await query(`INSERT INTO desk_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [uid]);
  const { rows } = await query(
    `UPDATE desk_state SET
       state = jsonb_set(CASE WHEN jsonb_typeof(state) = 'object' THEN state ELSE '{}'::jsonb END, '{uploads}',
         (CASE WHEN jsonb_typeof(state->'uploads') = 'array' THEN state->'uploads' ELSE '[]'::jsonb END) || jsonb_build_array($2::jsonb)),
       version = version + 1, updated_at = now()
     WHERE user_id = $1 RETURNING version, updated_at`, [uid, JSON.stringify(entry)]);
  await audit(me.id, 'admin_upload', { user: uid, list: entry.name, farmers: entry.rows.length });
  send(res, 200, { version: rows[0].version, updated_at: rows[0].updated_at, added: entry.rows.length, owner: who[0].name });
});
