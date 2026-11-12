// Database access. On Vercel this uses Postgres (Neon / Vercel Postgres / Supabase) from DATABASE_URL.
// On your own computer, when DATABASE_URL is not set, it uses PGlite: a real Postgres stored in ./.data/pglite.
const path = require('path');

let implPromise = null;
let readyPromise = null;

function dbUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
}

async function makeImpl() {
  const url = dbUrl();
  if (url) {
    const { Pool } = require('pg');
    const u = new URL(url);
    const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname) || u.searchParams.get('sslmode') === 'disable';
    u.searchParams.delete('sslmode');
    u.searchParams.delete('channel_binding');
    const pool = new Pool({
      connectionString: u.toString(),
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 10000,
      ssl: local ? false : { rejectUnauthorized: process.env.PGSSL_NO_VERIFY ? false : true },
    });
    pool.on('error', e => console.error('pg pool error', e.message));
    return { kind: 'postgres', query: (t, p) => pool.query(t, p), exec: t => pool.query(t) };
  }
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is not set. Add a Postgres database (Neon) to this Vercel project and redeploy.');
  }
  const mod = '@electric-sql/pglite'; // kept in a variable so Vercel does not bundle it
  const { PGlite } = await import(mod);
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), '.data', 'pglite');
  require('fs').mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return { kind: 'pglite', query: (t, p) => db.query(t, p), exec: t => db.exec(t) };
}

function impl() { return implPromise || (implPromise = makeImpl().catch(e => { implPromise = null; throw e })) }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','agronomist')),
  pass_hash     TEXT NOT NULL,
  hub           TEXT NOT NULL DEFAULT 'Lucknow hub',
  phone         TEXT NOT NULL DEFAULT '',
  target        JSONB,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  session_ver   INTEGER NOT NULL DEFAULT 1,
  failed        INTEGER NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS desk_state (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state      JSONB NOT NULL DEFAULT '{}'::jsonb,
  report     JSONB,
  version    INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS desk_snapshots (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      DATE NOT NULL,
  state    JSONB NOT NULL,
  report   JSONB,
  version  INTEGER NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id      BIGSERIAL PRIMARY KEY,
  user_id INTEGER,
  action  TEXT NOT NULL,
  detail  JSONB,
  at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_at ON audit_log (at DESC);
`;

// Read-only SQL views over each desk's report, so the data can be queried or exported with plain SQL.
const VIEWS = [
  `CREATE OR REPLACE VIEW v_calls AS
   SELECT u.id AS agronomist_id, u.name AS agronomist, (c->>'d') AS day, c->>'at' AS at_time, c->>'ch' AS channel,
          c->>'out' AS outcome, c->>'topic' AS topic, c->>'note' AS note, c->>'f' AS farmer_id, c->>'name' AS farmer, c->>'phone' AS phone
   FROM desk_state s JOIN users u ON u.id = s.user_id
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.report->'calls', '[]'::jsonb)) c`,
  `CREATE OR REPLACE VIEW v_orders AS
   SELECT u.id AS agronomist_id, u.name AS agronomist, o->>'id' AS order_id, (o->>'date') AS day, o->>'status' AS status,
          o->>'f' AS farmer_id, o->>'name' AS farmer, o->>'phone' AS phone, (o->>'value')::numeric AS value, o->'items' AS items
   FROM desk_state s JOIN users u ON u.id = s.user_id
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.report->'orders', '[]'::jsonb)) o`,
  `CREATE OR REPLACE VIEW v_farmers AS
   SELECT u.id AS agronomist_id, u.name AS agronomist, f->>'id' AS farmer_id, f->>'name' AS farmer, f->>'phone' AS phone,
          f->>'village' AS village, f->>'district' AS district, f->>'crop' AS crop, f->>'variety' AS variety,
          f->>'stage' AS stage, (f->>'pop')::boolean AS pop_ready
   FROM desk_state s JOIN users u ON u.id = s.user_id
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.report->'farmers', '[]'::jsonb)) f`,
];

async function init() {
  const db = await impl();
  await db.exec(SCHEMA);
  for (const v of VIEWS) { try { await db.exec(v) } catch (e) { /* another instance created it at the same moment */ } }
  // First admin comes from environment variables (or a local default on your own computer).
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`);
  if (!rows[0].n) {
    let u = process.env.ADMIN_USERNAME, p = process.env.ADMIN_PASSWORD;
    if ((!u || !p) && !process.env.VERCEL) { u = u || 'admin'; p = p || 'admin@123'; console.log(`\n  Local admin created → username: ${u}  password: ${p}\n`) }
    if (u && p) {
      const { hashPassword } = require('./auth');
      await db.query(
        `INSERT INTO users (username, name, role, pass_hash) VALUES ($1, $2, 'admin', $3) ON CONFLICT (username) DO NOTHING`,
        [u.trim().toLowerCase(), process.env.ADMIN_NAME || 'Admin', await hashPassword(p)]);
    }
  }
  await seedAgronomists(db);
  try { await require('./import-lists').importLists(db) } catch (e) { console.error('list import', e.message) }
  return db;
}

// AGRONOMIST_LOGINS = "username|Full name|password;username|Full name|password"
// Creates any of these logins that do not exist yet. Existing logins (and passwords changed later) are never touched.
async function seedAgronomists(db) {
  const raw = process.env.AGRONOMIST_LOGINS || '';
  const list = raw.split(';').map(s => s.split('|').map(x => x.trim())).filter(x => x.length >= 3 && x[0] && x[2]);
  if (!list.length) return;
  const { rows } = await db.query(`SELECT username FROM users`);
  const have = new Set(rows.map(r => r.username));
  const { hashPassword } = require('./auth');
  for (const [u, name, pw, hub] of list) {
    const username = u.toLowerCase();
    if (have.has(username)) continue;
    try {
      const r = await db.query(
        `INSERT INTO users (username, name, role, pass_hash, hub) VALUES ($1, $2, 'agronomist', $3, $4) ON CONFLICT (username) DO NOTHING RETURNING id`,
        [username, name || username, await hashPassword(pw), hub || 'Lucknow hub']);
      if (r.rows[0]) await db.query(`INSERT INTO desk_state (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [r.rows[0].id]);
    } catch (e) { console.error('seed login', username, e.message) }
  }
}

async function ready() { return readyPromise || (readyPromise = init().catch(e => { readyPromise = null; throw e })) }

async function query(text, params) { const db = await ready(); return db.query(text, params) }

async function audit(userId, action, detail) {
  try { await query(`INSERT INTO audit_log (user_id, action, detail) VALUES ($1, $2, $3::jsonb)`, [userId || null, action, JSON.stringify(detail || {})]) } catch (e) {}
}

module.exports = { query, ready, audit };
