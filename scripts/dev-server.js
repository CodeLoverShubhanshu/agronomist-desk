// Run the desk on your own computer: `npm run dev` → http://localhost:3000
// Uses the same /api files as Vercel. Without DATABASE_URL the data is kept in ./.data/pglite (a local Postgres).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
try { fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }) } catch (e) {}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.csv': 'text/csv' };
const PORT = Number(process.env.PORT || 3000);

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (p.startsWith('/api/')) {
    const file = path.join(ROOT, p.replace(/\/$/, '') + '.js');
    if (!file.startsWith(path.join(ROOT, 'api')) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('{"error":"Not found"}') }
    try { return await require(file)(req, res) } catch (e) { console.error(e); res.statusCode = 500; return res.end('{"error":"Server error"}') }
  }
  if (p === '/') p = '/index.html';
  let f = path.join(PUB, p);
  if (!f.startsWith(PUB)) { res.statusCode = 403; return res.end() }
  if (!path.extname(f) && fs.existsSync(f + '.html')) f += '.html';
  fs.readFile(f, (e, buf) => {
    if (e) { res.statusCode = 404; return res.end('Not found') }
    res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(buf);
  });
}).listen(PORT, async () => {
  console.log(`Gramik desk running → http://localhost:${PORT}`);
  try { await require('../lib/db').ready(); console.log(process.env.DATABASE_URL ? 'Database: Postgres (DATABASE_URL)' : 'Database: local PGlite in .data/pglite') } catch (e) { console.error('Database problem:', e.message) }
});
