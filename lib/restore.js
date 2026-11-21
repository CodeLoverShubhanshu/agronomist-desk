// One-time restore of every agronomist desk from the backup taken on 20 Nov 2026, 5:31 PM IST
// (the old database ran out of its free quota). The backup is stored encrypted (lib/restore-backup.enc)
// because this repository is public; the key is the RESTORE_KEY setting in Vercel.
// Each desk is restored once (table restore_done), and only into a desk that is still empty.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');

function readBackup() {
  const key = process.env.RESTORE_KEY, file = path.join(__dirname, 'restore-backup.enc');
  if (!key || !fs.existsSync(file)) return null;
  const buf = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(buf.subarray(28)), d.final()])).toString('utf8'));
}

const addDays = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) };
const PRI = {high: 'high', medium: 'med', med: 'med', low: 'low'};

// Rebuilds the desk's saved state from one agronomist's backup report.
function buildState(a) {
  const fm = new Map(a.farmers.map(f => [f.id, f])), placed = new Set();
  const rec = f => { const c = (f.cropsD && f.cropsD[0]) || {};
    return {id: f.id, name: f.name || 'Farmer', phone: f.phone || '', village: f.village && f.village !== '–' ? f.village : '', district: f.district || '', pin: f.pin || '',
      crop: c.crop || null, variety: c.variety || null, sow: c.sow || null, acres: c.acres || f.acres || null, state: 'Uttar Pradesh', orders: 0, value: 0, bought: [], lensPop: [],
      sample: false, uploaded: true, list: f.list || '', source: f.listSrc || ''} };
  const ups = [...a.uploads].sort((x, y) => String(x.at).localeCompare(String(y.at)));
  const uploads = ups.map(u => { const farmers = [], rows = [];
    (u.fids || []).forEach(fid => { const f = fm.get(fid); let type = 'mine';
      if (f && !placed.has(fid)) { placed.add(fid); farmers.push(rec(f)); type = 'new' }
      const p = String((f && f.pri) || '').trim(), k = PRI[p.toLowerCase()];
      rows.push(Object.assign({fid, reason: '', pri: k || 'med', type}, p && !k ? {priTxt: p} : {})) });
    return Object.assign({id: u.id, name: u.name, at: u.at, source: u.source || '', rows, farmers, counts: u.counts || {}},
      u.removed ? {removed: true} : {}, u.by === 'admin' ? {by: {name: 'Admin', role: 'admin'}} : {}) });
  const rest = a.farmers.filter(f => !placed.has(f.id));
  if (rest.length) uploads.unshift({id: 'Urestored', name: 'Farmers added on the desk', at: '2026-11-01T00:00:00.000Z', source: '', rows: [], farmers: rest.map(rec), counts: {mine: 0, lens: 0, new: rest.length, skip: 0}});
  const log = a.calls.filter(c => c.f && c.d).map(c => Object.assign({d: c.d, at: c.at || '', hr: c.hr, ch: c.ch, out: c.out, topic: c.topic || '', note: c.note || '', f: c.f, by: 'Agronomist'}, c.sec ? {sec: c.sec} : {}));
  const newOrders = a.orders.map(o => Object.assign({id: o.id, f: o.f, date: o.date, status: o.status, store: o.store, disc: 0, urgent: !!o.urgent, approval: false, fromCall: !!o.fromCall,
    items: (o.items || []).map(x => [x[0], x[1], x[1] ? Math.round((x[2] || 0) / x[1] * 100) / 100 : 0])}, o.sec ? {sec: o.sec} : {}));
  const newFup = a.followups.map((x, i) => ({id: 'R' + i, f: x.f, due: x.due, time: x.time || '', why: x.why || 'Call back', by: 'Agronomist'}));
  // undecided / not interested: from each farmer's latest call
  const last = new Map(); log.forEach(l => { if (l.ch !== 'Note') last.set(l.f, l) });
  const undecided = [];
  last.forEach(l => { if (l.out === 'Not interested') undecided.push({f: l.f, at: l.d, back: null, ni: true, note: l.note});
    else if (l.out === 'Undecided') undecided.push({f: l.f, at: l.d, back: addDays(l.d, 7), note: l.note}) });
  return {uploads, log, newOrders, newFup, undecided, prof: a.prof || {}, crops: a.cropRecs || {}, restoredFrom: '2026-11-20T12:01:09Z'};
}

async function restoreDesks(db, listIds) {
  let bk; try { bk = readBackup() } catch (e) { console.error('restore: could not read the backup', e.message); return }
  if (!bk) return;
  await db.exec(`CREATE TABLE IF NOT EXISTS restore_done (username TEXT PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  // the call lists that were already imported into the old database are inside the backup: do not add them a second time
  await db.exec(`CREATE TABLE IF NOT EXISTS list_imports (id TEXT PRIMARY KEY, user_id INTEGER, farmers INTEGER, at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const have = new Set(bk.agronomists.flatMap(a => a.uploads.map(u => u.id)));
  for (const id of listIds || []) if (have.has(id)) await db.query(`INSERT INTO list_imports (id, farmers) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [id]);
  for (const a of bk.agronomists) {
    const done = await db.query(`SELECT 1 FROM restore_done WHERE username = $1`, [a.username]);
    if (done.rows.length) continue;
    let u = (await db.query(`SELECT id FROM users WHERE username = $1 AND role = 'agronomist'`, [a.username])).rows[0];
    if (!u && process.env.RESTORE_PASSWORD) { // a login made on the admin page (not in AGRONOMIST_LOGINS): made again with the restore password
      const { hashPassword } = require('./auth');
      u = (await db.query(`INSERT INTO users (username, name, role, pass_hash, hub, phone, target, active) VALUES ($1, $2, 'agronomist', $3, $4, $5, $6::jsonb, $7) ON CONFLICT (username) DO NOTHING RETURNING id`,
        [a.username, a.name, await hashPassword(process.env.RESTORE_PASSWORD), a.hub || 'Lucknow hub', a.phone || '', a.target ? JSON.stringify(a.target) : null, a.active !== false])).rows[0]
        || (await db.query(`SELECT id FROM users WHERE username = $1`, [a.username])).rows[0];
    }
    if (!u) { console.log('restore: waiting, no login "' + a.username + '" yet'); continue }
    const claim = await db.query(`INSERT INTO restore_done (username) VALUES ($1) ON CONFLICT DO NOTHING RETURNING username`, [a.username]);
    if (!claim.rows.length) continue; // another server instance is restoring it
    try {
      await db.query(`INSERT INTO desk_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [u.id]);
      const cur = (await db.query(`SELECT state FROM desk_state WHERE user_id = $1`, [u.id])).rows[0];
      const st = cur && cur.state, used = st && ((Array.isArray(st.log) && st.log.length) || (Array.isArray(st.uploads) && st.uploads.some(x => !x.by || x.by.role !== 'admin')));
      if (used) { console.log('restore: skipped ' + a.username + ', desk already has work'); continue }
      const state = buildState(a);
      if (st && Array.isArray(st.uploads)) st.uploads.forEach(x => { if (!state.uploads.some(y => y.id === x.id)) state.uploads.push(x) }); // lists added since
      const report = {v: 1, at: bk.at, restored: true, farmers: a.farmers, calls: a.calls, orders: a.orders, uploads: a.uploads, followups: a.followups};
      await db.query(`UPDATE desk_state SET state = $2::jsonb, report = $3::jsonb, version = version + 1, updated_at = now() WHERE user_id = $1`, [u.id, JSON.stringify(state), JSON.stringify(report)]);
      await db.query(`INSERT INTO audit_log (user_id, action, detail) VALUES (NULL, 'restore', $1::jsonb)`, [JSON.stringify({user: u.id, farmers: a.farmers.length, calls: a.calls.length, orders: a.orders.length})]);
      console.log(`restore: ${a.username} ← ${a.farmers.length} farmers, ${a.calls.length} calls, ${a.orders.length} orders`);
    } catch (e) {
      await db.query(`DELETE FROM restore_done WHERE username = $1`, [a.username]).catch(() => {});
      console.error('restore failed', a.username, e.message);
    }
  }
}
module.exports = { restoreDesks, buildState };
