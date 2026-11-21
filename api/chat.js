const { query } = require('../lib/db');
const { requireUser, send, readBody, route } = require('../lib/auth');

// Team chat: one group for every agronomist and the admin (public/chat.js is the client).
// GET  ?after=<id>&since=<iso> → {me, read, members, now, messages (newer than after; the latest 200 on first load), deleted (ids deleted since)}
// POST {body}  → send a message      POST {read: id} → mark read up to id      POST {del: id} → delete own message (admin: any)
const ONLINE_MS = 60 * 1000;
module.exports = route(async (req, res) => {
  const u = await requireUser(req, res); if (!u) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST') {
    const b = await readBody(req);
    if (b.read != null) { await query(`UPDATE users SET chat_read = GREATEST(chat_read, $2), last_seen = now() WHERE id = $1`, [u.id, Math.max(0, parseInt(b.read, 10) || 0)]); return send(res, 200, { ok: true }) }
    if (b.del != null) {
      const id = parseInt(b.del, 10) || 0;
      const { rows } = await query(`UPDATE chat_messages SET deleted = TRUE, deleted_at = now(), body = '' WHERE id = $1 AND NOT deleted AND ($2 OR user_id = $3) RETURNING id`, [id, u.role === 'admin', u.id]);
      if (!rows[0]) return send(res, 403, { error: 'You can delete only your own messages.' });
      return send(res, 200, { ok: true });
    }
    const body = String(b.body || '').replace(/\r/g, '').trim().slice(0, 2000);
    if (!body) return send(res, 400, { error: 'Type a message first.' });
    const { rows: n } = await query(`SELECT count(*)::int AS c FROM chat_messages WHERE user_id = $1 AND at > now() - interval '1 minute'`, [u.id]);
    if (n[0].c >= 20) return send(res, 429, { error: 'Too many messages in a minute. Wait a moment.' });
    const { rows } = await query(`INSERT INTO chat_messages (user_id, name, role, body) VALUES ($1, $2, $3, $4) RETURNING id, user_id, name, role, body, deleted, at`, [u.id, u.name, u.role, body]);
    await query(`UPDATE users SET chat_read = GREATEST(chat_read, $2), last_seen = now() WHERE id = $1`, [u.id, rows[0].id]);
    return send(res, 200, { message: rows[0] });
  }
  const sp = new URL(req.url, 'http://x').searchParams;
  const after = Math.max(0, parseInt(sp.get('after') || '0', 10) || 0), since = sp.get('since');
  await query(`UPDATE users SET last_seen = now() WHERE id = $1 AND (last_seen IS NULL OR last_seen < now() - interval '50 seconds')`, [u.id]);
  const cols = `id, user_id, name, role, CASE WHEN deleted THEN '' ELSE body END AS body, deleted, at`;
  const { rows: messages } = after
    ? await query(`SELECT ${cols} FROM chat_messages WHERE id > $1 ORDER BY id LIMIT 200`, [after])
    : await query(`SELECT * FROM (SELECT ${cols} FROM chat_messages ORDER BY id DESC LIMIT 200) x ORDER BY id`);
  const { rows: del } = since && !isNaN(Date.parse(since)) ? await query(`SELECT id FROM chat_messages WHERE deleted AND deleted_at > $1`, [since]) : { rows: [] };
  const { rows: mem } = await query(`SELECT id, name, role, last_seen, chat_read FROM users WHERE active ORDER BY role, name`);
  const now = Date.now(), me = mem.find(m => m.id === u.id) || {};
  send(res, 200, {
    me: { id: u.id, name: u.name, role: u.role }, read: Number(me.chat_read || 0), now: new Date(now).toISOString(),
    members: mem.map(m => ({ id: m.id, name: m.name, role: m.role, last_seen: m.last_seen, online: !!m.last_seen && now - new Date(m.last_seen).getTime() < ONLINE_MS })),
    messages, deleted: del.map(r => Number(r.id)),
  });
});
