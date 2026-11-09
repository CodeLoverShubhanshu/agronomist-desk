const { query } = require('../../lib/db');
const { requireUser, send, publicUser, route } = require('../../lib/auth');

// Every agronomist with the report their desk last saved (calls, orders, farmers, lists, queue).
module.exports = route(async (req, res) => {
  const me = await requireUser(req, res, 'admin'); if (!me) return;
  const { rows } = await query(
    `SELECT u.*, s.report, s.version, s.updated_at AS saved_at
     FROM users u LEFT JOIN desk_state s ON s.user_id = u.id
     WHERE u.role = 'agronomist' ORDER BY u.active DESC, u.name`);
  const logins = await query(`SELECT a.at, a.action, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.action IN ('login','login_failed') ORDER BY a.at DESC LIMIT 40`);
  send(res, 200, {
    me: publicUser(me), now: new Date().toISOString(),
    agronomists: rows.map(r => Object.assign(publicUser(r), { report: r.report || null, version: r.version || 0, saved_at: r.saved_at })),
    logins: logins.rows,
  });
});
