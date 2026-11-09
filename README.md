# Gramik Agronomist Desk — production

The same agronomist desk (call queue, call list upload with automatic POP, call brief, outcomes, orders,
callbacks, After calls, Dark stores, My profile), now with:

- **Individual logins** – each agronomist signs in and sees only their own desk. A new agronomist starts with **0 calls**.
- **Database** – everything the agronomist does (uploaded lists, farmers, crop details/POP, calls, outcomes, orders,
  callbacks, undecided) is saved to Postgres under their login, automatically, a second after each change.
- **Admin desk** (`/admin`) – the admin login sees every agronomist: calls, connected rate, orders and value,
  POPs filled, queues, overdue callbacks, all farmers, call lists and callbacks, with CSV downloads; can open any
  agronomist's desk read-only; and creates/edits logins, resets passwords, switches logins off, sets targets.

## Pages
| URL | Who | What |
|---|---|---|
| `/` | everyone | Sign in. Agronomists go to `/desk`, admin goes to `/admin` |
| `/desk` | agronomist | The desk (unchanged flow) |
| `/admin` | admin | Admin desk |
| `/desk?as=ID` | admin | An agronomist's desk, read-only |

## Deploy on Vercel (about 10 minutes)
1. Put this folder in a GitHub repo (or use `vercel` CLI from this folder). Import it in Vercel → **Framework preset: Other**. No build command needed.
2. In the Vercel project → **Storage** → **Create database** → **Neon (Postgres)** → connect it to the project.
   This adds `DATABASE_URL` automatically.
3. Project → **Settings → Environment Variables**, add:
   - `SESSION_SECRET` = a long random string (64 characters)
   - `ADMIN_USERNAME` = e.g. `admin`
   - `ADMIN_PASSWORD` = a strong password
   - `ADMIN_NAME` = your name (optional)
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the variables are picked up.
5. Open the site, sign in with the admin username/password → **Agronomists** tab → **Add agronomist** five times.
   Share each username + password with the agronomist. They sign in at the same address.

Tables are created automatically on first start. Nothing else to run.

## Run on your computer (local database)
```
npm install
npm run dev
```
Open http://localhost:3000 — sign in as `admin` / `admin@123` (local default; set ADMIN_PASSWORD in `.env` to change).
Without `DATABASE_URL` the data is stored in `.data/pglite` (a real Postgres engine in a folder). To use your
Neon database locally too, put its `DATABASE_URL` in `.env`.

## How the data is stored
| Table | What |
|---|---|
| `users` | logins (admin + agronomists), hashed passwords (scrypt), hub, phone, targets, on/off |
| `desk_state` | one row per agronomist: their whole desk (`state`, JSON) + a summary for the admin (`report`, JSON) + `version` |
| `desk_snapshots` | daily backup copy of every desk (last save of each day, India time) |
| `audit_log` | sign-ins, wrong passwords, login changes, desk clears (with a full copy of the cleared desk) |

SQL views for reporting straight from the database: `v_calls`, `v_orders`, `v_farmers`, e.g.
`SELECT agronomist, count(*) FROM v_calls WHERE day = '2026-11-09' GROUP BY 1;`

## Safety built in
- Passwords hashed; sessions are signed, HttpOnly cookies (7 days). Changing a password or switching a login off signs that person out everywhere.
- 8 wrong passwords lock that login for 10 minutes.
- If the internet drops, changes stay on the device and are sent when it is back. If the same desk is open in two
  tabs/devices, the second save is stopped and the agronomist chooses which version to keep — nothing is silently overwritten.
- The admin's view of an agronomist desk is read-only.

## Still example data
Weather forecast and dark-store stock are the built-in example data, as before. The built-in sample farmers, orders and the
sample Lens records were removed, so uploaded farmers are matched only against the agronomist's own farmers; crop, variety and
sowing date in the uploaded list create the POP.

## Files
```
public/index.html   sign-in page
public/desk.html    agronomist desk (your desk + boot loader that loads/saves via the API)
public/admin.html   admin desk
api/                Vercel serverless functions: login, logout, me, state, admin/overview, admin/users
lib/db.js           database (Postgres or local PGlite), schema, views
lib/auth.js         passwords, sessions, helpers
scripts/dev-server.js  local server
```
