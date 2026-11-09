// Passwords (scrypt), signed session cookie, and request helpers shared by every API route.
const crypto = require('crypto');

const COOKIE = 'gd_sess';
const SESSION_DAYS = 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL) throw new Error('SESSION_SECRET is not set (use a long random string) in the Vercel project settings.');
  return 'local-dev-secret-change-me-please';
}

function hashPassword(pw) {
  return new Promise((ok, no) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(String(pw), salt, 64, (e, key) => e ? no(e) : ok('s1$' + salt.toString('base64') + '$' + key.toString('base64')));
  });
}
function checkPassword(pw, stored) {
  return new Promise(ok => {
    const [v, salt, key] = String(stored || '').split('$');
    if (v !== 's1' || !salt || !key) return ok(false);
    const want = Buffer.from(key, 'base64');
    crypto.scrypt(String(pw), Buffer.from(salt, 'base64'), want.length, (e, got) => ok(!e && crypto.timingSafeEqual(got, want)));
  });
}

const b64u = b => Buffer.from(b).toString('base64url');
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  return body + '.' + crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}
function verify(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.e > Date.now() ? p : null } catch (e) { return null }
}

function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()) });
  return out;
}
function isHttps(req) { return (req.headers['x-forwarded-proto'] || '').includes('https') || !!process.env.VERCEL }

function setSession(req, res, user) {
  const token = sign({ u: user.id, r: user.role, s: user.session_ver, e: Date.now() + SESSION_DAYS * 864e5 });
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isHttps(req) ? '; Secure' : ''}`);
}
function clearSession(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps(req) ? '; Secure' : ''}`);
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}') } catch (e) { return {} } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString() || '{}') } catch (e) { return {} } }
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch (e) { return {} }
}

const publicUser = u => u && ({ id: u.id, username: u.username, name: u.name, role: u.role, hub: u.hub, phone: u.phone, target: u.target, active: u.active,
  created_at: u.created_at, last_login_at: u.last_login_at });

// Returns the signed-in user, or sends 401/403 and returns null.
async function requireUser(req, res, role) {
  const { query } = require('./db');
  const p = verify(cookies(req)[COOKIE]);
  if (!p) { send(res, 401, { error: 'Please sign in.' }); return null }
  const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [p.u]);
  const u = rows[0];
  if (!u || !u.active || u.session_ver !== p.s) { clearSession(req, res); send(res, 401, { error: 'Your session has ended. Please sign in again.' }); return null }
  if (role && u.role !== role) { send(res, 403, { error: 'Not allowed for this login.' }); return null }
  return u;
}

// Wraps a route so unexpected errors come back as JSON, not a crash page.
const route = fn => async (req, res) => {
  try { await fn(req, res) } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: e && e.message && /DATABASE_URL|SESSION_SECRET/.test(e.message) ? e.message : 'Server error. Please try again.' });
  }
};

module.exports = { hashPassword, checkPassword, setSession, clearSession, send, readBody, requireUser, publicUser, route };
