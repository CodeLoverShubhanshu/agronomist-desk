const { query, audit } = require('../lib/db');
const { checkPassword, setSession, send, readBody, publicUser, route } = require('../lib/auth');

module.exports = route(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  const b = await readBody(req);
  const username = String(b.username || '').trim().toLowerCase(), password = String(b.password || '');
  if (!username || !password) return send(res, 400, { error: 'Enter your username and password.' });
  const { rows } = await query(`SELECT * FROM users WHERE username = $1`, [username]);
  const u = rows[0];
  if (u && u.locked_until && new Date(u.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(u.locked_until) - Date.now()) / 60000);
    return send(res, 429, { error: `Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` });
  }
  const ok = u && await checkPassword(password, u.pass_hash);
  if (!ok) {
    if (u) {
      const fails = u.failed + 1;
      await query(`UPDATE users SET failed = $2, locked_until = $3 WHERE id = $1`, [u.id, fails >= 8 ? 0 : fails, fails >= 8 ? new Date(Date.now() + 10 * 60000) : null]);
      await audit(u.id, 'login_failed', {});
    }
    return send(res, 401, { error: 'Wrong username or password.' });
  }
  if (!u.active) return send(res, 403, { error: 'This login is switched off. Ask your admin.' });
  const { rows: r2 } = await query(`UPDATE users SET failed = 0, locked_until = NULL, last_login_at = now() WHERE id = $1 RETURNING *`, [u.id]);
  setSession(req, res, r2[0]);
  await audit(u.id, 'login', { ua: String(req.headers['user-agent'] || '').slice(0, 160) });
  send(res, 200, { user: publicUser(r2[0]), go: u.role === 'admin' ? '/admin' : '/desk' });
});
