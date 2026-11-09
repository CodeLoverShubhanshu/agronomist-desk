const { query, audit } = require('../../lib/db');
const { requireUser, send, readBody, hashPassword, publicUser, route } = require('../../lib/auth');

const cleanTarget = t => {
  if (!t || typeof t !== 'object') return null;
  const o = {}; ['calls', 'orders', 'revenue', 'pop'].forEach(k => { const n = Number(t[k]); if (n > 0) o[k] = Math.round(n) });
  return Object.keys(o).length ? o : null;
};

// GET list · POST create agronomist · PATCH {id, ...changes} or {id, action:'resetDesk'}
module.exports = route(async (req, res) => {
  const me = await requireUser(req, res, 'admin'); if (!me) return;
  if (req.method === 'GET') {
    const { rows } = await query(`SELECT * FROM users ORDER BY role, active DESC, name`);
    return send(res, 200, { users: rows.map(publicUser) });
  }
  const b = await readBody(req);
  if (req.method === 'POST') {
    const username = String(b.username || '').trim().toLowerCase(), name = String(b.name || '').trim(), pw = String(b.password || '');
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) return send(res, 400, { error: 'Username: 3–32 letters, numbers, dot, dash or underscore.' });
    if (!name) return send(res, 400, { error: 'Enter the agronomist’s name.' });
    if (pw.length < 8) return send(res, 400, { error: 'Password needs at least 8 characters.' });
    const ex = await query(`SELECT 1 FROM users WHERE username = $1`, [username]);
    if (ex.rows.length) return send(res, 409, { error: 'That username is taken.' });
    const { rows } = await query(
      `INSERT INTO users (username, name, role, pass_hash, hub, phone, target) VALUES ($1, $2, 'agronomist', $3, $4, $5, $6::jsonb) RETURNING *`,
      [username, name, await hashPassword(pw), String(b.hub || 'Lucknow hub').trim(), String(b.phone || '').trim(), JSON.stringify(cleanTarget(b.target))]);
    await query(`INSERT INTO desk_state (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [rows[0].id]);
    await audit(me.id, 'user_created', { id: rows[0].id, username });
    return send(res, 200, { user: publicUser(rows[0]) });
  }
  if (req.method === 'PATCH') {
    const id = Number(b.id);
    const { rows: found } = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    const u = found[0]; if (!u) return send(res, 404, { error: 'User not found.' });
    if (b.action === 'resetDesk') {
      if (u.role !== 'agronomist') return send(res, 400, { error: 'Only agronomist desks can be reset.' });
      // keep a full copy of the desk in the audit log before clearing it
      await query(`INSERT INTO audit_log (user_id, action, detail)
                   SELECT $2, 'desk_reset_backup', jsonb_build_object('agronomist', user_id, 'version', version, 'state', state, 'report', report) FROM desk_state WHERE user_id = $1`, [id, me.id]);
      await query(`UPDATE desk_state SET state = '{}'::jsonb, report = NULL, version = version + 1, updated_at = now() WHERE user_id = $1`, [id]);
      await audit(me.id, 'desk_reset', { id });
      return send(res, 200, { ok: true });
    }
    const sets = [], vals = [id];
    const put = (col, v, cast = '') => { vals.push(v); sets.push(`${col} = $${vals.length}${cast}`) };
    if (b.name !== undefined) { if (!String(b.name).trim()) return send(res, 400, { error: 'Name cannot be empty.' }); put('name', String(b.name).trim()) }
    if (b.hub !== undefined) put('hub', String(b.hub).trim());
    if (b.phone !== undefined) put('phone', String(b.phone).trim());
    if (b.target !== undefined) put('target', JSON.stringify(cleanTarget(b.target)), '::jsonb');
    if (b.active !== undefined) {
      if (u.id === me.id && !b.active) return send(res, 400, { error: 'You cannot switch off your own login.' });
      put('active', !!b.active); sets.push('session_ver = session_ver + 1');
    }
    if (b.password) {
      if (String(b.password).length < 8) return send(res, 400, { error: 'Password needs at least 8 characters.' });
      put('pass_hash', await hashPassword(b.password)); sets.push('session_ver = session_ver + 1', 'failed = 0', 'locked_until = NULL');
    }
    if (!sets.length) return send(res, 400, { error: 'Nothing to change.' });
    const { rows } = await query(`UPDATE users SET ${[...new Set(sets)].join(', ')} WHERE id = $1 RETURNING *`, vals);
    await audit(me.id, 'user_updated', { id, fields: Object.keys(b).filter(k => k !== 'password' && k !== 'id').concat(b.password ? ['password'] : []) });
    return send(res, 200, { user: publicUser(rows[0]) });
  }
  send(res, 405, { error: 'Method not allowed' });
});
