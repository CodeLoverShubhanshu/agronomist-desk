const { query } = require('../../lib/db');
const { requireUser, send, route } = require('../../lib/auth');

// Database usage against the Neon free plan, for the admin's early warning.
// Storage is exact. Running time and data sent are estimates from the desk's own tracking (lib/db.js):
// the database counts as running from each minute it was used until 5 minutes later (when Neon puts it to sleep),
// at the smallest size (0.25 CU). Neon's own numbers are on its Billing page.
const LIMITS = { cuHours: 100, transferGB: 5, storageGB: 1, cu: 0.25 };

module.exports = route(async (req, res) => {
  const me = await requireUser(req, res, 'admin'); if (!me) return;
  const { rows: [st] } = await query(`SELECT pg_database_size(current_database())::bigint AS bytes, (date_trunc('month', now() AT TIME ZONE 'UTC'))::date AS since,
    (SELECT min(minute) FROM usage_minutes) AS tracked_from`);
  const { rows: days } = await query(
    `WITH m AS (SELECT minute, bytes, lead(minute) OVER (ORDER BY minute) AS nxt FROM usage_minutes WHERE minute >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
     SELECT to_char((minute AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day, sum(bytes)::bigint AS bytes,
            sum(LEAST(COALESCE(EXTRACT(EPOCH FROM nxt - minute) / 60, 6), 6))::int AS awake_min
     FROM m GROUP BY 1 ORDER BY 1`);
  res.setHeader('Cache-Control', 'no-store');
  send(res, 200, { limits: LIMITS, storage: Number(st.bytes), since: st.since, trackedFrom: st.tracked_from, now: new Date().toISOString(),
    days: days.map(d => ({ day: d.day, bytes: Number(d.bytes), awakeMin: d.awake_min })) });
});
