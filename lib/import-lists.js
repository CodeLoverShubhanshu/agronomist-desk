// One-time import of call lists prepared by the admin, added to each agronomist's desk by name.
// The lists are stored encrypted (lib/pending-lists.enc) because this repository is public; the key is the
// LIST_IMPORT_KEY setting in Vercel. Each list is added only once (table list_imports). A list whose agronomist
// has no login yet waits and is added on a later start, after the login is created.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');

const nameKey = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

function readLists() {
  const key = process.env.LIST_IMPORT_KEY, file = path.join(__dirname, 'pending-lists.enc');
  if (!key || !fs.existsSync(file)) return [];
  const buf = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(buf.subarray(28)), d.final()])).toString('utf8'));
}

async function importLists(db) {
  let lists; try { lists = readLists() } catch (e) { console.error('list import: could not read the lists', e.message); return }
  if (!lists.length) return;
  await db.exec(`CREATE TABLE IF NOT EXISTS list_imports (id TEXT PRIMARY KEY, user_id INTEGER, farmers INTEGER, at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const { rows: users } = await db.query(`SELECT id, name, username FROM users WHERE role = 'agronomist'`);
  for (const { agronomist, entry } of lists) {
    const k = nameKey(agronomist), u = users.find(x => nameKey(x.name) === k) || users.find(x => nameKey(x.username) === k);
    const done = await db.query(`SELECT 1 FROM list_imports WHERE id = $1`, [entry.id]);
    if (done.rows.length) continue;
    if (!u) { console.log(`list import: waiting, no agronomist login named "${agronomist}" (${entry.name})`); continue }
    const claim = await db.query(`INSERT INTO list_imports (id, user_id, farmers) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING id`, [entry.id, u.id, entry.rows.length]);
    if (!claim.rows.length) continue; // another server instance is adding it
    try {
      await db.query(`INSERT INTO desk_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [u.id]);
      const cur = await db.query(`SELECT state FROM desk_state WHERE user_id = $1`, [u.id]);
      const st = cur.rows[0] && cur.rows[0].state, have = new Map();
      ((st && Array.isArray(st.uploads)) ? st.uploads : []).forEach(x => (x.farmers || []).forEach(f => { const p = String(f.phone || '').replace(/\D/g, '').slice(-10); if (p && !have.has(p)) have.set(p, f.id) }));
      // farmers already on this desk are called again from their existing profile, not added twice
      const farmers = [], rows = [];
      entry.rows.forEach(r => { const f = entry.farmers.find(x => x.id === r.fid), old = f && have.get(f.phone);
        if (old) rows.push(Object.assign({}, r, { fid: old, type: 'mine' })); else { if (f) farmers.push(f); rows.push(r) } });
      const e = Object.assign({}, entry, { at: new Date().toISOString(), rows, farmers, counts: Object.assign({}, entry.counts, { mine: rows.filter(r => r.type === 'mine').length, new: farmers.length }), by: { name: 'Admin', role: 'admin' } });
      await db.query(
        `UPDATE desk_state SET state = jsonb_set(CASE WHEN jsonb_typeof(state) = 'object' THEN state ELSE '{}'::jsonb END, '{uploads}',
           (CASE WHEN jsonb_typeof(state->'uploads') = 'array' THEN state->'uploads' ELSE '[]'::jsonb END) || jsonb_build_array($2::jsonb)),
           version = version + 1, updated_at = now() WHERE user_id = $1`, [u.id, JSON.stringify(e)]);
      await db.query(`INSERT INTO audit_log (user_id, action, detail) VALUES (NULL, 'admin_upload', $1::jsonb)`, [JSON.stringify({ user: u.id, list: e.name, farmers: rows.length, imported: true })]);
      console.log(`list import: added ${e.name} → ${u.name} (${rows.length} farmers, ${e.counts.mine} already on the desk)`);
    } catch (err) {
      await db.query(`DELETE FROM list_imports WHERE id = $1`, [entry.id]).catch(() => {});
      console.error('list import failed', entry.name, err.message);
    }
  }
}
module.exports = { importLists };
