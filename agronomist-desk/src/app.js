'use strict';
/* ================= basics ================= */
const ENG = POP.create(D), PR = D.PR;
const $ = id => document.getElementById(id);
const esc = s => (s ?? '').toString().replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const DAY = 864e5, iso = d => d.toISOString().slice(0, 10);
const NOW = new Date(), TODAY = iso(new Date(Date.UTC(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())));
const diff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const addDays = (s, n) => iso(new Date(Date.parse(s) + n * DAY));
const dt = s => new Date(s + 'T00:00:00Z');
const fmt = s => s ? dt(s).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', timeZone: 'UTC'}) : '';
const fmtHi = s => dt(s).toLocaleDateString('hi-IN', {day: 'numeric', month: 'long', timeZone: 'UTC'});
const wkd = s => dt(s).toLocaleDateString('en-IN', {weekday: 'short', timeZone: 'UTC'});
const rupee = n => '₹' + Math.round(n).toLocaleString('en-IN');
const chip = (c, t) => `<span class="chip ${c}">${esc(t)}</span>`;
const SAMPLE = chip('sample', 'Sample');
const norm = s => (s || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^0-9a-z]/g, '');
const title = s => s.split(' s/o')[0].trim().toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const relDue = d => { const n = diff(TODAY, d); return n < 0 ? (-n) + (n === -1 ? ' day' : ' days') + ' overdue' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days' };

/* ================= saved state (this browser only) ================= */
const SKEY = 'gramik_desk_v1';
let S = {}; try { S = JSON.parse(localStorage.getItem(SKEY)) || {} } catch (e) { S = {} }
['fup', 'cattle', 'rating', 'ord', 'disp', 'basket', 'seen'].forEach(k => S[k] = S[k] || {});
['newFup', 'log', 'newOrders', 'sent'].forEach(k => S[k] = S[k] || []);

S.recStats = S.recStats || {rec: 24, ordered: 11};
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)) } catch (e) {} };
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 2600) }

/* ================= pincode and weather ================= */
function pinInfo(pin) {
  pin = (pin || '').trim();
  if (!/^\d{6}$/.test(pin)) return {ok: false, pin, err: 'Enter a 6-digit pincode.'};
  const e = OPS.PIN[pin];
  if (e) return {ok: true, pin, district: e[0], place: e[1], exact: true};
  const p = OPS.PREFIX.find(([k]) => pin.startsWith(k));
  if (p) return {ok: true, pin, district: p[1], place: p[1] + ' district', exact: false};
  return {ok: false, pin, err: 'Pincode ' + pin + ' is outside the districts this desk covers (Lucknow, Barabanki, Fatehpur, Hardoi, Sitapur, Kannauj, Unnao, Lakhimpur Kheri, Gautam Buddh Nagar).'};
}
/* The one place to plug in a live feed (Lens backend calling IMD or Open-Meteo by pincode). Returns 7 days. */
function forecast(info) { return info && info.ok ? (OPS.WX[info.district] || null) : null }
const WXT = {0: 'Clear', 1: 'Mostly sunny', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Haze / fog', 61: 'Light rain'};
const WXH = {0: 'साफ़ मौसम', 1: 'धूप', 2: 'आंशिक बादल', 3: 'बादल', 45: 'धुंध / कोहरा', 61: 'हल्की बारिश'};
function icon(code) {
  const sun = '<circle cx="16" cy="16" r="6" fill="#E9A14A"/><g stroke="#E9A14A" stroke-width="2" stroke-linecap="round"><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8"/></g>';
  const cloud = (x, f) => `<path d="M${9 + x} 25h13a5 5 0 0 0 0-10 7 7 0 0 0-13.4 1.6A4.3 4.3 0 0 0 ${9 + x} 25z" fill="${f}"/>`;
  let g;
  if (code === 0) g = sun;
  else if (code === 1) g = sun.replace('r="6"', 'r="5"') ;
  else if (code === 2) g = '<g transform="translate(-4 -5) scale(.8)">' + sun + '</g>' + cloud(1, '#B9CBDA');
  else if (code === 3) g = cloud(0, '#A7B6C2');
  else if (code === 45) g = '<g stroke="#A7B6C2" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h20M4 17h24M7 22h18"/></g>';
  else g = cloud(0, '#8FB0CC') + '<g stroke="#2F6FAE" stroke-width="2" stroke-linecap="round"><path d="M12 27l-1 3M17 27l-1 3M22 27l-1 3"/></g>';
  return `<svg viewBox="0 0 32 32" aria-hidden="true">${g}</svg>`;
}
function dayFlags(d) {
  return {spray: d.wind < 15 && d.pop < 40 && d.rain < 1, rain: d.rain >= 1 || d.pop >= 50, heavy: d.rain >= 20, windy: d.wind >= 15,
    heat: d.max >= 38, cold: d.min <= 4, humid: d.hum >= 78 || (d.rain > 0 && d.hum >= 70), hotdry: d.max >= 30 && d.hum < 65};
}
const dlist = a => a.map(d => wkd(d.d) + ' ' + fmt(d.d)).join(', ');
const dlistHi = a => a.map(d => fmtHi(d.d)).join(', ');
/* weather × crop stage: what the forecast means for this farmer's crop, as structured advice cards
   each card: k (colour), tag, title, when (days), check, act (steps), products [{p, dose}], hi (Hindi line for WhatsApp) */
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const steps = s => (s || '').split(/;|\.\s/).map(x => cap(x.trim().replace(/\.$/, ''))).filter(Boolean);
function cropWx(f, days) {
  const out = [], fl = days.map(dayFlags), pick = k => days.filter((d, i) => fl[i][k]);
  const w = f.b.watch, wet = t => /humid|rain|dew|fog|cloud|moist|wet/i.test((t || '').replace(/no rain/ig, '')), dry = t => /dry|hot/i.test(t || '');
  const rain = pick('rain'), windy = pick('windy'), humid = pick('humid'), heat = pick('heat'), cold = pick('cold'), hd = pick('hotdry');
  const treat = list => list.filter(x => x.treat).map(x => ({p: x.treat.p, dose: x.treat.dose, for: x.en}));
  if (rain.length) out.push({k: 'sky', tag: 'Rain', title: 'Rain likely', when: rain,
    act: ['Spray before the rain or 1 day after it', 'Add sticker to every spray', 'Hold urea top dressing until the rain passes'], products: [{p: 'TIKAU-G', dose: '50 ml'}],
    hi: `${dlistHi(rain)} को बारिश की संभावना है। छिड़काव बारिश से पहले या एक दिन बाद करें और TIKAU-G मिलाएं। यूरिया बारिश के बाद दें।`});
  if (windy.length) out.push({k: 'warm', tag: 'Spray timing', title: 'Windy: do not spray', when: windy, note: 'Wind 15 km/h or more',
    act: ['Skip spraying on these days (spray drifts and is wasted)', 'Spray in the early morning on a calm day instead'], products: [],
    hi: `${dlistHi(windy)} को तेज़ हवा रहेगी, उस दिन छिड़काव न करें।`});
  const dis = w.filter(x => x.type === 'disease' && x.risk !== 'L' && wet(x.weather)).slice(0, 2);
  if (humid.length && dis.length) out.push({k: 'hot', tag: 'Disease risk', title: dis.map(x => x.en).join(' and ') + ' can spread', when: humid, note: 'Humid days',
    check: cap(dis[0].part || 'leaves'), act: ['Inspect the field on these days', 'Spray only if symptoms are seen'], products: treat(dis),
    hi: `${dlistHi(humid)} को नमी ज़्यादा रहेगी। ${dis.map(x => x.hi).join(' और ')} फैल सकता है। खेत देखें, लक्षण दिखें तो ${dis[0].treat ? dis[0].treat.p : 'बचाव की दवा'} का छिड़काव करें।`});
  const pest = w.filter(x => x.type === 'pest' && x.risk === 'H' && dry(x.weather)).slice(0, 2);
  if (hd.length >= 3 && pest.length) out.push({k: 'warm', tag: 'Pest risk', title: pest.map(x => x.en).join(' and ') + ' build up', when: null, note: 'Warm and dry most of the week',
    check: cap(pest.map(x => x.part).filter(Boolean).join(', ') || 'leaves'), act: ['Check the field twice this week', 'Spray only if pests are seen'], products: treat(pest),
    hi: `मौसम गर्म और सूखा रहेगा, ${pest.map(x => x.hi).join(' और ')} बढ़ सकते हैं। इस हफ्ते दो बार खेत की जांच करें।`});
  if (heat.length) out.push({k: 'hot', tag: 'Heat', title: 'Heat above 38°C', when: heat, act: ['Irrigate in the evening', 'Spray only after 4 pm'], products: [],
    hi: `${dlistHi(heat)} को तेज़ गर्मी रहेगी। शाम को सिंचाई करें, छिड़काव शाम 4 बजे के बाद करें।`});
  if (cold.length) out.push({k: 'hot', tag: 'Frost', title: 'Frost risk', when: cold, act: ['Give light irrigation in the evening', 'Keep sulphur ready'], products: [],
    hi: `${dlistHi(cold)} को पाला पड़ सकता है। शाम को हल्की सिंचाई करें।`});
  f.b.weather.filter(o => o.tier === 1).forEach(o => out.push({k: 'soil', tag: 'Season risk (POP)', title: o.en, when: null, note: 'Likely this month',
    signs: o.signs ? cap(o.signs) : '', act: steps(o.how), products: o.products.map(p => ({p: p.p, dose: p.dose})),
    hi: `इस महीने ${o.hi} का खतरा रहता है।${o.products.length ? ' ' + o.products.map(p => p.p + ' ' + p.dose).join(' और ') + ' प्रति एकड़ दें।' : ''}`}));
  return {spray: pick('spray'), nospray: days.filter((d, i) => !fl[i].spray), lines: out};
}
const why = d => { const x = dayFlags(d); return x.windy ? 'windy' : x.rain ? 'rain' : 'unsettled' };
function advCard(a) {
  const row = (lab, v) => v ? `<dt>${lab}</dt><dd>${v}</dd>` : '';
  const when = a.when && a.when.length ? `<div class="chips">${a.when.map(d => chip('mute', wkd(d.d) + ' ' + fmt(d.d))).join('')}</div>` : (a.note ? esc(a.note) : '');
  return `<article class="adv ${a.k}"><div class="advh"><span class="advt">${esc(a.tag)}</span><h4>${esc(a.title)}${a.sub ? ` <span class="hih">${esc(a.sub)}</span>` : ''}</h4></div>
   <dl class="advd">${row('Why', a.why ? esc(a.why) : '')}${row('When', when + (a.when && a.when.length && a.note ? `<div class="rm">${esc(a.note)}</div>` : ''))}${row('Check', a.check ? esc(a.check) : '')}${row('Signs', a.signs ? esc(a.signs) : '')}
   ${row('Do', a.act && a.act.length ? `<ul>${a.act.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '')}
   ${row('Products', a.products && a.products.length ? `<div class="chips">${a.products.map(p => `<span class="chip blue"><b>${esc(p.p)}</b> · ${esc(p.dose)}/acre${p.for ? ' · for ' + esc(p.for) : ''}</span>`).join('')}</div>` : '')}</dl>
   ${a.hi ? `<p class="advhi">${esc(a.hi)}</p>` : ''}</article>`;
}
function dayCards(days) {
  const lo = Math.min(...days.map(d => d.min)), hi = Math.max(...days.map(d => d.max)), sc = v => ((v - lo) / Math.max(1, hi - lo) * 100).toFixed(1);
  return `<div class="days">${days.map(d => { const fl = dayFlags(d);
    return `<div class="dc${d.d === TODAY ? ' today' : ''}" title="${esc(WXT[d.code] || '')}, humidity ${d.hum}%, wind ${d.wind} km/h"><div class="dn">${d.d === TODAY ? 'Today' : wkd(d.d)}</div><div class="dd">${fmt(d.d)}</div>${icon(d.code)}
     <div class="t">${d.max}°<span> / ${d.min}°</span></div><div class="tbar"><i style="left:${sc(d.min)}%;right:${(100 - sc(d.max)).toFixed(1)}%"></i></div>
     <div class="r">${d.pop}% rain${d.rain ? ' · ' + d.rain + ' mm' : ''}</div><div class="sp ${fl.spray ? 'y' : 'n'}">${fl.spray ? 'Spray OK' : fl.windy ? 'Windy' : 'Rain'}</div></div>` }).join('')}</div>`;
}
const wxSrc = days => `<div class="src">${SAMPLE} Example forecast for ${fmt(days[0].d)}–${fmt(days[days.length - 1].d)}. Connect a live feed by pincode (IMD or Open-Meteo through Lens) to replace it.</div>`;

/* ================= stores, prices, products ================= */
const storeOf = f => OPS.STORE_OF[f.place.district];
const stock = (sid, p) => (OPS.STORES[sid] && OPS.STORES[sid].stock[p]) || 0;
const price = p => OPS.PRICE[p] || 0;
const sold = p => PR[p] ? !!PR[p].gk : false;

/* ================= farmers ================= */
const F = X.FM.map(f0 => {
  const f = Object.assign({}, f0, OPS.FARM[f0.id]);
  f.sowISO = f.sow || addDays(TODAY, -f.dss);
  f.b = ENG.brief({crop: f.crop, variety: f.variety, sowing_date: f.sowISO}, TODAY);
  f.cropName = f.b.crop.split('(')[0].trim(); f.cropHi = (f.b.crop.match(/\(\s*([^)]+?)\s*\)/) || [])[1] || f.cropName;
  f.place = pinInfo(f.pin); f.short = title(f.name); f.orders = f.orders || 0;
  const st = f.b.stage; f.stageEn = st.status === 'after' ? 'Harvested / past last stage' : st.row ? st.row.en : 'Stage not found';
  f.stageHi = st.row ? st.row.hi : ''; f.ended = st.status === 'after' || f.b.context.st === 'S8';
  if (!S.seen[f.id] && f.va) { S.seen[f.id] = {}; f.va.confirmed.forEach(i => S.seen[f.id][i] = true) }
  return f;
});
const FM = Object.fromEntries(F.map(f => [f.id, f]));
const stageLine = f => `${f.cropName} · ${f.b.stage.das != null ? 'day ' + f.b.stage.das + ' · ' : ''}${f.stageEn}`;

/* ================= follow-ups ================= */
function allFup() { return [...OPS.FUP, ...S.newFup].map(x => Object.assign({}, x, S.fup[x.id] || {})).filter(x => x.status !== 'done' && FM[x.f]).sort((a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0) }
const fupOf = id => allFup().filter(x => x.f === id);

/* ================= orders ================= */
const OPEN = ['Placed', 'Confirmed', 'Manifested', 'Out for delivery', 'Rescheduled'];
function allOrders() { return [...OPS.ORDERS, ...S.newOrders].map(o => Object.assign({}, o, S.ord[o.id] || {})) }
const oval = o => o.items.reduce((s, [p, q]) => s + price(p) * q, 0) * (1 - (o.disc || 0) / 100);
function oflags(o, all) {
  const out = [], st = OPS.STORES[o.store];
  if (['Manifested', 'Confirmed'].includes(o.status)) o.items.forEach(([p]) => { if (!stock(o.store, p)) out.push(['hot', `${o.status} but ${p} shows 0 at ${st.name}`]) });
  const dup = all.find(x => x !== o && x.f === o.f && OPEN.includes(x.status) && OPEN.includes(o.status) && Math.abs(diff(x.date, o.date)) <= 7 && x.items.some(([p]) => o.items.some(([q]) => q === p)));
  if (dup) out.push(['hot', 'Possible duplicate of ' + dup.id + (o.priceNote ? ' (different price)' : '')]);
  if (o.pref && o.pref > TODAY && OPEN.includes(o.status)) out.push(['blue', 'Farmer wants delivery on or after ' + fmt(o.pref) + ': no reschedule calls before']);
  if (o.status === 'Rescheduled') out.push(['warm', 'Rescheduled: tell the farmer the new date']);
  if (o.status === 'Placed' && st && st.load >= 90 && st.alt) out.push(['warm', `${st.name} at ${st.load}%: route to ${OPS.STORES[st.alt].name} (${st.altKm} km)`]);
  return out;
}
function oprio(o, fl) { let p = 0; if (o.urgent) p += 100; p += fl.filter(x => x[0] === 'hot').length * 40; if (o.pref && o.pref > addDays(TODAY, 3)) p -= 60; if (!OPEN.includes(o.status)) p -= 500; p += Math.min(20, diff(o.date, TODAY) * 2); return p }

/* ================= order history ================= */
const KIND = {fungicide: 'Fungicide', insecticide: 'Insecticide', herbicide: 'Herbicide', nutrition: 'Nutrition', biostimulant: 'Biostimulant', trap: 'Trap', adjuvant: 'Adjuvant', bactericide: 'Bactericide'};
const kindOf = p => /seed|paddy(?!.*pretila)/i.test(p) ? 'Seed' : /cattle|animal|mineral/i.test(p) ? 'Cattle' : KIND[(PR[p] || {}).t] || 'Other';
function histOf(f) {
  const past = (OPS.HIST[f.id] || []).map(o => Object.assign({src: 'lens'}, o));
  const sys = allOrders().filter(o => o.f === f.id && !OPEN.includes(o.status)).map(o => ({id: o.id, date: o.delivered || o.date, status: o.status, note: o.note, src: 'desk',
    lines: o.items.map(([p, q]) => ({p, q, amt: price(p) * q * (1 - (o.disc || 0) / 100), kind: kindOf(p)}))}));
  return [...past, ...sys].sort((a, b) => b.date.localeCompare(a.date));
}
function boughtOf(f) {
  const m = {};
  histOf(f).filter(o => o.status !== 'Returned').forEach(o => o.lines.forEach(l => { const x = m[l.p] = m[l.p] || {p: l.p, kind: l.kind || kindOf(l.p), times: 0, qty: 0, amt: 0, last: ''};
    x.times++; x.qty += l.q; x.amt += l.amt; if (o.date > x.last) x.last = o.date }));
  return Object.values(m).sort((a, b) => b.last.localeCompare(a.last) || b.amt - a.amt);
}
/* ================= ratings ================= */
function rating(f) {
  const r = Object.assign({}, OPS.RATING[f.id], S.rating[f.id] || {});
  const land = Math.min(1, f.acres / 5), buy = Math.min(1, f.orders / 6);
  const sc = Math.round(100 * (.25 * (r.interest - 1) / 4 + .25 * (r.trust - 1) / 4 + .15 * (r.resp - 1) / 4 + .15 * land + .20 * buy));
  const role = OPS.RATERS[r.by][1];
  return Object.assign(r, {land, buy, sc, band: sc >= 60 ? 'Strong' : sc >= 38 ? 'Possible' : 'Weak', role, needsSenior: !r.confirmed && role !== 'Senior'});
}

/* ================= recommendations (Gramik Lens products) ================= */
function recs(f) {
  const b = f.b, seen = S.seen[f.id] || {};
  const sel = {nut: b.nutrition.filter(o => o.tier === 1 && o.id !== 'N_STOP').map(o => o.id), wx: b.weather.filter(o => o.tier === 1).map(o => o.id),
    weed: b.weeds.filter(o => o.tier === 1).map(o => o.id), cure: Object.keys(seen).filter(k => seen[k]), skip: [], extra: []};
  if (f.ended) return {now: [], later: []};
  return ENG.focus(b.context, sel, {weights: X.FW});
}
function popProducts(f) {
  const txt = norm(f.b.stage.rows.map(r => r.prod || '').join(' '));
  return Object.keys(PR).filter(p => sold(p) && norm(p).length > 3 && txt.includes(norm(p)));
}

/* ================= navigation ================= */
let STG = null;
let VIEW = 'today', CUR = null, FTAB = 'crop', DFILT = 'all', OPEN_FORM = null, FSEARCH = '', FDIST = '', FCROP = '';
const NAV = [['today', 'Today'], ['farmers', 'Farmers'], ['orders', 'Orders']];
function counts() {
  const fu = allFup(), ord = allOrders(), od = fu.filter(x => x.due < TODAY).length;
  const watch = ord.filter(o => OPEN.includes(o.status) && (o.urgent || oflags(o, ord).some(x => x[0] === 'hot'))).length;
  return {od, dueToday: fu.filter(x => x.due === TODAY).length, fu: fu.filter(x => x.due <= TODAY).length, watch};
}
function go(v, id, tab) { VIEW = v; if (id !== undefined && id !== CUR) { CUR = id; STG = null } if (tab) FTAB = tab; OPEN_FORM = null; render(); window.scrollTo(0, 0) }
function rail() {
  const c = counts(), badge = {today: [c.fu, c.od ? 'hot' : ''], orders: [c.watch, c.watch ? 'hot' : '']};
  $('rail').innerHTML = NAV.map(([k, l]) => { const bd = badge[k]; const cur = VIEW === k || (VIEW === 'farmer' && k === 'farmers');
    return `<button class="nb" type="button" data-go="${k}"${cur ? ' aria-current="page"' : ''}>${l}${bd && bd[0] ? `<b class="${bd[1]}">${bd[0]}</b>` : ''}</button>` }).join('') +
    `<div class="railnote">Lucknow hub · ${F.length} farmers</div>`;
}
function topbar() {
  $('today').textContent = dt(TODAY).toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}) + ' · Lucknow hub';
}
function render() {
  topbar(); rail();
  const v = $('view');
  v.innerHTML = VIEW === 'today' ? vToday() : VIEW === 'farmers' ? vFarmers() : VIEW === 'farmer' ? vFarmer() : vOrders();
  $('fab').hidden = VIEW !== 'farmer';
  if (VIEW === 'farmer') $('fab').textContent = 'Products for ' + FM[CUR].short.split(' ')[0];
}

/* ================= Today ================= */
function fupRow(x) {
  const f = FM[x.f], late = x.due < TODAY, open = OPEN_FORM && OPEN_FORM.id === x.id;
  let form = '';
  if (open && OPEN_FORM.kind === 'done') form = `<div class="inline"><div class="form">
    <label class="field"><span>How did you reach them</span><select id="fd-ch"><option>Call</option><option>WhatsApp</option><option>Visit</option></select></label>
    <label class="field"><span>Outcome</span><select id="fd-out">${OUTS.map(o => `<option>${o}</option>`).join('')}</select></label>
    <label class="field"><span>Next follow-up (optional)</span><input type="date" id="fd-next" min="${TODAY}"></label>
    <label class="field wide"><span>What was decided</span><textarea id="fd-note" placeholder="Final outcome, so the team does not need WhatsApp to know it"></textarea></label></div>
    <div class="acts" style="margin-top:8px"><button class="btn sm" data-act="fdone" data-id="${x.id}">Save and close</button><button class="btn ghost sm" data-act="cancel">Cancel</button></div></div>`;
  if (open && OPEN_FORM.kind === 'move') form = `<div class="inline"><div class="form">
    <label class="field"><span>New date</span><input type="date" id="fm-date" min="${TODAY}" value="${addDays(TODAY, 1)}"></label>
    <label class="field"><span>Reason</span><select id="fm-why"><option>Farmer not reachable</option><option>Farmer asked for later</option><option>Field visit clashed</option><option>Waiting for delivery</option><option>Other</option></select></label></div>
    <div class="acts" style="margin-top:8px"><button class="btn sm" data-act="fmove" data-id="${x.id}">Reschedule</button><button class="btn ghost sm" data-act="cancel">Cancel</button></div></div>`;
  return `<li><div><div class="rn"><button class="lk" data-farmer="${f.id}">${esc(f.short)}</button> <span class="rm">${esc(f.place.place)} · ${esc(f.pin)}</span></div>
    <div class="rm">${esc(stageLine(f))}</div><div class="rw">${esc(x.why)}</div>
    <div class="chips" style="margin-top:4px">${chip(late ? 'solid' : x.due === TODAY ? 'warm' : 'mute', relDue(x.due))}${chip('mute', 'Set by ' + x.by)}${x.moved ? chip('warm', 'Moved ' + x.moved + '×' + (x.lastWhy ? ': ' + x.lastWhy : '')) : ''}</div></div>
    <div class="rr"><div class="acts"><button class="btn sm" data-act="fdoneopen" data-id="${x.id}">Done</button><button class="btn ghost sm" data-act="fmoveopen" data-id="${x.id}">Reschedule</button></div></div>${form}</li>`;
}
const OUTS = ['Resolved', 'Product recommended', 'Ordered', 'Follow-up needed', 'Not reachable', 'Not interested'];
function vToday() {
  const c = counts(), fu = allFup(), od = fu.filter(x => x.due < TODAY), td = fu.filter(x => x.due === TODAY), nx = fu.filter(x => x.due > TODAY && x.due <= addDays(TODAY, 7));
  const ords = allOrders(), watch = ords.map(o => ({o, fl: oflags(o, ords)})).filter(x => OPEN.includes(x.o.status) && (x.o.urgent || x.fl.some(z => z[0] === 'hot'))).sort((a, b) => oprio(b.o, b.fl) - oprio(a.o, a.fl));
  const kp = (cls, n, l, go) => `<button class="kpi ${cls}" type="button" data-go="${go}"><b>${n}</b><span>${l}</span></button>`;
  return `<div class="kpis">${kp(c.od ? 'hot' : 'ok', c.od, 'Overdue follow-ups', 'today')}${kp('warm', c.dueToday, 'Follow-ups due today', 'today')}${kp(c.watch ? 'hot' : 'ok', c.watch, 'Orders to watch', 'orders')}</div>
  <div class="grid2"><div class="stack">
   <section class="card"><h2>Follow-ups <small>Overdue ones stay here until you close or reschedule them</small></h2>
    ${od.length ? `<div class="gh hot">Overdue · ${od.length}</div><ul class="rows">${od.map(fupRow).join('')}</ul>` : ''}
    <div class="gh">Today · ${td.length}</div>${td.length ? `<ul class="rows">${td.map(fupRow).join('')}</ul>` : '<p class="empty">Nothing else due today.</p>'}
    ${nx.length ? `<div class="gh">Next 7 days · ${nx.length}</div><ul class="rows">${nx.map(fupRow).join('')}</ul>` : ''}</section>
  </div><div class="stack">
   <section class="card"><h2>Orders to watch ${SAMPLE}</h2><p class="sub">Urgent orders and orders with a stock or duplicate problem.</p>
    ${watch.length ? `<ul class="rows">${watch.slice(0, 5).map(({o, fl}) => `<li><div><div class="rn"><button class="lk" data-farmer="${o.f}" data-tab="orders">${esc(FM[o.f].short)}</button> <span class="rm">${o.id}</span></div>
      <div class="rm">${o.items.map(([p, q]) => q + ' × ' + p).join(', ')}</div><div class="chips" style="margin-top:4px">${o.urgent ? chip('solid', 'Urgent') : ''}${fl.map(([k, t]) => chip(k, t)).join('')}</div></div>
      <div class="rr"><span class="st ${o.status.split(' ')[0]}">${o.status}</span></div></li>`).join('')}</ul>` : '<p class="empty">No order needs attention.</p>'}
    <button class="lk" data-go="orders">All orders and delivery priority</button></section>
  </div></div>`;
}
/* ================= Farmers list ================= */
function vFarmers() {
  const dists = [...new Set(F.map(f => f.place.district))].sort(), crops = [...new Set(F.map(f => f.cropName))].sort();
  const q = FSEARCH.toLowerCase(), ords = allOrders();
  const L = F.filter(f => (!q || (f.name + ' ' + f.pin + ' ' + f.id + ' ' + f.village).toLowerCase().includes(q)) && (!FDIST || f.place.district === FDIST) && (!FCROP || f.cropName === FCROP));
  return `<div class="pagehead"><div><h2>Farmers</h2><p>${L.length} of ${F.length} · open a farmer for crop plan, orders, cattle, log and rating</p></div>
   <div class="acts"><input type="search" id="fsearch" placeholder="Name, pincode or ID" value="${esc(FSEARCH)}" aria-label="Search farmers">
   <select id="fdist" aria-label="District"><option value="">All districts</option>${dists.map(d => `<option${d === FDIST ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select>
   <select id="fcrop" aria-label="Crop"><option value="">All crops</option>${crops.map(d => `<option${d === FCROP ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select></div></div>
  <section class="card"><div class="tw2"><table><thead><tr><th>Farmer</th><th>Crop and stage</th><th>Pincode</th><th>Rating</th><th>Last order</th><th>Next follow-up</th><th>Open orders</th></tr></thead><tbody>
  ${L.map(f => { const r = rating(f), fu = fupOf(f.id)[0], oo = ords.filter(o => o.f === f.id && OPEN.includes(o.status));
    return `<tr><td><button class="lk" data-farmer="${f.id}">${esc(f.short)}</button><div class="rm">${esc(f.village)}, ${esc(f.district)} · ${f.acres} ac</div>
     <div class="chips">${f.sample ? SAMPLE : chip('ok', 'Lens ' + f.id)}${OPS.DUP[f.id] ? chip('hot', 'Possible duplicate') : ''}${(OPS.CATTLE[f.id] || S.cattle[f.id]) ? chip('soil', 'Cattle') : ''}${f.va ? chip('violet', 'AI call') : ''}</div></td>
     <td>${esc(f.cropName)} <span class="rm">${esc(f.variety)}</span><div class="rm">${esc(f.b.stage.das != null ? 'Day ' + f.b.stage.das + ' · ' : '')}${esc(f.stageEn)}</div></td>
     <td class="num">${esc(f.pin)}</td><td><span class="chip ${r.band === 'Strong' ? 'ok' : r.band === 'Possible' ? 'warm' : 'mute'}">${r.sc} · ${r.band}</span>${r.needsSenior ? '<div class="rm">needs senior check</div>' : ''}</td>
     <td>${(() => { const h = histOf(f)[0]; return h ? `<span class="num">${fmt(h.date)}</span><div class="rm">${diff(h.date, TODAY)} days ago</div>` : '<span class="muted small">Never</span>' })()}</td>
     <td>${fu ? `<span class="chip ${fu.due < TODAY ? 'solid' : fu.due === TODAY ? 'warm' : 'mute'}">${relDue(fu.due)}</span>` : '<span class="muted small">None set</span>'}</td>
     <td class="n">${oo.length || '–'}</td></tr>` }).join('')}</tbody></table></div></section>`;
}

/* ================= Farmer page ================= */
function vFarmer() {
  const f = FM[CUR]; if (!f) return '<p class="empty">Farmer not found.</p>';
  const r = rating(f), info = f.place, days = forecast(info), w = days ? cropWx(f, days) : null, st = f.b.stage;
  const cat = [...(OPS.CATTLE[f.id] || []), ...(S.cattle[f.id] || [])], logs = logsOf(f.id), ords = allOrders().filter(o => o.f === f.id);
  const tabs = [['crop', 'Crop plan', ''], ['orders', 'Orders', histOf(f).length + ords.filter(o => OPEN.includes(o.status)).length || ''], ['cattle', 'Cattle', cat.length || ''], ['log', 'Interactions', logs.length || ''], ['rating', 'Rating', r.sc]];
  const dup = OPS.DUP[f.id], fu = fupOf(f.id)[0];
  const body = FTAB === 'crop' ? tCrop(f) : FTAB === 'orders' ? tOrders(f, ords) : FTAB === 'cattle' ? tCattle(f, cat) : FTAB === 'log' ? tLog(f, logs) : tRating(f, r);
  return `<button class="lk" data-go="farmers" style="margin-bottom:8px">← All farmers</button>
  <section class="card"><div class="fhead"><div><h2>${esc(f.short)}</h2>
    <div class="facts"><span>${esc(f.village)}, ${esc(f.district)}</span><span>Pincode <b class="num">${esc(f.pin)}</b></span><span><b class="num">${f.acres}</b> acres</span><span>Phone <b class="num">${esc(f.phone)}</b> <button class="lk small" data-copy="${esc(f.phone)}">Copy</button></span><span>BSO <b>${esc((OPS.BSOS.find(b => b.id === f.bso) || {}).name || '–')}</b></span></div>
    <div class="chips" style="margin-top:6px">${f.sample ? SAMPLE : chip('ok', 'Lens ID ' + f.id)}${(() => { const ok = histOf(f).filter(o => o.status !== 'Returned'); return ok.length ? chip('blue', ok.length + ' orders · ' + rupee(ok.reduce((t, o) => t + o.lines.reduce((u, l) => u + l.amt, 0), 0))) : chip('mute', 'No orders yet') })()}${(OPS.IVR[f.id] || []).map(x => chip('violet', 'IVR heard: ' + x)).join('')}${fu ? chip(fu.due < TODAY ? 'solid' : 'warm', 'Follow-up ' + relDue(fu.due)) : ''}</div>
    ${dup ? `<p class="note hot" style="margin-top:8px">Possible duplicate record: Lens ID ${esc(dup.id)}. ${esc(dup.why)}. Merge before creating orders.</p>` : ''}</div>
   <div style="display:flex;gap:12px;align-items:center"><div class="score ${r.band}" title="Rating">${r.sc}</div><div class="small"><b>${r.band}</b> lead<br><span class="muted">${r.needsSenior ? 'Needs senior check' : 'Checked by ' + esc(OPS.RATERS[r.by][0])}</span></div></div></div>
   <div class="acts" style="margin-top:12px"><button class="btn" data-act="drawer">Products (Lens)</button><button class="btn ghost" data-tab="log" data-act="tab">Log outcome</button><button class="btn ghost" data-act="tab" data-tab="log">Schedule follow-up</button></div></section>
  <section class="card"><div class="wxhead"><h2>Weather and crop advice <small>${esc(info.place)} ${esc(f.pin)} · ${esc(f.cropName)}, ${esc(f.stageEn.toLowerCase())}</small></h2>
   ${days ? `<button class="btn ghost sm" data-act="wxmsg" data-id="${f.id}">Copy Hindi advice for WhatsApp</button>` : ''}</div>
   ${days ? dayCards(days) + `<div class="sprayrow"><div><span class="sl">Spray on</span><div class="chips">${w.spray.length === days.length ? chip('ok', 'All 7 days') : w.spray.length ? w.spray.map(d => chip('ok', wkd(d.d) + ' ' + fmt(d.d))).join('') : chip('warm', 'No good spray day this week')}</div></div>
     ${w.nospray.length ? `<div><span class="sl">Avoid</span><div class="chips">${w.nospray.map(d => chip('warm', wkd(d.d) + ' ' + fmt(d.d) + ' · ' + why(d))).join('')}</div></div>` : ''}</div>
   ${w.lines.length ? `<div class="advs">${w.lines.map(advCard).join('')}</div>` : '<p class="note" style="margin-top:10px">No weather risk for this crop in the next 7 days.</p>'}${wxSrc(days)}` : `<p class="note warm">${esc(info.err || 'No forecast for this pincode.')}</p>`}</section>
  <section class="card"><div class="tabs" role="tablist">${tabs.map(([k, l, n]) => `<button class="tab" role="tab" type="button" data-act="tab" data-tab="${k}" aria-selected="${FTAB === k}">${l}${n !== '' ? `<b>${n}</b>` : ''}</button>`).join('')}</div><div style="margin-top:12px">${body}</div></section>`;
}
/* order history placed on the crop's POP stages: what was bought in each stage vs what the POP asked for */
function stageOf(f, date) { const s = ENG.stageFor(f.b.cropKey, f.b.variety.variety, f.sowISO, date); return s.status === 'before' ? -1 : (s.status === 'after' || s.idx == null) ? 99 : s.idx }
function stageHist(f) {
  const rows = f.b.stage.rows, cur = f.b.stage.status === 'after' ? rows.length : f.b.stage.idx;
  const G = rows.map((r, i) => ({i, r, orders: [], pop: (r.prod || '').split(/;|\n/).map(x => x.trim()).filter(Boolean)})), pre = [], post = [];
  histOf(f).slice().reverse().forEach(o => { const k = stageOf(f, o.date); (k === -1 ? pre : k === 99 ? post : G[k].orders).push(o) });
  const same = (a, b) => a === b || a.includes(b) || b.includes(a);
  const season = histOf(f).filter(o => o.status !== 'Returned' && o.date >= addDays(f.sowISO, -15)).flatMap(o => o.lines.map(l => ({n: norm(l.p), d: o.date})));
  G.forEach(g => { const got = g.orders.filter(o => o.status !== 'Returned').flatMap(o => o.lines.map(l => norm(l.p)));
    g.state = g.i < cur ? 'past' : g.i === cur ? 'cur' : 'next';
    g.popx = g.pop.map(p => { const n = norm(p), here = got.some(x => same(x, n)), other = season.filter(x => same(x.n, n)).map(x => x.d).sort().pop();
      return {p, got: here, other: !here && other ? other : null} }) });
  return {G, pre, post, cur};
}
function stageDates(f, r) {
  if (r.cs && r.ce) return fmt(r.cs) + ' – ' + fmt(r.ce);
  if (r.a == null || r.b == null || r.b < r.a) return r.a != null ? 'from day ' + r.a : '';
  return 'day ' + r.a + '–' + r.b + ' · ' + fmt(addDays(f.sowISO, r.a)) + ' – ' + fmt(addDays(f.sowISO, r.b));
}
function prevOrders(f) {
  const H = histOf(f), ok = H.filter(o => o.status !== 'Returned'), amt = o => o.lines.reduce((u, l) => u + l.amt, 0);
  const {G, pre, post} = stageHist(f), done = G.filter(g => g.state !== 'next');
  const popAll = done.flatMap(g => g.popx), popGot = popAll.filter(x => x.got || x.other).length;
  const oline = o => `<li><span class="pod num">${fmt(o.date)}</span><span class="pop2">${o.lines.map(l => `${esc(l.p)} <span class="muted">× ${l.q}</span>`).join(', ')}</span><span class="poa num">${rupee(amt(o))}</span><span class="st ${o.status}">${esc(o.status)}</span></li>`;
  const popChips = g => g.popx.length ? `<div class="chips sgp"><span class="sl">POP</span>${g.popx.map(x => chip(x.got ? 'ok' : x.other ? 'sky' : g.state === 'past' ? 'warm' : g.state === 'cur' ? 'blue' : 'mute', (x.got || x.other ? '✓ ' : '') + x.p + (x.got ? '' : x.other ? ' · bought ' + fmt(x.other) : g.state === 'past' ? ' · missed' : g.state === 'cur' ? ' · due now' : ''))).join('')}</div>` : '';
  const stg = g => `<li class="sg ${g.state}"><div class="sgh"><b>${esc(g.r.en)}</b><span class="rm">${esc(stageDates(f, g.r))}</span>${g.state === 'cur' ? chip('green', 'Current stage') : ''}${g.orders.length ? chip('blue', g.orders.length + (g.orders.length === 1 ? ' order · ' : ' orders · ') + rupee(g.orders.reduce((t, o) => t + amt(o), 0))) : ''}</div>
    ${g.orders.length ? `<ul class="po">${g.orders.map(oline).join('')}</ul>` : g.state !== 'next' ? '<p class="rm" style="margin:2px 0 0">No order in this stage</p>' : ''}${popChips(g)}</li>`;
  const extra = (lab, L) => L.length ? `<li class="sg past"><div class="sgh"><b>${lab}</b>${chip('blue', L.length + (L.length === 1 ? ' order' : ' orders'))}</div><ul class="po">${L.map(oline).join('')}</ul></li>` : '';
  const nexts = G.filter(g => g.state === 'next');
  return `<section class="card"><div class="wxhead"><h2>Order history by stage <small>${H.length ? `${ok.length} delivered · ${rupee(ok.reduce((t, o) => t + amt(o), 0))} spent · last ${fmt(H[0].date)} (${diff(H[0].date, TODAY)} days ago)` : 'No orders yet'}</small></h2>
   ${H.length ? '<button class="lk" data-act="tab" data-tab="orders">Full history</button>' : ''}</div>
   ${popAll.length ? `<p class="rm" style="margin:4px 0 0">POP products bought so far this season: <b>${popGot} of ${popAll.length}</b> · <span class="chip ok">✓ bought in stage</span> <span class="chip sky">✓ bought in another stage</span> <span class="chip warm">missed</span> <span class="chip blue">due now</span></p>` : ''}
   <ul class="sgl">${extra('Before this crop was sown', pre)}${done.map(stg).join('')}${extra('After the last stage', post)}</ul>
   ${nexts.length ? `<details style="margin-top:8px"><summary>Upcoming stages (${nexts.length}) and their POP products</summary><ul class="sgl">${nexts.map(stg).join('')}</ul></details>` : ''}</section>`;
}
/* ================= stage band: tap a stage to see what was ordered in it (uses stageHist above) ================= */
function bandRange(f, r) {
  if (f.b.stage.isCal) return stageDates(f, r);
  return fmt(addDays(f.sowISO, r.a)) + (r.b >= r.a ? ' – ' + fmt(addDays(f.sowISO, r.b)) + ' · day ' + r.a + '–' + r.b : ' onward · from day ' + r.a);
}
function stageBand(f) {
  const H = stageHist(f), G = H.G, cur = f.b.stage.idx, sel = STG == null ? cur : STG;
  const cnt = k => k === 'pre' ? H.pre.length : k === 'post' ? H.post.length : G[k].orders.length;
  const seg = (k, name, cls, grow) => { const n = cnt(k), on = String(sel) === String(k);
    return `<button type="button" class="seg ${cls}${on ? ' sel' : ''}" data-act="stg" data-k="${k}" style="flex-grow:${grow}" aria-pressed="${on}">
    <span class="sgn">${esc(name)}</span>${cls === 'future' ? '' : n ? `<span class="sgc">${n} order${n > 1 ? 's' : ''}</span>` : '<span class="sgc none">no orders</span>'}</button>` };
  return `<div class="bandwrap"><div class="stagebar">${H.pre.length ? seg('pre', 'Before sowing', 'pre', 6) : ''}${G.map(g => seg(g.i, g.r.en, g.state === 'cur' ? 'cur' : g.state === 'past' ? 'past' : 'future', f.b.stage.isCal ? 10 : Math.max(6, Math.abs(g.r.b - g.r.a) + 1))).join('')}${H.post.length ? seg('post', 'After last stage', 'pre', 6) : ''}</div></div>
   <div class="bandkey"><span><i class="k past"></i>Past</span><span><i class="k cur"></i>Current</span><span><i class="k future"></i>Upcoming</span><span class="muted">Tap a stage to see what was ordered in it</span></div>` + stagePanel(f, sel, H);
}
/* the engine's top picks for a stage (max 3, Gramik products): the current stage uses this farmer's live picks */
function stageTop(f, i) {
  if (i === f.b.stage.idx) return recs(f).now.map(x => x.product).filter(sold).slice(0, 3);
  const b = f.b, r = b.stage.rows[i];
  try {
    const st = ENG.stageFor(b.cropKey, b.variety.variety, f.sowISO, b.stage.isCal ? TODAY : addDays(f.sowISO, Math.max(0, r.a)), b.stage.track), c = ENG.context(b.cropKey, st);
    const sel = {nut: ENG.nutrition(c).filter(o => o.tier === 1 && o.id !== 'N_STOP').map(o => o.id), wx: [], weed: ENG.weeds(c).filter(o => o.tier === 1).map(o => o.id), cure: [], skip: [], extra: []};
    return ENG.focus(c, sel, {weights: X.FW}).now.map(x => x.product).filter(sold).slice(0, 3);
  } catch (e) { return [] }
}
function stagePanel(f, k, H) {
  const amt = o => o.lines.reduce((u, l) => u + l.amt, 0);
  if (k === 'pre' || k === 'post') return `<div class="stp"><div class="stph"><h4>${k === 'pre' ? 'Before sowing' : 'After the last stage'}</h4></div>${stpOrders(f, k === 'pre' ? H.pre : H.post, amt)}</div>`;
  const g = H.G[+k], state = g.state === 'cur' ? 'Current' : g.state === 'past' ? 'Past' : 'Upcoming';
  const head = `<div class="stph"><h4>${esc(g.r.en)} <span class="hih">${esc(g.r.hi || '')}</span></h4>${chip(state === 'Current' ? 'green' : state === 'Past' ? 'mute' : 'blue', state)}<span class="rm">${esc(bandRange(f, g.r))}</span></div>`;
  if (g.state === 'next') { const from = f.b.stage.isCal ? null : addDays(f.sowISO, g.r.a);
    return `<div class="stp future">${head}<p class="stpe">Upcoming stage${from ? ', starts ' + fmt(from) + ' (' + relDue(from) + ')' : ''}. Nothing ordered yet.</p></div>` }
  return `<div class="stp">${head}${stpOrders(f, g.orders, amt)}
   ${(() => { const top = stageTop(f, g.i); if (!top.length) return '';
     const same = (a, b) => a === b || a.includes(b) || b.includes(a), got = g.orders.filter(o => o.status !== 'Returned').flatMap(o => o.lines.map(l => norm(l.p)));
     const season = histOf(f).filter(o => o.status !== 'Returned' && o.date >= addDays(f.sowISO, -15)).flatMap(o => o.lines.map(l => ({n: norm(l.p), d: o.date})));
     return `<div class="stpp"><span class="sl">Most recommended</span><div class="chips">${top.map(p => { const n = norm(p), here = got.some(x => same(x, n)), other = here ? null : season.filter(x => same(x.n, n)).map(x => x.d).sort().pop();
       return chip(here ? 'ok' : other ? 'sky' : g.state === 'past' ? 'warm' : 'blue', (here || other ? '✓ ' : '') + p + (here ? '' : other ? ' · bought ' + fmt(other) : g.state === 'past' ? ' · missed' : ' · due now')) }).join('')}</div></div>` })()}</div>`;
}
function stpOrders(f, list, amt) {
  if (!list.length) return '<p class="stpe">No orders in this stage.</p>';
  const tot = list.filter(o => o.status !== 'Returned').reduce((t, o) => t + amt(o), 0);
  return `<ul class="po">${list.map(o => `<li><span class="pod num">${fmt(o.date)}${f.b.stage.isCal ? '' : `<br><span class="small">day ${diff(f.sowISO, o.date)}</span>`}</span><span class="pop2">${o.lines.map(l => `${esc(l.p)} <span class="muted">× ${l.q}</span>`).join(', ')}</span>
    <span class="poa num">${rupee(amt(o))}</span><span class="st ${o.status.split(' ')[0]}">${esc(o.status)}</span></li>`).join('')}</ul>
   <p class="rm" style="margin:4px 0 0">${list.length} order${list.length > 1 ? 's' : ''} · ${rupee(tot)} in this stage</p>`;
}
function tCrop(f) {
  const st = f.b.stage, rows = st.rows, seen = S.seen[f.id] || {};
  const bar = stageBand(f);
  const nut = f.b.nutrition.filter(o => o.tier === 1 && o.id !== 'N_STOP');
  return `<div class="stagebig">${st.das != null ? `<b>Day ${st.das}</b>` : ''}<span class="sn">${esc(f.stageEn)}</span><span class="sh">${esc(f.stageHi)}</span>${st.daysLeft != null && st.status !== 'after' ? chip('mute', st.daysLeft + ' days left in this stage') : ''}</div>
  <div class="rm" style="margin-top:4px">${esc(f.b.crop)} · ${esc(f.variety)}${f.b.variety.exact ? '' : ' (POP plan of ' + esc(f.b.variety.variety) + ')'} · sown ${fmt(f.sowISO)}</div>${bar}
  ${f.ended ? `<p class="note warm" style="margin-top:10px">Crop is near or past harvest. Ask about the next crop and plan seed treatment and basal dose.</p>` : ''}
  ${watchBlocks(f)}
  ${nut.length ? `<section class="blk"><div class="blkh"><h3>Must-do nutrition</h3>${chip('green', nut.length + '')}</div><div class="advs">${nut.map(o => advCard({k: 'leaf', tag: 'Must do', title: o.en, sub: o.hi,
    why: o.why ? cap(o.why) : '', act: steps(o.how), products: o.products.map(p => ({p: p.p, dose: p.dose}))})).join('')}</div></section>` : ''}
  ${st.row && st.row.pop ? `<details style="margin-top:10px"><summary>POP text for this stage (Hindi)</summary><div class="pop">${esc(st.row.pop)}</div></details>` : ''}`;
}
const RISK = {H: ['hot', 'High risk'], M: ['warm', 'Medium risk'], L: ['leaf', 'Low risk']};
const BLK = [['disease', 'Diseases', 'Check after humid or rainy days'], ['pest', 'Pests', 'Check the plant parts listed on each card'], ['weed', 'Weeds', ''], ['other', 'Other problems', '']];
function watchBlocks(f) {
  const seen = S.seen[f.id] || {}, L = f.b.watch.slice(0, 12).sort((a, b) => 'HML'.indexOf(a.risk) - 'HML'.indexOf(b.risk));
  if (!L.length) return '<p class="empty">No watch list for this stage.</p>';
  const grp = k => L.filter(x => k === 'other' ? !['disease', 'pest', 'weed'].includes(x.type) : x.type === k);
  return `<p class="sub" style="margin-top:14px">Tick <b>Seen in field</b> when the farmer or BSO confirms a problem. Its cure product moves to the top of Products.</p>` +
   BLK.map(([k, lab, sub]) => { const g = grp(k); if (!g.length) return '';
    return `<section class="blk"><div class="blkh"><h3>${lab}</h3>${chip('mute', g.length + '')}${g.filter(x => seen[x.id]).length ? chip('hot', g.filter(x => seen[x.id]).length + ' seen') : ''}${sub ? `<span class="rm">${sub}</span>` : ''}</div>
     <div class="advs">${g.map(x => issueCard(f, x, !!seen[x.id])).join('')}</div></section>` }).join('');
}
function issueCard(f, x, on) {
  const r = RISK[x.risk] || RISK.L, row = (lab, v) => v ? `<dt>${lab}</dt><dd>${v}</dd>` : '';
  const pc = (p, alt) => `<span class="chip ${alt ? 'mute' : 'blue'}"><b>${esc(p.p)}</b> · ${esc(p.dose)}/acre</span>`;
  return `<article class="adv ${r[0]}${on ? ' on' : ''}"><div class="advh"><span class="advt">${r[1]}${x.isNew ? ' · New this stage' : ''}</span><h4>${esc(x.en)} <span class="hih">${esc(x.hi)}</span></h4></div>
   <dl class="advd">${row('Symptom', esc(cap(x.symptom || '')))}${row('Check', esc(cap(x.part || '')))}${row('Weather', esc(x.weather || ''))}
   ${row('Cure', x.treat ? pc(x.treat) + (x.treat.note ? `<div class="rm">${esc(x.treat.note)}</div>` : '') : '')}${row('Or', x.alt ? pc(x.alt, true) : '')}</dl>
   <label class="seenck"><input type="checkbox" data-act="seen" data-id="${f.id}" data-issue="${x.id}"${on ? ' checked' : ''}> Seen in field${f.va && f.va.confirmed.includes(x.id) ? ' <span class="chip violet">confirmed on AI call</span>' : ''}</label></article>`;
}
function tOrders(f, ords) {
  const all = allOrders(), sid = storeOf(f), s = OPS.STORES[sid], open = ords.filter(o => OPEN.includes(o.status));
  const H = histOf(f), ok = H.filter(o => o.status !== 'Returned'), spent = ok.reduce((t, o) => t + o.lines.reduce((u, l) => u + l.amt, 0), 0);
  const B = boughtOf(f), recNow = new Set(recs(f).now.map(x => x.product)), last = H[0];
  const stat = (v, l) => `<div class="hs"><b class="num">${v}</b><span>${l}</span></div>`;
  return `<p class="note${s.load >= 90 ? ' warm' : ''}">Serving store: <b>${esc(s.name)}</b> at <b class="num">${s.load}%</b> capacity${s.load >= 90 && s.alt ? `. New orders should go to ${esc(OPS.STORES[s.alt].name)} (${s.altKm} km).` : '.'} ${SAMPLE}</p>
  <section class="blk"><div class="blkh"><h3>Current orders</h3>${chip('mute', open.length + '')}</div>
   ${open.length ? `<ul class="rows" style="margin-top:4px">${open.sort((a, b) => b.date.localeCompare(a.date)).map(o => orderRow(o, all, true)).join('')}</ul>` : '<p class="empty">No open orders.</p>'}</section>
  <section class="blk"><div class="blkh"><h3>Order history</h3>${chip('mute', H.length + '')}</div>
   ${H.length ? `<div class="hstats">${stat(ok.length, 'orders delivered')}${stat(rupee(spent), 'total spent')}${stat(ok.length ? rupee(spent / ok.length) : '–', 'average order')}${stat(fmt(last.date), 'last order · ' + diff(last.date, TODAY) + ' days ago')}</div>
   <div class="tw2"><table><thead><tr><th>Date</th><th>Stage</th><th>Order</th><th>Products</th><th class="n">Amount</th><th>Status</th></tr></thead><tbody>
   ${H.map(o => { const k = stageOf(f, o.date); return `<tr><td class="num" style="white-space:nowrap">${fmt(o.date)}</td><td class="small">${k === -1 ? 'Before this crop' : k === 99 ? 'After last stage' : esc(f.b.stage.rows[k].en)}</td><td class="num small">${esc(o.id)}</td>
     <td>${o.lines.map(l => `<div>${esc(l.p)} <span class="muted">× ${l.q}</span></div>`).join('')}${o.note ? `<div class="rm">${esc(o.note)}</div>` : ''}</td>
     <td class="n">${rupee(o.lines.reduce((u, l) => u + l.amt, 0))}</td><td><span class="st ${o.status}">${esc(o.status)}</span></td></tr>` }).join('')}</tbody></table></div>` : '<p class="empty">No previous orders. This farmer has not bought from Gramik yet.</p>'}</section>
  ${B.length ? `<section class="blk"><div class="blkh"><h3>Products bought</h3>${chip('mute', B.length + '')}<span class="rm">What the farmer already uses. Green rows are recommended again at this stage.</span></div>
   <div class="tw2"><table><thead><tr><th>Product</th><th>Type</th><th class="n">Times</th><th class="n">Qty</th><th class="n">Spent</th><th>Last bought</th></tr></thead><tbody>
   ${B.map(b => `<tr${recNow.has(b.p) ? ' class="rec"' : ''}><td><b>${esc(b.p)}</b>${recNow.has(b.p) ? ' ' + chip('green', 'Recommended now') : ''}</td><td>${chip(b.kind === 'Cattle' ? 'soil' : b.kind === 'Seed' ? 'ok' : 'mute', b.kind)}</td>
     <td class="n">${b.times}</td><td class="n">${b.qty}</td><td class="n">${rupee(b.amt)}</td><td class="num" style="white-space:nowrap">${fmt(b.last)} <span class="rm">· ${diff(b.last, TODAY)} d ago</span></td></tr>`).join('')}</tbody></table></div></section>` : ''}
  ${(OPS.HIST[f.id] || []).length ? `<p class="src">${f.sample ? SAMPLE + ' Example history.' : 'Products, order count, total spent and last order date come from Lens. How products split across orders, and earlier order dates, are reconstructed until Lens shares order lines.'}</p>` : ''}`;
}
function orderRow(o, all, inFarmer) {
  const fl = oflags(o, all), f = FM[o.f], edit = OPEN_FORM && OPEN_FORM.kind === 'ord' && OPEN_FORM.id === o.id;
  return `<li><div><div class="rn">${inFarmer ? esc(o.id) : `<button class="lk" data-farmer="${o.f}" data-tab="orders">${esc(f.short)}</button> <span class="rm">${esc(o.id)}</span>`} <span class="rm">· ${fmt(o.date)} · ${esc(OPS.STORES[o.store].name)}</span></div>
   <div class="rw">${o.items.map(([p, q]) => q + ' × ' + esc(p)).join(', ')} · <b class="num">${rupee(oval(o))}</b></div>
   <div class="chips" style="margin-top:4px">${o.urgent ? chip('solid', 'Urgent' + (o.urgentWhy ? ': ' + o.urgentWhy : '')) : ''}${fl.map(([k, t]) => chip(k, t)).join('')}${o.note ? chip('mute', o.note) : ''}</div>
   ${edit ? `<div class="inline"><div class="form"><label class="field"><span>Farmer's preferred delivery date</span><input type="date" id="oe-pref" value="${esc(o.pref || '')}" min="${TODAY}"></label>
     <label class="ck"><input type="checkbox" id="oe-urg"${o.urgent ? ' checked' : ''}> Urgent</label><label class="field wide"><span>Why urgent</span><input type="text" id="oe-why" value="${esc(o.urgentWhy || '')}" placeholder="e.g. disease spreading, spray needed this week"></label></div>
     <div class="acts" style="margin-top:8px"><button class="btn sm" data-act="osave" data-id="${o.id}">Save</button><button class="btn ghost sm" data-act="cancel">Cancel</button></div></div>` : ''}</div>
   <div class="rr"><span class="st ${o.status.split(' ')[0]}">${esc(o.status)}</span>${OPEN.includes(o.status) ? `<div class="acts"><button class="btn ghost sm" data-act="oedit" data-id="${o.id}">Date / urgency</button><button class="btn ghost sm" data-act="osms" data-id="${o.id}">Copy SMS</button></div>` : ''}</div></li>`;
}
function tCattle(f, cat) {
  const last = cat[cat.length - 1], open = OPEN_FORM && OPEN_FORM.kind === 'cattle';
  return `${last ? `<div class="facts" style="margin-bottom:10px"><span>Cows <b class="num">${last.cow}</b></span><span>Buffaloes <b class="num">${last.buf}</b></span><span>Breed <b>${esc(last.breed)}</b></span><span>Milk <b class="num">${last.milk} L/day</b></span><span class="muted">as of ${fmt(last.d)}</span></div>` : '<p class="note">No cattle recorded for this farmer yet. Add it when you learn they keep animals; it helps the next person who calls.</p>'}
  ${cat.length ? `<ul class="tl" style="margin-top:6px">${cat.slice().reverse().map(c => `<li><div class="when">${fmt(c.d)} · ${esc(c.by)}</div><div>${esc(c.issue)}</div><div class="chips">${chip('soil', c.cow + ' cow · ' + c.buf + ' buffalo')}${chip('mute', c.milk + ' L/day')}${(c.bought || []).map(b => chip('blue', b)).join('')}</div></li>`).join('')}</ul>` : ''}
  ${open ? `<div class="inline"><div class="form">
    <label class="field"><span>Cows</span><input type="number" id="ca-cow" min="0" value="${last ? last.cow : 0}"></label><label class="field"><span>Buffaloes</span><input type="number" id="ca-buf" min="0" value="${last ? last.buf : 0}"></label>
    <label class="field"><span>Breed</span><input type="text" id="ca-breed" value="${esc(last ? last.breed : '')}"></label><label class="field"><span>Milk (L/day)</span><input type="number" id="ca-milk" min="0" value="${last ? last.milk : 0}"></label>
    <label class="field wide"><span>Health issue or advice given</span><textarea id="ca-issue"></textarea></label><label class="field wide"><span>Products bought (comma separated)</span><input type="text" id="ca-bought"></label></div>
    <div class="acts" style="margin-top:8px"><button class="btn sm" data-act="casave" data-id="${f.id}">Save entry</button><button class="btn ghost sm" data-act="cancel">Cancel</button></div></div>` : `<button class="btn ghost sm" data-act="caopen" style="margin-top:8px">Add cattle entry</button>`}`;
}
function logsOf(id) { return [...OPS.LOG.map(x => Object.assign({sample: true}, x)), ...S.log].filter(x => x.f === id).sort((a, b) => b.d.localeCompare(a.d)) }
function tLog(f, logs) {
  return `<p class="sub">Capture the final outcome of every WhatsApp chat, call or visit here, so the next person does not need the chat history.</p>
  <div class="inline" style="margin:0 0 12px"><div class="form">
   <label class="field"><span>Channel</span><select id="lg-ch"><option>WhatsApp</option><option>Call</option><option>Visit</option><option>IVR</option></select></label>
   <label class="field"><span>Topic</span><select id="lg-topic"><option>Crop problem</option><option>Order</option><option>Delivery</option><option>Payment</option><option>Cattle</option><option>Other</option></select></label>
   <label class="field"><span>Outcome</span><select id="lg-out">${OUTS.map(o => `<option>${o}</option>`).join('')}</select></label>
   <label class="field"><span>Next follow-up</span><input type="date" id="lg-next" min="${TODAY}"></label>
   <label class="field wide"><span>What was decided</span><textarea id="lg-note" placeholder="e.g. Sent photo, it is sheath blight. Recommended JU-Zodia, farmer will order tomorrow."></textarea></label></div>
   <div class="acts" style="margin-top:8px"><button class="btn sm" data-act="lgsave" data-id="${f.id}">Save outcome</button></div></div>
  ${logs.length ? `<ul class="tl">${logs.map(l => `<li><div class="when">${fmt(l.d)} · ${esc(l.ch)} · ${esc(l.by)}${l.sample ? ' · ' + SAMPLE : ''}</div><div><b>${esc(l.topic)}</b>: ${esc(l.note)}</div><div class="chips">${chip(l.out === 'Ordered' || l.out === 'Resolved' ? 'ok' : l.out === 'Follow-up needed' ? 'warm' : 'mute', l.out)}</div></li>`).join('')}</ul>` : '<p class="empty">No interactions logged yet.</p>'}`;
}
function tRating(f, r) {
  const seg = (k, v, lab, d) => `<div class="rate"><div><b>${lab}</b><div class="d">${d}</div></div><div class="seg3" role="group" aria-label="${lab}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="rate" data-id="${f.id}" data-k="${k}" data-v="${n}" aria-pressed="${v === n}">${n}</button>`).join('')}</div></div>`;
  const auto = (lab, d, v) => `<div class="rate"><div><b>${lab}</b><div class="d">${d}</div></div><div class="meter"><i style="width:${Math.round(v * 100)}%"></i></div></div>`;
  return `<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;margin-bottom:6px"><div class="score ${r.band}">${r.sc}</div><div><b>${r.band} lead</b> ${SAMPLE}<div class="rm">Rated by ${esc(OPS.RATERS[r.by][0])} (${esc(r.role)}) on ${fmt(r.on)}</div></div>
   ${r.needsSenior ? `<div class="note warm">Rated by a ${r.role.toLowerCase()}. A senior should confirm interest, trust and likelihood to buy.<div class="acts" style="margin-top:6px"><select id="rt-senior" aria-label="Senior">${Object.entries(OPS.RATERS).filter(([, v]) => v[1] === 'Senior').map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join('')}</select><button class="btn sm" data-act="rconfirm" data-id="${f.id}">Confirm as senior</button></div></div>` : chip('ok', 'Confirmed by senior')}</div>
  ${seg('interest', r.interest, 'Interest', 'Asks questions, wants to try products (25%)')}${seg('trust', r.trust, 'Trust in Gramik', 'Follows advice, refers others, repeat buyer (25%)')}${seg('resp', r.resp, 'Responsiveness', 'Picks up calls, replies on WhatsApp (15%)')}
  ${auto('Land and crops', f.acres + ' acres, ' + f.cropName + ' (15%, from Lens)', r.land)}${auto('Purchase history', f.orders + ' orders' + (f.value ? ', ' + rupee(f.value) : '') + ' (20%, from Lens)', r.buy)}
  <p class="rm" style="margin-top:8px">Score = weighted parameters out of 100. Strong 60+, Possible 38–59, Weak below 38.</p>`;
}

/* product thumbnail: a real photo when IMG has one (upload to the artifact's asset store), otherwise a type tile */
const IMG = {};
const TYPEC = {fungicide: ['#2F5FA7', 'FUNG'], insecticide: ['#C9353A', 'INSC'], herbicide: ['#5B3FB0', 'HERB'], nutrition: ['#2A7A4B', 'NUTR'], biostimulant: ['#3E8E5E', 'BIO'],
  trap: ['#B8860B', 'TRAP'], adjuvant: ['#61706A', 'ADJ'], bactericide: ['#0F6E76', 'BACT']};
function thumb(p) {
  if (IMG[p]) return `<img class="pimg" src="${esc(IMG[p])}" alt="${esc(p)}">`;
  const t = (PR[p] && PR[p].t) || '', [c, lab] = TYPEC[t] || ['#61706A', 'PROD'], d = (PR[p] && PR[p].dose) || '';
  const shape = /trap/i.test(d) || t === 'trap' ? `<rect x="11" y="8" width="18" height="22" rx="2" fill="#F4D03F"/><path d="M14 13h12M14 18h12M14 23h12" stroke="#B8860B" stroke-width="1.2"/>`
    : /ml|\bl\b|L$/i.test(d) ? `<rect x="16" y="4" width="8" height="5" rx="1" fill="${c}"/><path d="M14 10h12l2 4v18a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V14z" fill="${c}"/><rect x="14" y="17" width="12" height="9" rx="1" fill="#fff" opacity=".9"/>`
    : `<path d="M11 8h18l-1 4 1 20a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2l1-20z" fill="${c}"/><rect x="13" y="16" width="14" height="9" rx="1" fill="#fff" opacity=".9"/>`;
  return `<span class="pimg" style="--tc:${c}"><svg viewBox="0 0 40 40" aria-hidden="true">${shape}</svg><b>${lab}</b></span>`;
}
/* ================= Products drawer (Gramik Lens pop-up) ================= */
function drawer(open) {
  const el = $('drawer');
  if (!open) { el.hidden = true; $('scrim').hidden = true; return }
  const f = FM[CUR], fx = recs(f), sid = storeOf(f), s = OPS.STORES[sid], alt = s.alt, bk = S.basket[f.id] || {};
  const nowSet = new Set(fx.now.map(x => x.product));
  const items = [...fx.now.map(x => ({x, rec: true})), ...fx.later.map(x => ({x, rec: false}))];
  const extra = popProducts(f).filter(p => !items.some(i => i.x.product === p) && stock(sid, p) > 0).map(p => ({x: {product: p, dose: [PR[p].dose], reasons: [{factorLabel: 'POP', text: 'Used in this crop\'s POP'}], gramik: true}, rec: false, other: true}));
  const all = [...items, ...extra];
  const inS = i => sold(i.x.product) && stock(sid, i.x.product) > 0;
  const show = all.filter(i => DFILT === 'all' || (DFILT === 'rec' && i.rec) || (DFILT === 'stock' && inS(i)) || (DFILT === 'both' && i.rec && inS(i)));
  const seen = S.seen[f.id] || {};
  const BB = Object.fromEntries(boughtOf(f).map(b => [b.p, b]));
  const li = i => { const p = i.x.product, q = stock(sid, p), aq = alt ? stock(alt, p) : 0, pr = price(p), n = bk[p] || 0, g = sold(p);
    const st = !g ? chip('mute', 'Advice only, not sold by Gramik') : q > 0 ? chip('ok', q + ' in stock') : aq > 0 ? chip('warm', 'Out here · ' + aq + ' at ' + OPS.STORES[alt].name.replace(' dark store', '')) : chip('hot', 'Out of stock');
    return `<li><div class="pwrap">${thumb(p)}<div><div class="pn">${esc(p)}</div><div class="pt">${esc(PR[p] ? (PR[p].tech || '') : '')}</div></div></div>
     <div class="pr">${g ? rupee(pr) : '–'}<small>${esc((i.x.dose || [])[0] || '')} per acre</small></div>
     <div class="pw"><div class="chips">${i.rec ? chip('green', 'Recommended') : i.other ? chip('blue', 'In stock for this crop') : chip('mute', 'Also useful now')}${st}${BB[p] ? chip('violet', 'Bought ' + BB[p].times + '× · last ' + fmt(BB[p].last)) : ''}${(i.x.reasons || []).slice(0, 2).map(r => chip(r.factor === 3 ? 'hot' : 'mute', (r.factorLabel ? r.factorLabel + ': ' : '') + r.text)).join('')}</div>
     ${g ? `<div class="acts" style="margin-top:6px;align-items:center">${n ? `<span class="qty"><button type="button" data-act="bq" data-p="${esc(p)}" data-d="-1" aria-label="Less">−</button><span>${n}</span><button type="button" data-act="bq" data-p="${esc(p)}" data-d="1" aria-label="More">+</button></span><span class="small muted">packs (1 pack = 1 acre dose)</span>` : `<button class="btn ghost sm" data-act="badd" data-p="${esc(p)}">Add ${Math.max(1, Math.ceil(f.acres))} for ${f.acres} ac</button>`}</div>` : ''}</div></li>` };
  const lines = Object.entries(bk).filter(([, n]) => n > 0), sub = lines.reduce((t, [p, n]) => t + price(p) * n, 0);
  const dsc = discount(f, sub), ex = +(S.extraDisc && S.extraDisc[f.id]) || 0, tot = dsc.r + ex, need = tot > dsc.cap;
  const openO = allOrders().filter(o => o.f === f.id && ['Placed', 'Confirmed'].includes(o.status));
  el.innerHTML = `<div class="dh"><button class="btn ghost sm x" data-act="dclose">Close</button><h3>Products for ${esc(f.short)}</h3>
   <div class="rm">${esc(f.cropName)} · ${esc(f.stageEn)} · ${f.acres} ac · stock from ${esc(s.name)} ${SAMPLE}</div>
   <div class="rm">Recommended products ordered so far: <b class="num">${S.recStats.ordered} of ${S.recStats.rec}</b></div></div>
  <div class="db">${f.ended ? '<p class="note warm">Crop is past its last stage. Plan the next crop before recommending products.</p>' : ''}
   <div class="gh">Problems seen in the field</div><div class="chips">${f.b.watch.slice(0, 8).map(x => `<label class="chipb ck"><input type="checkbox" data-act="seen" data-id="${f.id}" data-issue="${x.id}"${seen[x.id] ? ' checked' : ''}> ${esc(x.en)}</label>`).join('')}</div>
   <div class="filt" role="group" aria-label="Filter products">${[['all', 'All'], ['rec', 'Recommended'], ['stock', 'In stock'], ['both', 'Recommended and in stock']].map(([k, l]) => `<button class="chipb" type="button" data-act="dfilt" data-k="${k}" aria-pressed="${DFILT === k}">${l}</button>`).join('')}</div>
   <ul class="pl">${show.map(li).join('') || '<li><p class="empty">Nothing matches this filter.</p></li>'}</ul></div>
  <div class="df">${lines.length ? `<div class="tot">${lines.map(([p, n]) => `<span>${n} × ${esc(p)}</span><span class="n">${rupee(price(p) * n)}</span>`).join('')}
    <span class="muted">Discount by rule: ${dsc.why.length ? esc(dsc.why.join(' + ')) : 'none'}</span><span class="n">${dsc.r}%</span>
    <span class="muted"><label for="xdisc">Extra discount %</label> <input type="number" id="xdisc" min="0" max="20" value="${ex}" style="width:64px"></span><span class="n">${ex}%</span>
    <span class="g">Total</span><span class="n g">${rupee(sub * (1 - tot / 100))}</span></div>
    ${need ? `<p class="note warm" style="margin-top:6px">${tot}% is above the ${dsc.cap}% limit. This order will need manager approval.</p>` : ''}
    <div class="form" style="margin-top:8px"><label class="field"><span>Preferred delivery date</span><input type="date" id="bk-pref" min="${TODAY}"></label><label class="ck"><input type="checkbox" id="bk-urg"> Urgent</label></div>
    <div class="acts" style="margin-top:8px">${openO.length ? `<button class="btn" data-act="border" data-to="${openO[0].id}">Add to open order ${openO[0].id}</button><button class="btn ghost" data-act="border">New order</button>` : `<button class="btn" data-act="border">Create order</button>`}<button class="btn ghost" data-act="bclear">Clear</button></div>
    ${openO.length ? `<p class="rm">Adding to the open order avoids a second order for the same farmer.</p>` : ''}` : '<p class="small muted" style="margin:0">Add products to build an order. Discounts follow the rules: 3% from ₹3,000, 5% from ₹6,000, +2% for repeat buyers, up to 7% without approval.</p>'}</div>`;
  el.hidden = false; $('scrim').hidden = false;
}
function discount(f, sub) { let r = 0; const why = []; if (sub >= 6000) { r = 5; why.push('₹6,000+ order 5%') } else if (sub >= 3000) { r = 3; why.push('₹3,000+ order 3%') } if (f.orders >= 3) { r += 2; why.push('repeat buyer 2%') } return {r, why, cap: 7} }

/* ================= Orders desk ================= */
function vOrders() {
  const all = allOrders(), list = all.map(o => ({o, fl: oflags(o, all)})).sort((a, b) => oprio(b.o, b.fl) - oprio(a.o, a.fl));
  const open = list.filter(x => OPEN.includes(x.o.status)), done = list.filter(x => !OPEN.includes(x.o.status));
  return `<div class="pagehead"><div><h2>Orders and delivery priority ${SAMPLE}</h2><p>Sorted for logistics: urgent first, then stock and duplicate problems; orders the farmer wants later go last.</p></div></div>
  <section class="card"><h2>Dark store capacity</h2><p class="sub">When a store is above 90%, route new orders from its pincodes to the alternate store instead of holding them.</p>
   <div class="stores">${Object.entries(OPS.STORES).map(([k, s]) => `<div class="store"><div class="small" style="font-weight:600">${esc(s.name)}</div><b>${s.load}%</b> <span class="small muted">of ${s.cap} orders/day</span>
    <div class="bar" style="margin-top:6px"><i class="${s.load >= 90 ? 'hot' : s.load >= 70 ? 'warm' : ''}" style="width:${s.load}%"></i></div>${s.load >= 90 && s.alt ? `<div class="small" style="color:var(--hot);margin-top:4px">Overloaded: use ${esc(OPS.STORES[s.alt].name.replace(' dark store', ''))}</div>` : ''}</div>`).join('')}</div></section>
  <section class="card"><h2>Open orders <small>${open.length}</small></h2><ul class="rows">${open.map(x => orderRow(x.o, all, false)).join('')}</ul></section>
  <section class="card"><h2>Delivered and returned <small>${done.length}</small></h2><ul class="rows">${done.map(x => orderRow(x.o, all, false)).join('')}</ul></section>`;
}

/* ================= events ================= */
function copy(text) {
  const done = () => toast('Copied');
  try { navigator.clipboard.writeText(text).then(done, () => fallback(text)) } catch (e) { fallback(text) }
}
function fallback(text) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Copied') } catch (e) { toast('Select the text and copy it') } t.remove() }
function addLog(e) { S.log.push(Object.assign({d: TODAY, by: 'Agronomist'}, e)) }
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y) }

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-go],[data-farmer],[data-act],[data-copy]'); if (!t) return;
  if (t.dataset.copy) return copy(t.dataset.copy);
  if (t.dataset.farmer && !t.dataset.act) return go('farmer', t.dataset.farmer, t.dataset.tab || 'crop');
  if (t.dataset.go && !t.dataset.act) return go(t.dataset.go);
  const a = t.dataset.act, id = t.dataset.id;
  if (a === 'seen') return; // handled on change
  if (a === 'cancel') { OPEN_FORM = null; return rerender() }
  if (a === 'fdoneopen') { OPEN_FORM = {kind: 'done', id}; return rerender() }
  if (a === 'fmoveopen') { OPEN_FORM = {kind: 'move', id}; return rerender() }
  if (a === 'fdone') { const x = allFup().find(z => z.id === id); S.fup[id] = Object.assign(S.fup[id] || {}, {status: 'done'});
    addLog({f: x.f, ch: $('fd-ch').value, topic: 'Follow-up', out: $('fd-out').value, note: $('fd-note').value || x.why});
    const nx = $('fd-next').value; if (nx) S.newFup.push({id: 'N' + Date.now(), f: x.f, due: nx, why: $('fd-note').value || 'Follow-up after: ' + x.why, by: 'Agronomist'});
    OPEN_FORM = null; save(); toast('Follow-up closed and logged'); return rerender() }
  if (a === 'fmove') { const x = allFup().find(z => z.id === id), d = $('fm-date').value; if (!d) return toast('Pick a new date');
    S.fup[id] = Object.assign(S.fup[id] || {}, {due: d, moved: (x.moved || 0) + 1, lastWhy: $('fm-why').value}); OPEN_FORM = null; save(); toast('Moved to ' + fmt(d)); return rerender() }
  if (a === 'stg') { STG = ['pre', 'post'].includes(t.dataset.k) ? t.dataset.k : +t.dataset.k; return rerender() }
  if (a === 'tab') { FTAB = t.dataset.tab; OPEN_FORM = null; return rerender() }
  if (a === 'drawer') return drawer(true);
  if (a === 'dclose') return drawer(false);
  if (a === 'dfilt') { DFILT = t.dataset.k; return drawer(true) }
  if (a === 'badd' || a === 'bq') { const f = FM[CUR], bk = S.basket[f.id] = S.basket[f.id] || {}, p = t.dataset.p;
    bk[p] = a === 'badd' ? Math.max(1, Math.ceil(f.acres)) : Math.max(0, (bk[p] || 0) + (+t.dataset.d)); if (!bk[p]) delete bk[p]; save(); return drawer(true) }
  if (a === 'bclear') { S.basket[CUR] = {}; save(); return drawer(true) }
  if (a === 'border') { const f = FM[CUR], bk = S.basket[f.id] || {}, lines = Object.entries(bk).filter(([, n]) => n > 0); if (!lines.length) return;
    const recSet = new Set(recs(f).now.map(x => x.product)); S.recStats.rec += recSet.size; S.recStats.ordered += lines.filter(([p]) => recSet.has(p)).length;
    const sub = lines.reduce((s, [p, n]) => s + price(p) * n, 0), dsc = discount(f, sub), ex = +(S.extraDisc && S.extraDisc[f.id]) || 0;
    const pref = $('bk-pref').value || null, urg = $('bk-urg').checked, to = t.dataset.to;
    if (to) { const o = allOrders().find(z => z.id === to), items = o.items.map(x => x.slice());
      lines.forEach(([p, n]) => { const e = items.find(x => x[0] === p); if (e) e[1] += n; else items.push([p, n]) });
      S.ord[to] = Object.assign(S.ord[to] || {}, {items, pref: pref || o.pref, urgent: urg || o.urgent}); toast('Added to ' + to);
    } else { const sid0 = storeOf(f), st = OPS.STORES[sid0], sid = st.load >= 90 && st.alt ? st.alt : sid0, oid = 'GO-' + (48300 + S.newOrders.length);
      S.newOrders.push({id: oid, f: f.id, date: TODAY, items: lines, status: 'Placed', store: sid, pref, urgent: urg, urgentWhy: '', disc: dsc.r + ex, approval: dsc.r + ex > dsc.cap});
      toast(oid + ' created' + (sid !== sid0 ? ', routed to ' + OPS.STORES[sid].name : '')) }
    addLog({f: f.id, ch: 'Call', topic: 'Order', out: 'Ordered', note: lines.map(([p, n]) => n + ' × ' + p).join(', ')});
    S.basket[f.id] = {}; save(); drawer(false); FTAB = 'orders'; return rerender() }
  if (a === 'caopen') { OPEN_FORM = {kind: 'cattle'}; return rerender() }
  if (a === 'casave') { const L = S.cattle[id] = S.cattle[id] || [];
    L.push({d: TODAY, cow: +$('ca-cow').value || 0, buf: +$('ca-buf').value || 0, breed: $('ca-breed').value, milk: +$('ca-milk').value || 0, issue: $('ca-issue').value || 'Details updated', bought: $('ca-bought').value.split(',').map(s => s.trim()).filter(Boolean), by: 'Agronomist'});
    OPEN_FORM = null; save(); toast('Cattle entry saved'); return rerender() }
  if (a === 'lgsave') { const note = $('lg-note').value.trim(); if (!note) return toast('Write what was decided');
    addLog({f: id, ch: $('lg-ch').value, topic: $('lg-topic').value, out: $('lg-out').value, note});
    const nx = $('lg-next').value; if (nx) S.newFup.push({id: 'N' + Date.now(), f: id, due: nx, why: note, by: 'Agronomist'});
    save(); toast(nx ? 'Saved, follow-up set for ' + fmt(nx) : 'Saved'); return rerender() }
  if (a === 'rate') { S.rating[id] = Object.assign(S.rating[id] || {}, {[t.dataset.k]: +t.dataset.v}); save(); return rerender() }
  if (a === 'rconfirm') { S.rating[id] = Object.assign(S.rating[id] || {}, {by: $('rt-senior').value, confirmed: true, on: TODAY}); save(); toast('Rating confirmed'); return rerender() }
  if (a === 'oedit') { OPEN_FORM = {kind: 'ord', id}; return rerender() }
  if (a === 'osave') { S.ord[id] = Object.assign(S.ord[id] || {}, {pref: $('oe-pref').value || null, urgent: $('oe-urg').checked, urgentWhy: $('oe-why').value}); OPEN_FORM = null; save(); toast('Order updated'); return rerender() }
  if (a === 'osms') { const o = allOrders().find(z => z.id === id), f = FM[o.f];
    const when = o.pref ? fmtHi(o.pref) : null, txt = `नमस्ते ${f.short} जी, आपका ग्रामिक ऑर्डर ${o.id} (${o.items.map(([p, q]) => q + ' ' + p).join(', ')}) ${o.status === 'Rescheduled' ? 'की डिलीवरी की तारीख बदली गई है' : 'दर्ज है'}।${when ? ' डिलीवरी ' + when + ' को या उसके बाद होगी।' : ''} किसी भी सवाल के लिए ग्रामिक से संपर्क करें।`;
    return copy(txt) }
  if (a === 'wxmsg') { const f = FM[id], w = cropWx(f, forecast(f.place)); copy(`नमस्ते ${f.short} जी,\n${w.spray.length ? '• छिड़काव के लिए अच्छे दिन: ' + dlistHi(w.spray) + '\n' : ''}${w.lines.filter(l => l.hi).map(l => '• ' + l.hi).join('\n')}\nग्रामिक`); addLog({f: id, ch: 'WhatsApp', topic: 'Crop problem', out: 'Product recommended', note: 'Weather advice sent'}); save(); return }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset && t.dataset.act === 'seen') { const s = S.seen[t.dataset.id] = S.seen[t.dataset.id] || {}; s[t.dataset.issue] = t.checked; save();
    if (!$('drawer').hidden) drawer(true); else rerender(); return }
  if (t.id === 'xdisc') { S.extraDisc = S.extraDisc || {}; S.extraDisc[CUR] = Math.max(0, +t.value || 0); save(); return drawer(true) }
  if (t.id === 'fdist') { FDIST = t.value; return rerender() }
  if (t.id === 'fcrop') { FCROP = t.value; return rerender() }
});
document.addEventListener('input', ev => { if (ev.target.id === 'fsearch') { FSEARCH = ev.target.value; const pos = ev.target.selectionStart; render(); const s = $('fsearch'); s.focus(); try { s.setSelectionRange(pos, pos) } catch (e) {} } });
$('scrim').addEventListener('click', () => drawer(false));
$('fab').addEventListener('click', () => drawer(true));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('drawer').hidden) drawer(false) });
render();
