const crypto = require('crypto');
const { query } = require('../../lib/db');
const { requireUser, send, route, publicUser } = require('../../lib/auth');

// Read-only export of every agronomist's orders, calls and farmers as JSON.
// Signed-in admin, or ?key=<EXPORT_KEY> when that environment variable is set (for pulling data from outside the browser).
module.exports = route(async (req, res) => {
  const url = new URL(req.url, 'http://x'), key = url.searchParams.get('key') || '', want = process.env.EXPORT_KEY || '';
  const keyOk = want.length >= 24 && key.length === want.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(want));
  if (!keyOk) { const me = await requireUser(req, res, 'admin'); if (!me) return }
  const { rows } = await query(
    `SELECT u.*, s.report, s.updated_at AS saved_at, s.state->'prof' AS prof, s.state->'crops' AS crops
     FROM users u LEFT JOIN desk_state s ON s.user_id = u.id WHERE u.role = 'agronomist' ORDER BY u.name`);
  res.setHeader('Cache-Control', 'no-store');
  send(res, 200, { at: new Date().toISOString(), agronomists: rows.map(r => Object.assign(publicUser(r), {
    saved_at: r.saved_at, orders: (r.report && r.report.orders) || [], farmers: (r.report && r.report.farmers) || [], calls: (r.report && r.report.calls) || [], uploads: (r.report && r.report.uploads) || [], followups: (r.report && r.report.followups) || [], prof: r.prof || {}, cropRecs: r.crops || {} })) });
});
