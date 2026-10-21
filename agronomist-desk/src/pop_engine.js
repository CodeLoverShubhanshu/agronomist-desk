/* POP Intelligence engine.
   One set of rules for every surface: the stage finder page, the agronomist dashboard and the voice agent.
   No screen code in here. Input: the data bundle built by build_page.py. Output: plain objects.
   Works in a browser (window.POP) and in Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.POP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DAY = 864e5;
  const iso = d => new Date(d).toISOString().slice(0, 10);
  const norm = s => (s || '').toString().toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^0-9a-zऀ-ॿ]/g, '');
  const FACTOR = {1: 'Nutrition', 2: 'Preventive', 3: 'Problem seen', 4: 'Weather', 5: 'Weed', 6: 'POP'};
  const STATUS = {nc: 'Do not combine', care: 'Keep apart', nm: 'Applied separately', ok: 'No known issue', ut: 'Used together in POP'};
  const CLASH_FACTOR = {injures_crop: 'Injures crop', harms_soil: 'Harms soil', reacts_in_tank: 'Reacts in tank', stops_working: 'Stops working', same_chemical_twice: 'Same chemical twice', harms_bees: 'Harms bees'};

  function create(D, OPT) {
    // OPT.saveMoney turns on the stage page's money-saving rules (top-2 prevention, boosters and same-job products held back).
    // Off by default, so the agronomist dashboard keeps its own behaviour.
    const SAVE = !!(OPT && OPT.saveMoney);
    const P = D.P, I = D.I, G = D.G || {}, PR = D.PR || {}, IP = D.IP || {}, NO = D.NO || [], WO = D.WO || [], WE = D.WE || [],
      PA = D.PA || {}, CP = D.CP || {R: [], B: [], F: [], D: [], M: {}}, CF = D.CF || {risk: {}, rules: []};

    /* ---------- helpers ---------- */
    // group match: [] = all crops, "rice;wheat" = only those, "!pulse" = all except
    function gm(list, g) {
      if (!list || !list.length) return true;
      const neg = list.filter(x => x[0] === '!').map(x => x.slice(1)), pos = list.filter(x => x[0] !== '!');
      if (neg.includes(g)) return false;
      return !pos.length || pos.includes(g);
    }
    const doseOf = (p, d) => (d || (PR[p] && PR[p].dose) || '').replace(/\s*\/\s*acre/i, '');
    function compat(a, b) {
      if (a === b) return null;
      const v = CP.M[a + '|' + b] || CP.M[b + '|' + a];
      return v ? {s: v[0], label: STATUS[v[0]], why: CP.R[v[1]], basis: CP.B[v[2]], f: v[3] >= 0 ? CP.F[v[3]] : '', todo: v[4] >= 0 ? CP.D[v[4]] : ''} : null;
    }
    const clash = (a, b) => { const x = compat(a, b); return !!x && (x.s === 'nc' || x.s === 'care' || x.s === 'nm'); };
    // product rules for an issue; after sowing, seed-treatment rules are skipped
    function pick(id, mode, c) {
      const late = c.st !== 'S1';
      const rs = (IP[id] || []).filter(q => gm(q.g, c.g) && !(late && /seed|sett/i.test(q.dose || '')));
      let m = rs.filter(q => q.mode === mode).sort((a, b) => a.pr - b.pr);
      if (!m.length) m = rs.filter(q => q.mode !== mode).sort((a, b) => a.pr - b.pr);
      return m;
    }
    const prodInfo = p => { const x = PR[p] || {}; return {type: x.t || '', subType: x.st || '', tech: x.tech || '', gramik: x.gk !== false, inferred: !!x.inf, method: x.m || ''}; };

    /* ---------- crop, variety, stage ---------- */
    function resolveCrop(label) {
      if (P[label]) return label;
      const n = norm(label);
      return Object.keys(P).find(k => norm(k) === n || norm(P[k].crop) === n) || Object.keys(P).find(k => n.startsWith(norm(k))) || null;
    }
    // exact name first; otherwise the closest-named variety whose plan covers this day
    function resolveVariety(ck, name, das) {
      const vs = Object.keys(P[ck].varieties), n = norm(name);
      const exact = vs.find(v => norm(v) === n);
      if (exact) return {variety: exact, exact: true};
      const covers = v => { const t = P[ck].varieties[v], r = t.das || []; return r.length && das != null && das >= r[0].a && das <= r[r.length - 1].b; };
      const prefix = v => { const a = norm(v); let i = 0; while (i < a.length && i < n.length && a[i] === n[i]) i++; return i; };
      const draft = v => (P[ck].varieties[v].das || []).some(r => r.review) ? 1 : 0;
      const ranked = vs.slice().sort((a, b) => (covers(b) - covers(a)) || (prefix(b) - prefix(a)) || (draft(a) - draft(b)));
      return {variety: ranked[0], exact: false, asked: name};
    }
    const md = d => (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    const mdOf = s => { const [m, d] = s.split('-').map(Number); return m * 100 + d; };
    const inCal = (x, a, b) => a <= b ? (x >= a && x <= b) : (x >= a || x <= b);
    function stageFor(ck, variety, sowISO, asOfISO, track) {
      const t = P[ck].varieties[variety], tk = track || (t.das ? 'das' : Object.keys(t)[0]), rows = t[tk], isCal = tk === 'cal';
      const asOf = new Date(asOfISO || iso(new Date()));
      let idx = -1, das = null, status = 'ok';
      if (isCal) { const x = md(asOf); idx = rows.findIndex(r => inCal(x, mdOf(r.cs), mdOf(r.ce))); if (idx < 0) status = 'gap'; }
      else {
        das = Math.floor((asOf - new Date(sowISO)) / DAY);
        idx = rows.findIndex(r => das >= r.a && das <= r.b);
        if (das < 0) status = 'before'; else if (das > rows[rows.length - 1].b) status = 'after'; else if (idx < 0) status = 'gap';
      }
      const end = isCal ? null : rows[rows.length - 1].b;
      // past the end of the plan: treat as the last stage (harvest)
      const useIdx = idx >= 0 ? idx : status === 'after' ? rows.length - 1 : 0;
      const row = rows[useIdx];
      return {track: tk, isCal, rows, idx: useIdx, found: idx >= 0, status, row, das, end,
        daysLeft: isCal || idx < 0 ? null : row.b - das, daysIn: isCal || idx < 0 ? null : das - row.a, month: asOf.getUTCMonth() + 1};
    }
    function context(ck, stage) {
      const r = stage.row;
      return {ck, g: (G[ck] || {}).g || '', st: r.canon, mo: stage.month, das: stage.das, isCal: stage.isCal,
        popP: (r.prod || '').split(';').map(x => x.trim()).filter(Boolean), wids: r.w.map(z => z[0]), row: r, rows: stage.rows, idx: stage.idx};
    }

    /* ---------- the five factors ---------- */
    const MAX_PREVENT = 2;
    // boosters: help the crop but are not essential; held back unless the farmer can afford them
    const isBooster = p => { const x = PR[p] || {}; return x.t === 'biostimulant' || x.st === 'growth_regulator'; };
    // products doing the same job: same type and sub-type, applied the same way
    const jobOf = (p, cl) => { const x = PR[p] || {}; return ['fungicide', 'insecticide', 'bactericide'].includes(x.t) || (x.t === 'nutrition' && ['water_soluble_npk', 'micronutrient'].includes(x.st)) ? x.t + '|' + x.st + '|' + cl : null; };
    const BOOST = {NUTRIENT_DEF: ['N_VEG', 'N_ZINC'], POOR_GROWTH: ['N_VEG', 'N_BRANCH'], FLOWER_DROP: ['N_FLOWER'], POOR_QUALITY: ['N_QUALITY', 'N_FILL'], WEAK_ROOT: ['N_TILLER', 'N_RHIZZA'], SOIL_HEALTH: ['N_BASAL']};
    function nutrition(c) {
      const bs = new Set(c.wids.flatMap(i => BOOST[i] || []));
      return NO.filter(o => gm(o.g, c.g)).map(o => {
        const inPop = o.p.some(p => c.popP.includes(p)), stg = o.st.includes(c.st), onWatch = bs.has(o.id);
        const must = ((o.ms || []).includes(c.st) && gm(o.mg, c.g)) || (onWatch && stg);
        return {id: o.id, en: o.en, hi: o.hi, tier: must ? 1 : stg ? 2 : 3, score: (stg ? 3 : 0) + (inPop ? 1 : 0) + (onWatch ? 1 : 0), inPop, onWatch,
          products: o.p.map(p => ({p, dose: doseOf(p)})), why: o.why, how: o.pr};
      }).sort((a, b) => a.tier - b.tier || b.score - a.score);
    }
    function prevention(c) {
      const out = [], nx = c.rows[c.idx + 1];
      const add = (id, rk, tag, tier) => {
        const x = I[id]; if (!x || !['pest', 'disease'].includes(x.t) || out.some(o => o.id === id)) return;
        const m = pick(id, 'prevent', c);
        out.push({id, en: x.en, hi: x.hi, type: x.t, risk: rk, tier, tag, weather: x.wx, actions: PA[id] || [],
          product: m[0] ? {p: m[0].p, dose: doseOf(m[0].p, m[0].dose), note: m[0].note} : null,
          alt: m[1] && m[1].p !== m[0].p ? {p: m[1].p, dose: doseOf(m[1].p, m[1].dose)} : null, score: {H: 3, M: 2, L: 1}[rk]});
      };
      // only the top MAX_PREVENT high-risk threats (by rank on the stage watch list) are must-do; the other high-risk ones are
      // "watch": scout and spray only if seen, so a small farmer does not pay for a spray against every threat
      let nH = 0;
      c.row.w.forEach(([id, rk, nw]) => {
        const x = I[id]; if (!x || !['pest', 'disease'].includes(x.t) || out.some(o => o.id === id)) return;
        const must = rk === 'H' && (!SAVE || nH++ < MAX_PREVENT);
        add(id, rk, nw ? 'New this stage' : '', must ? 1 : {H: 2, M: 2, L: 3}[rk]);
        if (rk === 'H' && !must) out[out.length - 1].watch = true;
      });
      if (nx) nx.w.filter(z => z[2]).forEach(z => add(z[0], z[1], 'Next stage: ' + nx.en, z[1] === 'H' ? 2 : 3));
      // stable sort keeps the watch-list rank inside each tier
      return out.map((o, i) => [o, i]).sort((a, b) => a[0].tier - b[0].tier || b[0].score - a[0].score || a[1] - b[1]).map(x => x[0]);
    }
    // everything the farmer might report at this stage, with the product that treats it
    function watch(c) {
      return c.row.w.map(([id, rk, nw]) => {
        const x = I[id], m = id === 'WEEDS' ? [] : pick(id, 'cure', c);
        return {id, en: x.en, hi: x.hi, type: x.t, risk: rk, isNew: nw, symptom: x.sym, weather: x.wx, part: x.part,
          treat: m[0] ? {p: m[0].p, dose: doseOf(m[0].p, m[0].dose), note: m[0].note} : null,
          alt: m[1] && m[1].p !== m[0].p ? {p: m[1].p, dose: doseOf(m[1].p, m[1].dose)} : null};
      });
    }
    function weather(c) {
      const hiDis = c.row.w.some(z => I[z[0]] && I[z[0]].t === 'disease' && z[1] === 'H');
      return WO.filter(o => gm(o.g, c.g)).map(o => {
        const mo = o.mo.includes(c.mo), stg = !o.st.length || o.st.includes(c.st);
        const ab = c.wids.includes('ABIOTIC_STRESS') && ['W_HEAT', 'W_DROUGHT'].includes(o.id);
        const pos = o.g.filter(x => x[0] !== '!');
        const crit = {W_HEAT: ['S5', 'S6', 'S7'], W_DROUGHT: ['S5', 'S6', 'S7'], W_WATERLOG: ['S1', 'S2', 'S3'], W_COLD: null, W_HUMID: hiDis ? null : []}[o.id];
        const must = ab || (mo && stg && (crit === null || (crit && crit.includes(c.st)) || (crit === undefined && pos.length && pos.includes(c.g))));
        return {id: o.id, en: o.en, hi: o.hi, tier: must ? 1 : (mo && stg) ? 2 : 3, score: (mo ? 2 : 0) + (stg ? 1 : 0) + (ab ? 2 : 0), likelyThisMonth: mo, onWatch: ab,
          signs: o.sg, products: o.p.map(p => ({p, dose: doseOf(p)})), how: o.pr};
      }).sort((a, b) => a.tier - b.tier || b.score - a.score);
    }
    const weedRow = (id, g) => WE.find(x => x.id === id && x.g === g) || WE.find(x => x.id === id && x.g === '*');
    function weeds(c) {
      const ids = [...new Set(WE.map(x => x.id))], onW = c.wids.includes('WEEDS');
      const herbNow = ids.some(i => { const o = weedRow(i, c.g); return o && o.p.length && o.st.includes(c.st) && i !== 'WD_PRE'; });
      return ids.map(id => {
        const o = weedRow(id, c.g); if (!o) return null;
        let pred = o.st.includes(c.st), windowPassed = false;
        if (id === 'WD_PRE' && c.das != null && c.g !== 'rice' && c.das > 3) { pred = false; windowPassed = true; }
        const post = ['WD_GRASS', 'WD_BROAD', 'WD_SEDGE', 'WD_MIXED'].includes(id);
        const tier = !pred ? 3 : id === 'WD_PRE' ? 1 : id === 'WD_MANUAL' ? (herbNow ? 2 : 1) : post && onW && (id === 'WD_MIXED' || !weedRow('WD_MIXED', c.g).p.length) ? 1 : 2;
        return {id, en: o.en, hi: o.hi, tier, score: o.p.length ? 1 : 0, windowPassed, onWatch: pred && onW && id !== 'WD_LATE',
          products: o.p.map(p => ({p, dose: doseOf(p)})), how: o.pr};
      }).filter(Boolean).map((o, i) => [o, i]).sort((a, b) => a[0].tier - b[0].tier || b[0].score - a[0].score || a[1] - b[1]).map(x => x[0]);
    }

    /* ---------- the plan: merge, check compatibility, build tanks ----------
       sel = {nut:[ids], cure:[issue ids or {id,src}], wx:[ids], weed:[ids], prevAuto:true, skip:[product names]} */
    function plan(c, sel) {
      sel = sel || {};
      const tierOf = {};
      nutrition(c).forEach(o => tierOf['nut:' + o.id] = o.tier);
      weather(c).forEach(o => tierOf['wx:' + o.id] = o.tier);
      weeds(c).forEach(o => tierOf['weed:' + o.id] = o.tier);
      const prev = prevention(c);
      const M = new Map(), prac = [], facs = new Set(); let nsel = 0;
      const skip = new Set(sel.skip || []), skipped = [];
      const cls = (p, d) => { const x = PR[p] || {}, ds = d || ''; return /seed|sett/i.test(ds) ? 'seed' : /drench|with irrigation/i.test(ds) ? 'soil' : x.m === 'soil' ? 'soil' : x.m === 'trap' ? 'trap' : x.t === 'herbicide' ? 'herb' : 'A'; };
      const add = (p, d, f, why, note, t) => {
        if (skip.has(p)) { if (!skipped.includes(p)) skipped.push(p); return {alt: new Set()}; }
        const k = p + '|' + cls(p, d); let e = M.get(k);
        if (!e) { e = {p, c: cls(p, d), t: 3, d: new Set(), rs: [], notes: new Set(), alt: new Set()}; M.set(k, e); }
        e.t = Math.min(e.t, t || 2); const dd = doseOf(p, d); if (dd) e.d.add(dd);
        if (!e.rs.some(x => x[0] === f && x[1] === why)) e.rs.push([f, why]); if (note) e.notes.add(note); facs.add(f); return e;
      };
      (sel.nut || []).forEach(id => { const o = NO.find(x => x.id === id); if (!o) return; nsel++; facs.add(1); const t = tierOf['nut:' + id] || 2; o.p.forEach(p => add(p, null, 1, o.en, null, t)); if (o.pr) prac.push([1, o.en, o.pr, t]); });
      const cureIds = new Map(); (sel.cure || []).forEach(x => typeof x === 'string' ? cureIds.set(x, '') : cureIds.set(x.id, x.src || ''));
      const prevAuto = sel.prevAuto === false ? [] : prev.filter(o => o.tier === 1).map(o => o.id);
      prevAuto.forEach(id => {
        const x = I[id]; if (!x) return; nsel++; facs.add(2);
        if (cureIds.has(id)) { prac.push([2, x.en, 'Already present: treated as a problem seen instead of prevention']); return; }
        const m = pick(id, 'prevent', c); if (!m.length) { prac.push([2, x.en, 'No product mapped: scout twice a week']); return; }
        const e = add(m[0].p, m[0].dose, 2, x.en, m[0].note, 1); if ((PA[id] || []).length) prac.push([2, x.en, PA[id].join('; '), 1]);
        if (m[1] && m[1].p !== m[0].p) e.alt.add(m[1].p);
      });
      cureIds.forEach((src, id) => {
        const x = I[id]; if (!x || x.t === 'livestock') return; nsel++; facs.add(3);
        if (id === 'WEEDS') { prac.push([3, x.en, 'Choose the weed situation under Weeds', 1]); return; }
        const m = pick(id, 'cure', c); if (!m.length) { prac.push([3, x.en, 'No product mapped: ask agronomist']); return; }
        const e = add(m[0].p, m[0].dose, 3, x.en + (src ? ' (' + src + ')' : ''), m[0].note, 1); if (m[1] && m[1].p !== m[0].p) e.alt.add(m[1].p);
      });
      (sel.wx || []).forEach(id => { const o = WO.find(x => x.id === id); if (!o) return; nsel++; facs.add(4); const t = tierOf['wx:' + id] || 2; o.p.forEach(p => add(p, null, 4, o.en, null, t)); if (o.pr) prac.push([4, o.en, o.pr, t]); });
      (sel.extra || []).forEach(p => { if (!PR[p]) return; nsel++; add(p, null, 6, 'In the POP for this stage', null, 2); });
      (sel.weed || []).forEach(id => { const o = weedRow(id, c.g); if (!o) return; nsel++; facs.add(5); const t = tierOf['weed:' + id] || 2; o.p.forEach(p => add(p, null, 5, o.en, null, t)); if (o.pr) prac.push([5, o.en, o.pr, t]); });

      let E = [...M.values()]; const tik = E.find(e => e.p === 'TIKAU-G'); E = E.filter(e => e.p !== 'TIKAU-G');
      E.sort((a, b) => a.t - b.t); prac.sort((a, b) => (a[3] || 2) - (b[3] || 2));
      const typ = e => (PR[e.p] || {}).t;
      /* save the farmer's money: hold back boosters, and the second of two products doing the same job.
         A product treating a problem the farmer has seen is never held back; sel.keep puts a held product back. */
      const keep = new Set(SAVE ? (sel.keep || []) : Object.keys(PR)), held = [], isProb = e => e.rs.some(x => x[0] === 3);
      const hold = (e, why, kind) => { E = E.filter(z => z !== e); held.push({e, why, kind}); };
      E.filter(e => isBooster(e.p) && !isProb(e) && !keep.has(e.p)).forEach(e => hold(e, 'Booster: use if money allows', 'booster'));
      const val = e => e.rs.reduce((n, x) => n + (x[0] === 3 ? 100 : x[0] ? 10 : 0), 0) + (e.t === 1 ? 5 : 0) - (PR[e.p] && PR[e.p].gk === false ? 3 : 0);
      const jobs = {}; E.forEach(e => { const k = jobOf(e.p, e.c); if (k) (jobs[k] = jobs[k] || []).push(e); });
      Object.values(jobs).filter(g => g.length > 1).forEach(g => {
        g.sort((a, b) => val(b) - val(a));
        g.slice(1).forEach(e => { if (!isProb(e) && !keep.has(e.p)) hold(e, 'Same job as ' + g[0].p, 'same_job'); });
      });
      let fol = E.filter(e => e.c === 'A');
      // a fungicide added only for weather is dropped when a disease fungicide is already in the plan
      const fung = fol.filter(e => typ(e) === 'fungicide');
      if (fung.length > 1) fung.filter(e => e.rs.every(x => x[0] === 4)).forEach(e => {
        if (fol.filter(z => typ(z) === 'fungicide').length < 2) return;
        fol = fol.filter(z => z !== e); E = E.filter(z => z !== e);
        prac.push([4, e.rs[0][1], 'Weather protection already covered by the fungicide above; ' + e.p + ' not added']);
      });
      // tanks: a product joins the first tank where it clashes with nothing
      const build = list => { const T = []; list.forEach(e => { let t = T.find(t => t.every(z => !clash(z.p, e.p))); if (!t) { t = []; T.push(t); } t.push(e); }); return T; };
      let sprays = [];
      build(fol).forEach(t => {
        const pest = t.filter(e => ['insecticide', 'fungicide', 'bactericide'].includes(typ(e)));
        if (pest.length > 2) { const b = t.filter(e => ['fungicide', 'bactericide'].includes(typ(e))), a = t.filter(e => !b.includes(e)); [a, b].forEach(x => x.length && sprays.push(x)); }
        else sprays.push(t);
      });
      sprays.sort((a, b) => Math.min(...a.map(e => e.t)) - Math.min(...b.map(e => e.t)));
      const weedTanks = build(E.filter(e => e.c === 'herb'));
      let tikUsed = false;
      sprays.forEach(t => {
        if (!t.every(e => { const x = compat('TIKAU-G', e.p); return !x || x.s === 'ut' || x.s === 'ok'; })) return;
        t.push({p: 'TIKAU-G', c: 'A', d: new Set([doseOf('TIKAU-G')]), t: tik && !tikUsed ? tik.t : Math.min(...t.map(z => z.t)),
          rs: tik && !tikUsed ? [...tik.rs, [0, 'Sticker for this spray']] : [[0, 'Sticker for this spray']], notes: new Set(), alt: new Set(), auto: true});
        tikUsed = true;
      });
      const SEC = [];
      sprays.forEach((t, i) => SEC.push(['S' + (i + 1), 'spray', sprays.length > 1 ? 'Spray ' + (i + 1) : 'Foliar spray', 'per acre in 150-200 L water' + (i ? ' · 5-7 days after Spray ' + i : ''), t]));
      SEC.push(['soil', 'soil', 'Soil application / drench / with irrigation', 'per acre', E.filter(e => e.c === 'soil')],
        ['seed', 'seed', 'Seed / sett treatment', 'before sowing', E.filter(e => e.c === 'seed')],
        ['trap', 'trap', 'Traps and monitoring', 'per acre', E.filter(e => e.c === 'trap')]);
      weedTanks.forEach((t, i) => SEC.push(['W' + (i + 1), 'weed', weedTanks.length > 1 ? 'Weed spray ' + (i + 1) : 'Weed spray', 'separate spray; clean sprayer after use' + (i ? ' · about 7 days after weed spray ' + i : ''), t]));
      const SECS = SEC.filter(s => s[4].length);

      /* compatibility report */
      const loc = {}, where = {}, LAB = {soil: 'soil application', seed: 'seed treatment', trap: 'traps'};
      SECS.forEach(([k, , , , t]) => t.forEach(e => { (loc[e.p] = loc[e.p] || []).push(k); (where[e.p] = where[e.p] || new Set()).add(e.c); }));
      const names = Object.keys(loc), lab = k => /^S\d/.test(k) ? 'Spray ' + k.slice(1) : /^W\d/.test(k) ? 'Weed spray ' + k.slice(1) : LAB[k];
      const CN = {ut: 0, ok: 0, nm: 0, care: 0, nc: 0, none: 0}, conf = new Map(), tankPairs = [];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        const a = names[i], b = names[j], x = compat(a, b);
        if (!x) { CN.none++; continue; } CN[x.s]++;
        const same = loc[a].filter(k => /^[SW]\d/.test(k) && loc[b].includes(k));
        if (same.length) tankPairs.push({a, b, status: x.s, label: x.label, basis: x.basis, tank: lab(same[0])});
        if (x.s === 'nc' || x.s === 'care') {
          const key = x.s + '|' + x.why; let g = conf.get(key);
          if (!g) { g = {status: x.s, label: x.s === 'nc' ? 'Do not combine' : 'Keep apart', reason: x.why, basis: x.basis, factor: x.f, factorLabel: CLASH_FACTOR[x.f] || '',
            whatToDo: x.todo || (x.f === 'injures_crop' && /herbicide/i.test(x.why) ? 'Spray every herbicide on its own; use a separate sprayer or wash it well' : ''), pairs: [], resolution: new Set()}; conf.set(key, g); }
          g.pairs.push([a, b]);
          const sa = loc[a].filter(k => /^[SW]\d/.test(k)), sb = loc[b].filter(k => /^[SW]\d/.test(k));
          g.resolution.add(same.length ? 'Still in one tank: ' + lab(same[0]) : sa.length && sb.length ? 'Separated: ' + lab(sa[0]) + ' and ' + lab(sb[0]) : 'Applied separately (' + lab(loc[a][0]) + ' / ' + lab(loc[b][0]) + ')');
        }
      }
      const conflicts = [...conf.values()].sort((a, b) => (a.status === 'nc' ? 0 : 1) - (b.status === 'nc' ? 0 : 1) || b.pairs.length - a.pairs.length).map(g => Object.assign(g, {resolution: [...g.resolution]}));
      const flowering = ['S5', 'S6'].includes(c.st), isApple = c.ck === 'Apple', cautions = [];
      names.forEach(p => (CF.risk[p] || []).forEach(k => {
        if (k.f.includes('harms_bees') && !flowering) return;
        if (/\bapple\b/i.test(k.w) && !isApple) return;
        if (/drench|seed treatment/i.test(k.w) && ![...where[p]].some(x => x === 'soil' || x === 'seed')) return;
        cautions.push({product: p, factors: k.f, factorLabels: k.f.map(f => CLASH_FACTOR[f] || f), what: k.w, whatToDo: k.d, basis: k.b});
      }));
      const bigTanks = sprays.map((t, i) => ({spray: i + 1, products: t.filter(e => e.p !== 'TIKAU-G').length})).filter(x => x.products > 3);
      const warnings = [];
      if (c.st === 'S8') warnings.push('Crop is at maturity / harvest: avoid chemical sprays and respect the waiting period on the label.');
      if (c.st === 'S6' && sprays.flat().some(e => typ(e) === 'insecticide') && !cautions.some(k => k.factors.includes('harms_bees'))) warnings.push('Flowering: spray insecticides after 4 pm to protect bees.');
      if (weedTanks.length && sprays.length) warnings.push('Do not mix herbicide with other products. Use a separate sprayer or wash it well.');
      if (sprays.length > 1) warnings.push('The compatibility check split the products into ' + sprays.length + ' sprays. Keep 5-7 days between them.');
      const ng = [...new Set(E.filter(e => PR[e.p] && !PR[e.p].gk).map(e => e.p))];
      if (ng.length) warnings.push('No Gramik product mapped for: ' + ng.join(', ') + '. Shown by technical name.');
      const item = e => Object.assign({product: e.p, dose: [...e.d], tier: e.t, auto: !!e.auto, reasons: e.rs.map(([f, w]) => ({factor: f, factorLabel: FACTOR[f] || '', text: w})), tips: [...e.notes], alternatives: [...e.alt]}, prodInfo(e.p));
      return {
        selections: nsel, factorsUsed: facs.size, products: new Set(E.map(e => e.p)).size, skipped,
        held: held.map(h => Object.assign(item(h.e), {why: h.why, kind: h.kind})),
        mustFirst: [...new Set(E.filter(e => e.t === 1).map(e => e.p))],
        sections: SECS.map(([id, kind, title, sub, t]) => ({id, kind, title, sub, items: t.map(item)})),
        practices: prac.map(([f, t, x, q]) => ({factor: f, factorLabel: FACTOR[f], title: t, text: x, tier: q || 2})),
        warnings,
        compatibility: {pairsChecked: CN.ut + CN.ok + CN.nm + CN.care + CN.nc, counts: CN, conflicts, cautions, bigTanks, tankPairs,
          unresolved: conflicts.some(g => g.resolution.some(x => x.startsWith('Still'))), rules: CF.rules}
      };
    }

    /* ---------- focus: the few products to recommend on this call ----------
       A full plan can hold ten products; no farmer buys ten on one call. focus() scores every product in the plan by the need it
       covers (weights below, editable in data/call_focus.csv), keeps the best few for this call and holds the rest for the next call.
       A product that covers several high-risk threats scores for each of them, so the fewest products cover the most risk.
       opts = {max, weights, now:[products the agronomist pinned to this call], later:[products moved to the next call]} */
    const FOCUS = {problem_confirmed: 100, prevention_first: 40, prevention_step: 6, prevention_min: 10,
      nutrition_must: 30, nutrition_recommended: 12, nutrition_optional: 4, weed_must: 30, weed_recommended: 12, weed_optional: 4,
      weather_must: 20, weather_recommended: 8, weather_optional: 4, pop_product: 15, in_stage_pop: 8,
      non_gramik_factor: 0.5, second_spray_factor: 0.75, MAX_PRODUCTS: 3};
    function focus(c, sel, opts) {
      sel = sel || {}; opts = opts || {};
      const W = Object.assign({}, FOCUS, opts.weights || {}), max = opts.max != null ? opts.max : W.MAX_PRODUCTS;
      const full = plan(c, sel), prev = prevention(c).filter(o => o.tier === 1), nut = nutrition(c), wx = weather(c), wd = weeds(c);
      const tw = (t, k) => W[k + (t === 1 ? '_must' : t === 2 ? '_recommended' : '_optional')];
      // the first product of an option carries the option; the second and third add less
      const share = (o, p) => 1 / (1 + Math.max(0, o.products.findIndex(x => x.p === p)) * 0.5);
      const needW = (r, p) => {
        if (r.factor === 3) return W.problem_confirmed;                    // the farmer has the problem now
        if (r.factor === 2) { const i = prev.findIndex(o => o.en === r.text); // high-risk threat: weight falls with its rank on the stage watch list
          return i < 0 ? W.prevention_min : Math.max(W.prevention_min, W.prevention_first - W.prevention_step * i); }
        if (r.factor === 6) return W.pop_product;
        const list = r.factor === 1 ? nut : r.factor === 4 ? wx : r.factor === 5 ? wd : null, o = list && list.find(z => z.en === r.text);
        return o ? tw(o.tier, {1: 'nutrition', 4: 'weather', 5: 'weed'}[r.factor]) * share(o, p) : 0;
      };
      const C = new Map();
      full.sections.forEach(s => s.items.forEach(e => {
        if (e.auto) return;                                                  // the sticker follows its spray
        let x = C.get(e.product);
        if (!x) { x = {product: e.product, value: 0, tier: e.tier, problem: false, spray: false, gramik: e.gramik, type: e.type, dose: e.dose, reasons: [], why: ''}; C.set(e.product, x); }
        x.tier = Math.min(x.tier, e.tier); if (s.kind === 'spray') x.spray = true;
        e.reasons.forEach(r => { if (!r.factor) return; x.value += needW(r, e.product); if (r.factor === 3) x.problem = true; x.reasons.push(r); });
      }));
      // held-back products (boosters, same job) are offered for the next call, never picked automatically
      (full.held || []).forEach(e => { if (C.has(e.product)) return;
        const x = {product: e.product, value: 0, tier: e.tier, problem: false, spray: false, gramik: e.gramik, type: e.type, dose: e.dose, reasons: [], why: '', held: e.why};
        e.reasons.forEach(r => { if (r.factor) { x.value += needW(r, e.product); x.reasons.push(r); } }); C.set(e.product, x); });
      C.forEach(x => {
        if (c.popP.includes(x.product)) x.value += W.in_stage_pop;          // named in the POP for this stage
        if (!x.gramik && !x.problem) x.value *= W.non_gramik_factor;        // Gramik cannot supply it
        x.value = Math.round(x.value);
      });
      const pinNow = new Set(opts.now || []), pinLater = new Set(opts.later || []), all = [...C.values()], chosen = [];
      // always on this call: the confirmed problem, what the agronomist pinned, and must-do plain fertiliser (advice, not a sale)
      all.forEach(x => { x.why = pinLater.has(x.product) ? '' : x.problem ? 'problem' : pinNow.has(x.product) ? 'pinned' : (!x.gramik && x.type === 'nutrition' && x.tier === 1) ? 'advice' : ''; if (x.why) chosen.push(x); });
      // the limit is on what the engine picks: products the agronomist adds by hand come on top and push nothing out.
      // traps are one monitoring kit: together they take one place, however many colours are needed
      const auto = x => x.why === 'problem' || x.why === 'top';
      const counted = () => chosen.filter(x => auto(x) && x.type !== 'trap').length + (chosen.some(x => auto(x) && x.type === 'trap') ? 1 : 0);
      const apart = (a, b) => { const z = compat(a, b); return !!z && (z.s === 'nc' || z.s === 'care'); };
      // a spray that cannot share the tank with what is already chosen needs a second trip 5-7 days later: a natural next-call item
      const sc = x => x.value * (x.spray && chosen.some(z => z.spray && apart(z.product, x.product)) ? W.second_spray_factor : 1);
      const pool = all.filter(x => !x.why && !x.held && !pinLater.has(x.product));
      while (counted() < max && pool.length) {
        pool.sort((a, b) => sc(b) - sc(a) || a.tier - b.tier);
        if (sc(pool[0]) <= 0) break;
        const best = pool.shift(); best.why = 'top'; chosen.push(best);
      }
      const later = all.filter(x => !chosen.includes(x)).sort((a, b) => b.value - a.value);
      chosen.sort((a, b) => (b.problem - a.problem) || b.value - a.value);
      const final = later.length ? plan(c, Object.assign({}, sel, {skip: [...(sel.skip || []), ...later.filter(x => !x.held).map(x => x.product)]})) : full;
      return {plan: final, full, max, limit: W.MAX_PRODUCTS, now: chosen, later};
    }

    /* ---------- one call does it all: farmer facts in, brief out ---------- */
    function brief(farmer, asOfISO) {
      const ck = resolveCrop(farmer.crop); if (!ck) return {error: 'Crop not in POP data: ' + farmer.crop};
      const asOf = asOfISO || iso(new Date());
      const dasGuess = Math.floor((new Date(asOf) - new Date(farmer.sowing_date)) / DAY);
      const v = resolveVariety(ck, farmer.variety, dasGuess);
      const stage = stageFor(ck, v.variety, farmer.sowing_date, asOf);
      const c = context(ck, stage);
      return {cropKey: ck, crop: P[ck].crop, variety: v, stage, context: c,
        nutrition: nutrition(c), prevention: prevention(c), watch: watch(c), weather: weather(c), weeds: weeds(c)};
    }

    return {gm, compat, clash, doseOf, pick, resolveCrop, resolveVariety, stageFor, context, nutrition, prevention, watch, weather, weeds, plan, focus, brief,
      labels: {FACTOR, STATUS, CLASH_FACTOR}, data: D};
  }
  return {create, version: '1.2'};
});
