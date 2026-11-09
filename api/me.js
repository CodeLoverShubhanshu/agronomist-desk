const { query } = require('../lib/db');
const { requireUser, send, readBody, hashPassword, checkPassword, setSession, publicUser, route } = require('../lib/auth');

// GET: who is signed in. POST {current, next}: change my own password.
module.exports = route(async (req, res) => {
  const u = await requireUser(req, res); if (!u) return;
  if (req.method === 'POST') {
    const b = await readBody(req);
    if (!(await checkPassword(b.current || '', u.pass_hash))) return send(res, 400, { error: 'Current password is wrong.' });
    if (String(b.next || '').length < 8) return send(res, 400, { error: 'New password needs at least 8 characters.' });
    const { rows } = await query(`UPDATE users SET pass_hash = $2, session_ver = session_ver + 1 WHERE id = $1 RETURNING *`, [u.id, await hashPassword(b.next)]);
    setSession(req, res, rows[0]);
    return send(res, 200, { ok: true });
  }
  send(res, 200, { user: publicUser(u) });
});
