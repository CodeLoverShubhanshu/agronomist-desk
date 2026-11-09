const { query, audit } = require('../lib/db');
const { requireUser, send, readBody, publicUser, route } = require('../lib/auth');

// GET  /api/state            → my desk (agronomist)
// GET  /api/state?user=ID    → one agronomist's desk, read-only (admin)
// PUT  /api/state {state, report, version} → save my desk; 409 if it changed elsewhere since `version`
module.exports = route(async (req, res) => {
  const me = await requireUser(req, res); if (!me) return;
  if (req.method === 'GET') {
    let uid = me.id, owner = me;
    const asId = new URL(req.url, 'http://x').searchParams.get('user');
    if (asId) {
      if (me.role !== 'admin') return send(res, 403, { error: 'Only the admin can open another desk.' });
      const { rows } = await query(`SELECT * FROM users WHERE id = $1 AND role = 'agronomist'`, [Number(asId)]);
      if (!rows[0]) return send(res, 404, { error: 'Agronomist not found.' });
      owner = rows[0]; uid = owner.id;
    } else if (me.role !== 'agronomist') return send(res, 400, { error: 'Admin has no desk of its own. Open an agronomist desk from the admin page.' });
    await query(`INSERT INTO desk_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [uid]);
    const { rows } = await query(`SELECT state, version, updated_at FROM desk_state WHERE user_id = $1`, [uid]);
    return send(res, 200, { state: rows[0].state || {}, version: rows[0].version, updated_at: rows[0].updated_at, owner: publicUser(owner), readOnly: owner.id !== me.id, viewer: publicUser(me) });
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    if (me.role !== 'agronomist') return send(res, 403, { error: 'Read-only view: changes are not saved.' });
    const b = await readBody(req);
    if (!b.state || typeof b.state !== 'object' || Array.isArray(b.state)) return send(res, 400, { error: 'Nothing to save.' });
    const st = JSON.stringify(b.state), rp = b.report && typeof b.report === 'object' ? JSON.stringify(b.report) : null;
    const force = b.force === true;
    const { rows } = await query(
      `UPDATE desk_state SET state = $2::jsonb, report = COALESCE($3::jsonb, report), version = version + 1, updated_at = now()
       WHERE user_id = $1 AND ($5 OR version = $4) RETURNING version, updated_at`,
      [me.id, st, rp, Number(b.version) || 0, force]);
    if (!rows[0]) {
      const cur = await query(`SELECT state, version, updated_at FROM desk_state WHERE user_id = $1`, [me.id]);
      if (!cur.rows[0]) {
        const ins = await query(`INSERT INTO desk_state (user_id, state, report, version) VALUES ($1, $2::jsonb, $3::jsonb, 1) RETURNING version, updated_at`, [me.id, st, rp]);
        return send(res, 200, ins.rows[0]);
      }
      return send(res, 409, { error: 'This desk was changed in another tab or device.', version: cur.rows[0].version, updated_at: cur.rows[0].updated_at });
    }
    // one backup copy per agronomist per day (the last save of that day)
    query(`INSERT INTO desk_snapshots (user_id, day, state, report, version) VALUES ($1, (now() AT TIME ZONE 'Asia/Kolkata')::date, $2::jsonb, $3::jsonb, $4)
           ON CONFLICT (user_id, day) DO UPDATE SET state = EXCLUDED.state, report = COALESCE(EXCLUDED.report, desk_snapshots.report), version = EXCLUDED.version, saved_at = now()`,
      [me.id, st, rp, rows[0].version]).catch(e => console.error('snapshot', e.message));
    if (force) audit(me.id, 'save_forced', { version: rows[0].version });
    return send(res, 200, rows[0]);
  }
  send(res, 405, { error: 'Method not allowed' });
});
