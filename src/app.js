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
/* a dose as the agronomist says it: "400 g/acre"; doses already per pump, per litre, per trap or per seed stay as written; no dose in the POP data says so */
const doseHi = d => { d = (d || '').trim(); return !d ? 'लेबल के अनुसार' : /per |\/|trap|drench|seed|label/i.test(d) ? d.replace(/per pump/i, 'प्रति पंप') : d + ' प्रति एकड़' };
const perAcre = d => { d = (d || '').trim(); if (!d || d === '–') return 'Dose as per label'; return /per |\/|trap|drench|seed|sett|label|irrigation/i.test(d) ? d : d + '/acre' };
const rupee = n => '₹' + Math.round(n).toLocaleString('en-IN');
const chip = (c, t) => `<span class="chip ${c}">${esc(t)}</span>`;
const SAMPLE = chip('sample', 'Sample');
const norm = s => (s || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^0-9a-z]/g, '');
const title = s => s.split(' s/o')[0].trim().toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const relDue = d => { const n = diff(TODAY, d); return n < 0 ? (-n) + (n === -1 ? ' day' : ' days') + ' overdue' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days' };

/* ================= saved state (this browser only) ================= */
const SKEY = 'gramik_desk_v1';
let S = {}; try { S = JSON.parse(localStorage.getItem(SKEY)) || {} } catch (e) { S = {} }
if (!S || typeof S !== 'object' || Array.isArray(S)) S = {};
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
['fup', 'cattle', 'rating', 'ord', 'disp', 'basket', 'seen', 'prof', 'myo', 'extraDisc'].forEach(k => { if (!isObj(S[k])) S[k] = {} });
['newFup', 'log', 'newOrders', 'sent', 'uploads', 'undecided'].forEach(k => { S[k] = Array.isArray(S[k]) ? S[k].filter(isObj) : [] });
S.newFup = S.newFup.filter(x => x.f && x.id); S.uploads = S.uploads.filter(u => u.id && Array.isArray(u.rows) && Array.isArray(u.farmers)); S.log = S.log.filter(x => x.f && x.d); S.newOrders = S.newOrders.filter(x => x.id && x.f && Array.isArray(x.items));
Object.keys(S.prof).forEach(k => { if (!isObj(S.prof[k])) delete S.prof[k] });
if (!isObj(S.recStats)) S.recStats = null;

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
  const w = f.b ? f.b.watch : [], wet = t => /humid|rain|dew|fog|cloud|moist|wet/i.test((t || '').replace(/no rain/ig, '')), dry = t => /dry|hot/i.test(t || '');
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
  (f.b ? f.b.weather : []).filter(o => o.tier === 1).forEach(o => out.push({k: 'soil', tag: 'Season risk (POP)', title: o.en, when: null, note: 'Likely this month',
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
   ${row('Products', a.products && a.products.length ? `<div class="chips">${a.products.map(p => `<span class="chip blue"><b>${esc(p.p)}</b> · ${esc(perAcre(p.dose))}${p.for ? ' · for ' + esc(p.for) : ''}</span>`).join('')}</div>` : '')}</dl>
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
const storeOf = f => OPS.STORE_OF[f.place.district] || OPS.STORE_OF[f.district] || 'LKO';
const stock = (sid, p) => (OPS.STORES[sid] && OPS.STORES[sid].stock[p]) || 0;
const price = p => OPS.PRICE[p] || 0;
const sold = p => PR[p] ? !!PR[p].gk : false;

/* ================= farmers ================= */
/* A farmer gets a POP plan only when crop, variety and sowing date are known and the crop is in the POP data.
   Details filled on a call (S.prof) override the Lens record. */
const POPCROPS = Object.keys(D.P).sort();
const isCalOnly = (ck, v) => !!(ck && v && D.P[ck].varieties[v] && !D.P[ck].varieties[v].das);
function prepFarmer(f0) {
  const f = Object.assign({}, f0, OPS.FARM[f0.id]), p = S.prof[f0.id];
  if (p) { f.crop = p.crop; f.variety = p.variety; f.sow = p.sow; f.dss = null; if (p.acres) f.acres = p.acres; f.filled = p }
  f.place = pinInfo(f.pin); if (!f.place.ok) f.place = Object.assign({}, f.place, {district: f.district || '–', place: f.village || f.district || 'Pincode not known'});
  f.phone = f.phone || ''; f.village = f.village || '–'; f.district = f.district || f.place.district; f.pin = f.pin || '';
  f.short = title(f.name || 'Farmer'); f.orders = f.orders || 0; f.acres = f.acres || 0;
  f.ck = f.crop ? ENG.resolveCrop(f.crop) : null;
  f.sowISO = f.sow || (f.dss != null ? addDays(TODAY, -f.dss) : null);
  const missing = [];
  if (!f.crop) missing.push('crop'); else if (f.ck) { if (!f.variety) missing.push('variety'); if (!f.sowISO && !isCalOnly(f.ck, f.variety)) missing.push('sowing date') }
  f.pop = {ok: !!f.ck && !missing.length, missing, nocrop: !!f.crop && !f.ck};
  if (!f.pop.ok) {
    f.b = null; f.ended = false; f.stageHi = '';
    f.cropName = f.ck ? D.P[f.ck].crop.split('(')[0].trim() : f.crop || 'Crop not known';
    f.stageEn = f.pop.nocrop ? 'No POP for this crop' : 'POP not filled: ' + missing.join(', ') + ' missing';
    return f;
  }
  f.b = ENG.brief({crop: f.crop, variety: f.variety, sowing_date: f.sowISO || TODAY}, TODAY);
  f.cropName = f.b.crop.split('(')[0].trim(); f.cropHi = (f.b.crop.match(/\(\s*([^)]+?)\s*\)/) || [])[1] || f.cropName;
  const st = f.b.stage; f.stageEn = st.status === 'after' ? 'Harvested / past last stage' : st.status === 'before' ? 'Not sown yet' : st.row ? st.row.en : 'Stage not found';
  f.stageHi = st.row ? st.row.hi : ''; f.ended = st.status === 'after' || f.b.context.st === 'S8';
  if (!S.seen[f.id] && f.va) { S.seen[f.id] = {}; f.va.confirmed.forEach(i => S.seen[f.id][i] = true) }
  return f;
}
const upFarmers = () => { const m = new Map(); S.uploads.forEach(u => u.farmers.forEach(x => { if (x && x.id && !m.has(x.id)) m.set(x.id, x) })); return [...m.values()] };
const SRC = [...X.FM, ...(OPS.NEWF || []), ...upFarmers()];
const F = SRC.map(prepFarmer);
const FM = Object.fromEntries(F.map(f => [f.id, f]));
function addFarmer(rec) { if (FM[rec.id]) return FM[rec.id]; SRC.push(rec); const f = prepFarmer(rec); F.push(f); FM[f.id] = f; return f }
function refit(id) { const i = F.findIndex(f => f.id === id), f = prepFarmer(SRC.find(x => x.id === id)); F[i] = f; FM[id] = f; return f }
const stageLine = f => !f.b ? `${f.cropName} · ${f.stageEn}` : `${f.cropName} · ${f.b.stage.das != null && f.b.stage.das >= 0 ? 'day ' + f.b.stage.das + ' · ' : ''}${f.stageEn}`;

/* ================= follow-ups ================= */
function allFup() { return [...OPS.FUP, ...S.newFup].map(x => Object.assign({}, x, x.due ? {} : {due: addDays(TODAY, x.dueIn || 0)}, S.fup[x.id] || {})).filter(x => x.status !== 'done' && FM[x.f]).sort((a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0) }
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
  const r = Object.assign({interest: 3, trust: 3, resp: 3, by: 'R1', on: TODAY, confirmed: false}, OPS.RATING[f.id], S.rating[f.id] || {});
  const land = Math.min(1, f.acres / 5), buy = Math.min(1, f.orders / 6);
  const sc = Math.round(100 * (.25 * (r.interest - 1) / 4 + .25 * (r.trust - 1) / 4 + .15 * (r.resp - 1) / 4 + .15 * land + .20 * buy));
  const role = OPS.RATERS[r.by][1];
  return Object.assign(r, {land, buy, sc, band: sc >= 60 ? 'Strong' : sc >= 38 ? 'Possible' : 'Weak', role, needsSenior: !r.confirmed && role !== 'Senior'});
}

/* ================= recommendations (Gramik Lens products) ================= */
function recs(f) {
  if (!f.b) return {now: [], later: []};
  const b = f.b, seen = S.seen[f.id] || {};
  const sel = {nut: b.nutrition.filter(o => o.tier === 1 && o.id !== 'N_STOP').map(o => o.id), wx: b.weather.filter(o => o.tier === 1).map(o => o.id),
    weed: b.weeds.filter(o => o.tier === 1).map(o => o.id), cure: Object.keys(seen).filter(k => seen[k]), skip: [], extra: []};
  if (f.ended) return {now: [], later: []};
  return ENG.focus(b.context, sel, {weights: X.FW});
}
function popProducts(f) {
  if (!f.b) return [];
  const txt = norm(f.b.stage.rows.map(r => r.prod || '').join(' '));
  return Object.keys(PR).filter(p => sold(p) && norm(p).length > 3 && txt.includes(norm(p)));
}

/* ================= navigation ================= */
let STG = null;
let FPOP = '', FUP2 = '';
let WXOPEN = false, MORE = new Set(), HOWALL = false, HOWL = 'hing', HOWFULL = false;
let VIEW = 'today', CUR = null, FTAB = 'crop', DFILT = 'all', OPEN_FORM = null, FSEARCH = '', FDIST = '', FCROP = '';
const NAV = [['today', 'Today'], ['stores', 'Dark stores'], ['farmers', 'Farmers'], ['after', 'After calls']];
function counts() {
  const fu = allFup(), ord = allOrders(), od = fu.filter(x => x.due < TODAY).length;
  const watch = ord.filter(o => OPEN.includes(o.status) && (o.urgent || oflags(o, ord).some(x => x[0] === 'hot'))).length;
  return {od, dueToday: fu.filter(x => x.due === TODAY).length, fu: fu.filter(x => x.due <= TODAY).length, watch, need: F.filter(f => !f.pop.ok).length};
}
let RET = null;
function go(v, id, tab) { const from = VIEW; if (v === 'farmer' && from !== 'farmer') RET = {view: from, y: window.scrollY};
  VIEW = v; if (id !== undefined && id !== CUR) { CUR = id; STG = null; PD = null } if (tab) FTAB = tab; OPEN_FORM = null; render(); window.scrollTo(0, 0);
}
function goBack() { const r = RET || {view: 'farmers', y: 0}; RET = null; VIEW = r.view; OPEN_FORM = null; render(); window.scrollTo(0, r.y || 0) }
/* the call starts when the farmer profile is opened from the call brief, and ends with Complete call on that profile */
function openCall(id) {
  if (CALLING && CALLING !== id && FM[CALLING]) { toast('Complete the call with ' + FM[CALLING].short + ' first'); id = CALLING }
  const f = FM[id]; if (!f) return; const fresh = CALLING !== id; QSEL = id; CALLING = id; QK = null;
  if (fresh) { try { navigator.clipboard.writeText(f.phone).catch(() => {}) } catch (e) {} toast('On call with ' + f.short + ' · ' + f.phone + ' (number copied)') }
  if (VIEW !== 'today' && VIEW !== 'farmer') RET = null;
  go('farmer', id, 'crop');
}
function rail() {
  const c = counts(), badge = {today: [callQueue().filter(r => r.st !== 'done').length, c.od ? 'hot' : ''], after: [c.fu, c.od ? 'hot' : ''], farmers: [c.need, '']};
  $('rail').innerHTML = NAV.map(([k, l]) => { const bd = badge[k]; const cur = VIEW === k || (VIEW === 'farmer' && k === 'farmers');
    return `<button class="nb" type="button" data-go="${k}"${cur ? ' aria-current="page"' : ''}>${l}${bd && bd[0] ? `<b class="${bd[1]}">${bd[0]}</b>` : ''}</button>` }).join('') +
    `<button class="meb" type="button" data-go="me"${VIEW === 'me' ? ' aria-current="page"' : ''}><span class="av">${initials(ME.name)}</span><span><b>My profile</b><small>${esc(ME.name)}</small></span></button>`;
}
function topbar() {
  $('today').textContent = dt(TODAY).toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}) + ' · Lucknow hub';
}
function render() {
  try { renderPage() } catch (e) {
    console.error(e);
    $('view').innerHTML = `<section class="card"><h2>This page could not be drawn</h2><p class="sub">Something saved in this browser from an earlier version is getting in the way. Resetting clears only what you changed on this page (crop details, logs, follow-up changes, new orders) in this browser.</p>
      <div class="acts"><button class="btn" type="button" id="resetSaved">Reset saved data and reload</button></div><p class="rm" style="margin-top:8px">${esc(e && e.message || '')}</p></section>`;
    const b = $('resetSaved'); if (b) b.onclick = () => { try { localStorage.removeItem(SKEY) } catch (x) {} location.reload() };
  }
}
function renderPage() {
  topbar(); rail();
  const v = $('view');
  v.innerHTML = VIEW === 'today' ? vToday() : VIEW === 'farmers' ? vFarmers() : VIEW === 'farmer' ? vFarmer() : VIEW === 'me' ? vMe() : VIEW === 'after' ? vAfter() : VIEW === 'stores' ? vStores() : vToday();
  $('fab').hidden = VIEW !== 'farmer';
  if (VIEW === 'farmer') $('fab').textContent = 'Products for ' + FM[CUR].short.split(' ')[0];
}

/* ================= Today ================= */
/* ================= Today: the daily call desk ================= */
let QTAB = 'all', QOPEN = null, QSEL = null;
const CALLED = ['Resolved', 'Product recommended', 'Ordered', 'Follow-up needed', 'Not interested'];
function maskPh(p) { p = String(p || ''); return p.length >= 10 ? '+91 ' + p.slice(0, 2) + '••• ••' + p.slice(-3) : p }
/* the sample call day: before the shift starts (night, early morning) show the whole sample day so the demo is never empty */
function demoHour() { const h = new Date().getHours(), sh = (OPS.ME && OPS.ME.shift) || [9, 18]; return h < sh[0] ? 23 : h }
function todayCalls() {
  const hrNow = demoHour(), act = (OPS.MYACT || []).filter(a => a.kind === 'call' && a.dAgo === 0 && a.hr <= hrNow);
  const logs = S.log.filter(l => l.d === TODAY && (l.ch === 'Call'));
  const calls = [...act.map(a => ({hr: a.hr, out: a.out, topic: a.topic, secs: a.secs})),
    ...logs.map(l => ({hr: l.hr ?? hrNow, out: l.out === 'Not reachable' ? 'No answer' : 'Connected', topic: l.topic, secs: 0}))];
  const con = calls.filter(c => c.out === 'Connected'), talk = con.filter(c => c.secs);
  return {calls, con, avg: talk.length ? Math.round(talk.reduce((t, c) => t + c.secs, 0) / talk.length) : 0, hrNow};
}
/* today's calls as a list: sample calls are spread over the farmers; calls logged on this page carry the real farmer */
function callLog() {
  const hrNow = demoHour(), out = [], ids = F.map(f => f.id);
  (OPS.MYACT || []).filter(a => a.kind === 'call' && a.dAgo === 0).forEach((a, i) => { if (a.hr > hrNow) return;
    out.push({hr: a.hr, min: (i * 13) % 60, f: FM[ids[(i * 7) % ids.length]], out: a.out, topic: a.topic || '', secs: a.secs || 0, sample: true}) });
  S.log.filter(l => l.d === TODAY && l.ch === 'Call').forEach(l => { const [h, m] = (l.at || '').replace(/\s?[AP]M/i, '').split(':').map(Number);
    const pm = /PM/i.test(l.at || '') && h !== 12 ? 12 : 0; out.push({hr: l.hr ?? hrNow, min: isNaN(m) ? 0 : m, f: FM[l.f], out: l.out === 'Not reachable' ? 'No answer' : 'Connected', topic: l.topic, secs: 0, note: l.note, result: l.out}) });
  return out.filter(c => c.f).sort((a, b) => (b.hr * 60 + b.min) - (a.hr * 60 + a.min));
}
const hm = c => ((c.hr % 12) || 12) + ':' + String(c.min).padStart(2, '0') + (c.hr < 12 ? ' AM' : ' PM');
let QK = null, CALLING = null;
function tileList(k, ctx) {
  const mmss = s => s ? Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's' : '–';
  const head = (t, sub, cols, rows, empty) => `<div class="qkp"><div class="qkph"><h3>${t}</h3><span class="rm">${sub}</span><button class="lk" data-act="qk" data-k="${k}">Close</button></div>
    ${rows.length ? `<div class="tw2"><table class="qkt"><thead><tr>${cols.map(c => `<th${/Amount|Talk/.test(c) ? ' class="n"' : ''}>${c}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : `<p class="empty">${empty}</p>`}</div>`;
  const who = f => `<span class="qn">${esc(f.short)}</span><div class="rm">${esc(f.village)}, ${esc(f.district)}</div>`;
  if (k === 'con') { const L = callLog().filter(c => c.out === 'Connected');
    return head('Connected calls today', L.length + ' calls · tap a farmer to open the call brief', ['Time', 'Farmer', 'Crop', 'Topic', 'Talk time', ''],
      L.map(c => `<tr class="qrow" data-act="qsel" data-id="${c.f.id}" tabindex="0"><td class="num">${hm(c)}</td><td>${who(c.f)}</td><td>${esc(c.f.cropName)}</td><td>${esc(c.result ? c.result + (c.note ? ': ' + c.note : '') : c.topic)}</td><td class="n num">${mmss(c.secs)}</td><td>${c.sample ? '' : chip('green', 'Logged here')}</td></tr>`), 'No connected calls yet today.') }
  if (k === 'pend') { const L = callQueue().filter(r => r.st !== 'done'), PRL = {high: 'High', med: 'Medium', low: 'Low'};
    return head('Pending calls', L.length + ' farmers still to call · ' + L.filter(r => r.pri === 'high').length + ' high priority', ['Priority', 'Farmer', 'Why call', 'Status', ''],
      L.map(r => `<tr class="qrow" data-act="qsel" data-id="${r.f.id}" tabindex="0"><td><span class="pri ${r.pri}"></span> ${PRL[r.pri]}</td><td>${who(r.f)}</td><td>${esc(r.purpose)}</td><td><span class="qs ${r.st === 'callback' ? (r.late ? 'overdue' : 'callback') : 'upl'}">${esc(r.status)}</span>${r.sub ? `<div class="rm">${esc(r.sub)}</div>` : ''}</td><td class="n"><button class="btn sm" data-act="qopen" data-id="${r.f.id}">${CALLING === r.f.id ? 'On call' : 'Call'}</button></td></tr>`), 'Everyone on today\'s list has been called.') }
  if (k === 'ord') { const L = ctx.ms.td;
    return head("Today's orders from calls", L.length + ' orders · ' + rupee(ctx.ms.sum(ctx.ms.tdNet)) + ' net', ['Time', 'Customer', 'Products', 'Amount', 'Status'],
      L.map(o => `<tr${o.fid ? ` class="qrow" data-act="qsel" data-id="${o.fid}" tabindex="0"` : ''}><td class="num">${o.time ? hm({hr: +o.time.split(':')[0], min: +o.time.split(':')[1]}) : 'Today'}</td><td><span class="qn">${esc(o.who)}</span><div class="rm oid">${esc(o.id)}</div></td><td>${o.items.map(([p, q]) => esc(p) + ' <span class="muted">× ' + q + '</span>').join(', ')}</td><td class="n num"><b>${rupee(o.amt)}</b></td><td>${stPill(o.status)}</td></tr>`), 'No orders placed from calls yet today.') }
  if (k === 'fu') { const L = allFup().filter(x => x.due <= TODAY);
    return head('Callbacks due', L.filter(x => x.due < TODAY).length + ' overdue · ' + L.filter(x => x.due === TODAY).length + ' due today', ['Due', 'Farmer', 'Why', 'Set by', ''],
      L.map(x => { const f = FM[x.f], late = x.due < TODAY; return `<tr class="qrow" data-act="qsel" data-id="${f.id}" tabindex="0"><td>${chip(late ? 'solid' : 'warm', late ? (-diff(TODAY, x.due)) + 'd overdue' : x.time || 'Today')}</td><td>${who(f)}</td><td>${esc(x.why)}</td><td class="rm">${esc(x.by)}</td><td class="n"><button class="btn ghost sm" data-act="resch" data-id="${x.id}">Reschedule</button> <button class="btn sm" data-act="qsel" data-id="${f.id}">Open brief</button></td></tr>` }), 'No follow-ups due. Well done.') }
  if (k === 'und') { const L = S.undecided.filter(u => !u.closed && u.back > TODAY && FM[u.f]);
    return head('Undecided farmers', 'Closed for now · they come back into the call queue on the date shown', ['Back in queue', 'Farmer', 'Note', 'Undecided on'],
      L.map(u => `<tr class="qrow" data-act="qsel" data-id="${u.f}" tabindex="0"><td>${chip('mute', fmt(u.back))}</td><td>${who(FM[u.f])}</td><td>${esc(u.note || u.why || '')}</td><td class="rm">${fmt(u.at)}</td></tr>`), 'No undecided farmers right now.') }
  if (k === 'cb') { const L = ctx.cbs;
    return head('Callbacks booked today', L.length ? 'Next at ' + L[0].time : '', ['Time', 'Farmer', 'What to talk about', ''],
      L.map((x, i) => { const f = FM[x.f]; return `<tr class="qrow" data-act="qsel" data-id="${f.id}" tabindex="0"><td><b class="num" style="color:var(--blue)">${esc(x.time)}</b>${i === 0 ? '<div class="rm">Next</div>' : ''}</td><td>${who(f)}</td><td>${esc(x.why)}</td><td class="n"><button class="btn sm" data-act="qsel" data-id="${f.id}">Open brief</button></td></tr>` }), 'No callbacks booked for today.') }
  if (k === 'talk') { const L = callLog().filter(c => c.secs).sort((a, b) => b.secs - a.secs);
    const tag = s => s < 180 ? chip('warm', 'Short') : s > 360 ? chip('blue', 'Long') : chip('ok', 'In goal');
    return head('Talk time per call', 'Goal 3–6 min · ' + L.filter(c => c.secs < 180).length + ' short · ' + L.filter(c => c.secs > 360).length + ' long', ['Time', 'Farmer', 'Topic', 'Talk time', ''],
      L.map(c => `<tr class="qrow" data-act="qsel" data-id="${c.f.id}" tabindex="0"><td class="num">${hm(c)}</td><td>${who(c.f)}</td><td>${esc(c.topic)}</td><td class="n num"><b>${mmss(c.secs)}</b></td><td>${tag(c.secs)}</td></tr>`), 'No timed calls yet today.') }
  return '';
}
/* who to call today, and why: overdue and due follow-ups, hot AI-call leads, farmers without POP, must-do items this stage */
/* today's queue holds two kinds of calls: farmers from uploaded call lists (and undecided farmers coming back round), and callbacks */
function callQueue() {
  const rows = new Map(), fu = allFup(), done = new Set();
  const put = (f, r) => { if (!f || rows.has(f.id)) return; rows.set(f.id, Object.assign({f}, r)) };
  (OPS.DONE_TODAY || []).forEach(x => { const f = FM[x.f]; if (f) { done.add(f.id); put(f, {pri: 'med', st: 'done', status: 'Done · ' + x.talk, purpose: x.note, last: 'Today, ' + x.at}) } });
  S.log.filter(l => l.d === TODAY && ['Call', 'Visit'].includes(l.ch) && l.out !== 'Not reachable').forEach(l => { const f = FM[l.f]; if (f && !done.has(f.id)) { done.add(f.id); rows.delete(f.id); put(f, {pri: 'med', st: 'done', status: 'Done · ' + l.out, purpose: l.note, last: 'Today' + (l.at ? ', ' + l.at : '')}) } });
  fu.filter(x => x.due <= TODAY).forEach(x => { const f = FM[x.f], late = x.due < TODAY, n = -diff(TODAY, x.due);
    put(f, {pri: late || x.time ? 'high' : 'med', st: 'callback', status: 'Callback', sub: x.time ? x.time : late ? n + (n === 1 ? ' day' : ' days') + ' overdue' : 'Today', late, purpose: x.why, fu: x}) });
  const calledSince = (fid, d) => S.log.some(l => l.f === fid && l.d >= d && l.d < TODAY && ['Call', 'Visit'].includes(l.ch) && l.out !== 'Not reachable');
  S.undecided.filter(u => u.back <= TODAY && !u.closed).forEach(u => { const f = FM[u.f]; if (!f || calledSince(u.f, u.back)) return;
    put(f, {pri: 'med', st: 'list', status: 'From list', up: 'Call loop', sub: 'Undecided on ' + fmt(u.at), purpose: 'Undecided last time' + (u.note ? ': ' + u.note : '') + '. Ask again.'}) });
  S.uploads.filter(u => !u.removed).forEach(u => u.rows.forEach(x => { const f = FM[x.fid]; if (!f || calledSince(x.fid, u.at.slice(0, 10))) return;
    const ex = rows.get(f.id); if (ex) { if (ex.st !== 'done') { ex.up = ex.up || u.name; if (x.pri === 'high') ex.pri = 'high' } return }
    put(f, {pri: x.pri || 'med', st: 'list', status: 'From list', up: u.name, sub: u.seeded ? '' : u.name, needPop: !f.pop.ok, purpose: x.reason || (f.pop.ok ? 'From uploaded list: ' + u.name : 'Fill crop details on the call: ' + f.pop.missing.join(', '))}) }));
  const last = f => { const L = logsOf(f.id)[0], H = histOf(f)[0], d = [L && L.d, H && H.date].filter(Boolean).sort().pop(); return d ? (d === TODAY ? 'Today' : diff(d, TODAY) === 1 ? 'Yesterday' : diff(d, TODAY) + ' days ago') : 'New farmer' };
  const PR2 = {high: 0, med: 1, low: 2};
  return [...rows.values()].map(r => Object.assign(r, {last: r.last || last(r.f)}))
    .sort((a, b) => (a.st === 'done') - (b.st === 'done') || PR2[a.pri] - PR2[b.pri] || (b.late ? 1 : 0) - (a.late ? 1 : 0) || (a.st === 'callback' ? -1 : 0) - (b.st === 'callback' ? -1 : 0));
}
/* the first time the desk opens, today's list is built from the farmers that need a call: AI-call leads, farmers without POP, must-do items */
function seedTodayList() {
  if (S.seeded) return; const have = new Set(allFup().filter(x => x.due <= TODAY).map(x => x.f)), rows = [];
  const add = (f, reason, pri) => { if (!have.has(f.id) && !rows.some(r => r.fid === f.id)) rows.push({fid: f.id, reason, pri, type: 'mine'}) };
  F.filter(f => f.va && (f.va.confirmed || []).length).forEach(f => add(f, 'AI call: ' + f.va.confirmed.map(i => (D.I[i] || {}).en || i).join(', ') + ' confirmed', 'high'));
  F.filter(f => !f.pop.ok && !f.uploaded && !f.lens).forEach(f => add(f, f.pop.nocrop ? 'Crop has no POP: log the call' : 'Fill crop details: ' + f.pop.missing.join(', '), 'med'));
  F.filter(f => f.b && !f.ended).forEach(f => { const top = recs(f).now.filter(x => x.tier === 1 && sold(x.product)); if (top.length) add(f, 'Must-do now: ' + top.slice(0, 2).map(x => x.product).join(', '), top.some(x => x.problem) ? 'high' : 'low') });
  S.uploads.unshift({id: 'U0', name: "Today's call list", seeded: true, at: TODAY + 'T08:30:00', rows, farmers: [], counts: {mine: rows.length, lens: 0, new: 0, skip: 0}});
  S.seeded = true; save();
}
function fupForm(x) {
  if (!OPEN_FORM || OPEN_FORM.id !== x.id) return '';
  if (OPEN_FORM.kind === 'done') return `<div class="inline"><div class="form">
    <label class="field"><span>How did you reach them</span><select id="fd-ch"><option>Call</option><option>WhatsApp</option><option>Visit</option></select></label>
    <label class="field"><span>Outcome</span><select id="fd-out">${OUTS.map(o => `<option>${o}</option>`).join('')}</select></label>
    <label class="field"><span>Next follow-up (optional)</span><input type="date" id="fd-next" min="${TODAY}"></label>
    <label class="field wide"><span>What was decided</span><textarea id="fd-note" placeholder="Final outcome, so the team does not need WhatsApp to know it"></textarea></label></div>
    <div class="acts" style="margin-top:8px"><button class="btn sm" data-act="fdone" data-id="${x.id}">Save and close</button><button class="btn ghost sm" data-act="cancel">Cancel</button></div></div>`;
  if (OPEN_FORM.kind === 'move') return `<div class="inline"><div class="form">
    <label class="field"><span>New date</span><input type="date" id="fm-date" min="${TODAY}" value="${addDays(TODAY, 1)}"></label>
    <label class="field"><span>Reason</span><select id="fm-why"><option>Farmer not reachable</option><option>Farmer asked for later</option><option>Field visit clashed</option><option>Waiting for delivery</option><option>Other</option></select></label></div>
    <div class="acts" style="margin-top:8px"><button class="btn sm" data-act="fmove" data-id="${x.id}">Reschedule</button><button class="btn ghost sm" data-act="cancel">Cancel</button></div></div>`;
  return '';
}
const OUTS = ['Resolved', 'Product recommended', 'Ordered', 'Follow-up needed', 'Not reachable', 'Not interested'];
/* the call brief for one farmer: why, what to say, what to recommend, weather */
function issueHi(text) { const n = norm(text), hit = Object.values(D.I).find(x => norm(x.en) === n); return hit ? hit.hi : text }
function brief4(r) {
  const f = r.f, fx = recs(f), sid = storeOf(f), top = fx.now.filter(x => sold(x.product)).slice(0, 3);
  const L = logsOf(f.id)[0], H = histOf(f)[0];
  const lastNote = L ? L.note + ' (' + fmt(L.d) + ')' : H ? 'Ordered ' + H.lines.map(l => l.p).join(', ') + ' on ' + fmt(H.date) : f.source || 'No earlier contact';
  const first = f.short.split(' ')[0], t0 = top[0], why0 = t0 ? (t0.reasons.find(x => x.factor !== 0) || {}).text : '';
  const say = r.needPop ? `नमस्ते ${first} जी, ग्रामिक से बोल रहे हैं। आप कौन सी फसल लगाए हैं, कौन सी किस्म है और बुवाई कब की थी?`
    : r.fu && /deliver/i.test(r.purpose) ? `नमस्ते ${first} जी, आपके ऑर्डर की डिलीवरी के बारे में बात करनी थी। आपके लिए कौन सा दिन ठीक रहेगा?`
    : r.fu ? `नमस्ते ${first} जी, ग्रामिक से बोल रहे हैं। पिछली बार की बात के बाद ${f.cropHi || f.cropName} की फसल अब कैसी है?${t0 ? ` इस समय ${t0.product} ${doseHi(t0.dose[0])} देना ज़रूरी है।` : ''}`
    : t0 ? `नमस्ते ${first} जी, ${f.cropHi || f.cropName} की इस अवस्था में ${issueHi(why0 || '')} पर ध्यान देना ज़रूरी है। ${t0.product} ${doseHi(t0.dose[0])} दें।`
    : `नमस्ते ${first} जी, ग्रामिक से बोल रहे हैं। आपकी फसल अभी कैसी है?`;
  const days = forecast(f.place), w = days ? cropWx(f, days) : null;
  const wx = !days ? '' : `${f.place.place}: ${w.lines.find(l => l.k !== 'soil') ? (w.lines.find(l => l.k !== 'soil').title || '') + '. ' : ''}${w.spray.length ? 'Good spray days: ' + w.spray.slice(0, 4).map(d => wkd(d.d)).join(', ') + '.' : 'No good spray day this week.'}`;
  const prods = top.map(x => { const q = stock(sid, x.product), rr = x.reasons.find(z => z.factor !== 0) || {};
    return {p: x.product, why: (rr.factorLabel ? rr.factorLabel + ': ' : '') + (rr.text || 'In POP for this stage'), dose: perAcre(x.dose[0]),
      stock: q > 9 ? 'In stock · ' + q : q > 0 ? 'Low · ' + q : 'Out of stock', ok: q > 9} });
  const rows = f.b ? f.b.stage.rows : [], at = f.b ? (f.b.stage.status === 'after' ? rows.length : f.b.stage.idx) : -1;
  return {lastNote, say, wx, prods, band: rows.map((x, k) => k < at ? 'past' : k === at ? 'cur' : 'fut'), dayLabel: f.b && f.b.stage.das != null && f.b.stage.das >= 0 ? 'Day ' + f.b.stage.das : f.b ? '' : 'Stage unknown'};
}
function vToday() {
  const T = (ME.target && ME.target.calls) || 40, tc = todayCalls(), done = tc.calls.length, con = tc.con.length, nc = done - con, Q = callQueue();
  const open = Q.filter(r => r.st !== 'done'), fu = allFup().filter(x => x.due <= TODAY), left = Math.max(0, T - done);
  const shift = ME.shift || [9, 18], hrsLeft = Math.max(0, shift[1] - Math.max(tc.hrNow, shift[0]));
  const n = new Date(), greet = n.getHours() < 12 ? 'Good morning' : n.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const pct = v => Math.min(100, Math.round(v / T * 1000) / 10), mmss = s => Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's', hl = h => (h % 12 || 12) + '';
  const ms = myStats('today'), cbs = allFup().filter(x => x.due === TODAY && x.time).sort((a, b) => Date.parse('2000/1/1 ' + a.time) - Date.parse('2000/1/1 ' + b.time));
  const avail = S.avail !== 'break';
  /* queue + selection */
  const TABS = [['all', 'All', open.length], ['list', 'From list', open.filter(r => r.st === 'list').length], ['callback', 'Callbacks', open.filter(r => r.st === 'callback').length], ['done', 'Completed', Q.filter(r => r.st === 'done').length]];
  if (!TABS.some(t => t[0] === QTAB)) QTAB = 'all';
  const showQ = Q.filter(r => QTAB === 'all' ? r.st !== 'done' : r.st === QTAB);
  if (!QSEL || !Q.some(r => r.f.id === QSEL)) QSEL = (open[0] || Q[0] || {f: {}}).f.id;
  const sel = Q.find(r => r.f.id === QSEL);
  const PRL = {high: 'High priority', med: 'Medium priority', low: 'Low priority'};
  const stCls = r => r.st === 'done' ? 'done' : r.st === 'callback' ? (r.late ? 'overdue' : 'callback') : 'upl';
  const qrow = r => { const f = r.f, x = r.fu, isOpen = x && OPEN_FORM && OPEN_FORM.id === x.id;
    return `<tr class="qrow${f.id === QSEL ? ' qsel' : ''}" data-act="qsel" data-id="${f.id}" tabindex="0" aria-selected="${f.id === QSEL}"><td><div class="qf"><span class="pri ${r.pri}" title="${PRL[r.pri]}" aria-label="${PRL[r.pri]}"></span><div class="qfn"><span class="qn">${esc(f.short)}</span><div class="rm num">${maskPh(f.phone)}</div></div></div></td>
     <td>${esc(f.village)}<div class="rm">${esc(f.district)}</div></td>
     <td>${esc(f.cropName)}<div class="rm">${esc(f.b ? f.stageEn : f.pop.nocrop ? 'No POP' : 'Stage unknown')}</div></td>
     <td class="qp">${esc(r.purpose)}</td><td class="rm" style="white-space:nowrap">${esc(r.last)}</td>
     <td><span class="qs ${stCls(r)}">${esc(r.status)}</span>${r.sub ? `<div class="rm qsub2">${esc(r.sub)}</div>` : ''}</td>
     <td class="qa">${r.st === 'done' ? `<button class="btn ghost sm" data-act="qsel" data-id="${f.id}">Notes</button>` : `<button class="btn sm" data-act="qopen" data-id="${f.id}" aria-label="${CALLING === f.id ? 'On call with' : 'Call'} ${esc(f.short)}">${CALLING === f.id ? 'On call' : 'Call'}</button>`}</td></tr>
     ${isOpen ? `<tr class="qform"><td colspan="7">${fupForm(x)}</td></tr>` : ''}` };
  /* call brief */
  let briefHtml = '<p class="empty">Nobody left to call today.</p>';
  if (sel) { const f = sel.f, b = brief4(sel);
    const calling = CALLING === f.id && sel.st !== 'done';
    briefHtml = `<div class="cbh"><div><span class="lbl2 g">Call brief</span><h2 class="cbn">${esc(f.short)}</h2><span class="rm num">${esc(f.phone)} · ${esc(f.village)}, ${esc(f.district)} · ${f.acres} ac</span></div><span class="qs ${stCls(sel)}">${esc(sel.status)}</span></div>
     <div class="cbs"><div class="cbsl"><b>${esc(f.cropName)}${f.b ? ' · ' + esc(f.stageEn) : ''}</b><span class="rm num">${esc(b.dayLabel)}</span></div>${b.band.length ? `<div class="cbband">${b.band.map(k => `<i class="${k}"></i>`).join('')}</div>` : ''}</div>
     <div class="cbbox"><span class="lbl2">Why you are calling</span><span>${esc(sel.purpose)}</span><span class="rm">Last time: ${esc(b.lastNote)}</span></div>
     <div class="cbsay"><span class="lbl2 g">Say this</span><span class="cbhi">${esc(b.say)}</span><button class="lk small" data-copy="${esc(b.say)}">Copy</button></div>
     <div class="cbrec"><span class="lbl2">Recommend</span>${b.prods.length ? b.prods.map(p => `<div class="cbp"><div style="min-width:0"><b>${esc(p.p)}</b><div class="rm">${esc(p.why)}</div></div><div class="cbpr"><b class="num">${esc(p.dose)}</b><span class="${p.ok ? 'ok' : 'lo'}">${esc(p.stock)}</span></div></div>`).join('')
       : `<p class="rm" style="margin:4px 0 0">${f.b ? 'No product due at this stage.' : 'Fill crop details on the farmer page to get recommendations.'}</p>`}</div>
     ${b.wx ? `<div class="cbwx">${icon2('cal').replace('<svg', '<svg width="18" height="18"')}<span>${esc(b.wx)}</span></div>` : ''}
     ${sel.st === 'done' ? `<p class="note">${esc(sel.status)}. <button class="lk" data-farmer="${f.id}" data-tab="crop">Open farmer profile</button></p>`
       : `<div class="cbacts"><button class="btn" data-act="qopen" data-id="${f.id}">${calling ? 'Back to call' : 'Call ' + esc(f.short)}</button></div>`}`;
  }
  /* charts */
  const hrs = []; for (let h = shift[0]; h < shift[1]; h++) hrs.push(h);
  const perHr = Math.ceil(T / Math.max(1, shift[1] - shift[0])), byHr = h => tc.calls.filter(c => c.hr === h).length, mx = Math.max(perHr + 2, ...hrs.map(byHr));
  const OUTC = [['Connected', 'var(--green)'], ['No answer', '#E8A15A'], ['Busy', '#F3CF8E'], ['Switched off', '#9AA8A1'], ['Wrong number', 'var(--hot)']].map(([l, c]) => ({l, c, n: tc.calls.filter(x => x.out === l).length})).filter(o => o.n);
  const ordN = ms.td.filter(o => !DEAD.includes(o.status)).length, ordV = ms.sum(ms.tdNet);
  const interested = Math.max(ordN, Math.round(con * 0.4) + S.log.filter(l => l.d === TODAY && ['Product recommended', 'Follow-up needed'].includes(l.out)).length);
  const alerts = fieldAlerts();
  const kt = (lab, v, sub, cls, k) => k ? `<button class="qk ${cls || ''}${QK === k ? ' on' : ''}" type="button" data-act="qk" data-k="${k}" aria-expanded="${QK === k}"><span class="qkl">${lab}</span><b class="num">${v}</b><span class="qks">${sub}</span><span class="qkc">${QK === k ? 'Hide list' : 'Show list'}</span></button>`
    : `<div class="qk"><span class="qkl">${lab}</span><b class="num">${v}</b><span class="qks">${sub}</span></div>`;
  const card = (h, sub, body) => `<section class="card qc"><div class="qch"><h2>${h}</h2>${sub ? `<span class="rm">${sub}</span>` : ''}</div>${body}</section>`;
  return `<div class="stack qdesk">
  <header class="qhead"><div><div class="rm">${dt(TODAY).toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'})} · ${esc(ME.hub)} · ${F.length} farmers assigned</div>
    <h1>${greet}, ${esc(ME.name.split(' ')[0])} — ${left ? left + ' calls to go' : 'target done'}</h1>
    <div class="qsub">Shift ${hl(shift[0])}:00 AM – ${hl(shift[1])}:00 PM · Last synced ${new Date().toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'}).toUpperCase()}</div></div>
   <div class="acts" style="align-items:center"><div class="avl" role="group" aria-label="Your status"><button type="button" data-act="avail" data-k="on" aria-pressed="${avail}">Available</button><button type="button" data-act="avail" data-k="break" aria-pressed="${!avail}">On break</button></div>
    <button class="btn ghost qbig" data-act="upopen">${icon2('up')}Upload list</button>${open.length ? `<button class="btn qbig" data-act="qnext">${icon2('call')}Start next call</button>` : ''}</div></header>
  <section class="card qtgt"><div class="qtl"><span class="lbl2">Daily call target</span>
    <div class="qtn"><b class="num">${done}</b><span class="num">/ ${T} calls</span><em>${left ? (hrsLeft ? 'Need ~' + Math.ceil(left / hrsLeft) + ' calls/hour to finish by ' + hl(shift[1]) + ' PM' : left + ' calls short of target') : 'Target reached'}</em></div>
    <div class="qbar" role="img" aria-label="${con} connected, ${nc} not connected, ${left} remaining of ${T}"><i style="width:${pct(con)}%"></i><i class="nc" style="width:${pct(nc)}%"></i></div>
    <div class="qkeys"><span><i class="k cur"></i>Connected ${con}</span><span><i class="k nc"></i>Not connected ${nc}</span><span><i class="k future"></i>Remaining ${left}</span></div></div>
   <div class="qks5">${kt('Connected', con, (done ? Math.round(con / done * 100) : 0) + '% connect rate', '', 'con')}${kt('Pending calls', open.length, open.filter(r => r.pri === 'high').length + ' high priority', 'w', 'pend')}${kt('Orders from calls', ordN, rupee(ordV) + ' booked', 'g', 'ord')}
     ${kt('Callbacks due', fu.length, fu.filter(x => x.due < TODAY).length + ' overdue' + (cbs.length ? ' · next ' + cbs[0].time : ''), 'b', 'fu')}${kt('Undecided', S.undecided.filter(u => !u.closed && u.back > TODAY).length, 'back in the queue later', 'u', 'und')}${kt('Avg talk time', tc.avg ? mmss(tc.avg) : '–', 'Goal 3–6 min')}</div>
   ${QK ? tileList(QK, {ms, cbs}) : ''}</section>
  <div class="qcols"><section class="card qc qmain"><div class="qch qqh"><div><h2>Call queue</h2><div class="rm">Farmers from your call lists and your callbacks. Tap a farmer to open the call brief.</div></div>
     <div class="qtabs" role="tablist">${TABS.map(([k, l, c]) => `<button class="qtb" role="tab" type="button" data-act="qtab" data-k="${k}" aria-selected="${QTAB === k}">${l} · ${c}</button>`).join('')}</div></div>
    ${showQ.length ? `<div class="tw2"><table class="qt"><thead><tr><th>Farmer</th><th>Village</th><th>Crop · stage</th><th>Why call</th><th>Last contact</th><th>Status</th><th class="n">Action</th></tr></thead><tbody>${showQ.map(qrow).join('')}</tbody></table></div>` : `<p class="empty">${QTAB === 'done' ? 'No calls logged yet today.' : 'Nobody in this list right now.'}</p>`}
    <div class="qfoot"><span class="rm">Showing ${showQ.length} farmers · priority <span class="pri high"></span> High <span class="pri med"></span> Medium <span class="pri low"></span> Low</span><button class="lk" data-go="farmers">View all ${F.length} assigned farmers →</button></div></section>
   <aside class="qside2">
    <section class="card qc cb">${briefHtml}</section>
    ${card('Callbacks booked today', cbs.length + ' slots', cbs.length ? cbs.map((x, k) => `<button type="button" class="qcb${k === 0 ? ' nx' : ''}" data-act="qsel" data-id="${x.f}"><b class="num">${esc(x.time)}</b><span><span class="qn">${esc(FM[x.f].short)}</span><span class="rm">${esc(x.why)}</span></span>${k === 0 ? '<em>Next</em>' : !FM[x.f].pop.ok ? '<em class="v">New</em>' : ''}</button>`).join('') : '<p class="empty">No callbacks booked for today.</p>')}
   </aside></div>
  <div class="qgrid">
   ${card('Calls by hour', 'Goal ' + perHr + ' an hour', `<div class="qhr" role="img" aria-label="Calls per hour today"><div class="qgoal" style="bottom:${(perHr / mx * 120 + 0).toFixed(0)}px"></div>${hrs.map(h => { const v = byHr(h), fut = h > tc.hrNow;
      return `<div class="qhc"><span class="num">${fut ? '' : v || '–'}</span><i class="${fut ? 'fut' : v >= perHr ? 'hit' : ''}" style="height:${fut || !v ? 3 : Math.max(4, v / mx * 120)}px"></i></div>` }).join('')}</div>
      <div class="qhx">${hrs.map(h => `<span>${hl(h)}</span>`).join('')}</div>`)}
   ${card('Call outcomes', done + ' attempts', done ? `<div class="qbar thin">${OUTC.map(o => `<i style="width:${(o.n / done * 100).toFixed(1)}%;background:${o.c}"></i>`).join('')}</div>
      <ul class="qlg">${OUTC.map(o => `<li><span><i style="background:${o.c}"></i>${o.l}</span><b class="num">${o.n}</b></li>`).join('')}</ul>` : '<p class="empty">No calls yet today.</p>')}
   ${card('Calls to orders', rupee(ordV) + ' today', [['Connected', con, 'calls', 'f1'], ['Interested', interested, 'asked price or product', 'f2'], ['Ordered', ordN, 'orders placed', 'f3']].map(([l, v, nt, c]) => `<div class="qtp"><div><span>${l}</span><b class="num">${v} <span class="rm" style="font-weight:400">${nt}</span></b></div><div class="bar fn"><i class="${c}" style="width:${con ? Math.round(v / con * 100) : 0}%"></i></div></div>`).join('')
      + `<div class="qwt"><div><span class="rm">Conversion</span><b class="num">${con ? Math.round(ordN / con * 100) : 0}%</b></div><div><span class="rm">Avg order</span><b class="num">${ordN ? rupee(ordV / ordN) : '–'}</b></div></div>`)}
   ${card('Field alerts to share on calls', '', alerts.length ? alerts.map(a => `<div class="qal ${a.k}"><span class="qat">${esc(a.tag)}</span><b>${esc(a.title)}</b><span>${esc(a.body)}</span></div>`).join('') : '<p class="empty">No alerts for your farmers this week.</p>')}
  </div></div>`;
}
/* alerts the agronomist can share on today's calls, from the farmers' pincode forecasts and crop stages */
function fieldAlerts() {
  const out = [], seen = new Set(), add = a => { if (!seen.has(a.key)) { seen.add(a.key); out.push(a) } };
  const byDist = {}; F.forEach(f => { (byDist[f.place.district] = byDist[f.place.district] || []).push(f) });
  Object.entries(byDist).forEach(([dist, L]) => { const days = forecast(L[0].place); if (!days) return;
    const rain = days.filter(d => dayFlags(d).rain), windy = days.filter(d => dayFlags(d).windy);
    if (rain.length) add({key: 'wx', k: 'sky', tag: 'Weather', title: `Rain likely ${dlist(rain.slice(0, 2))} in ${dist}`, body: 'Ask farmers to hold sprays and urea until it passes; spray a day after with sticker.'});
    else if (windy.length) add({key: 'wx', k: 'warm', tag: 'Weather', title: `Strong wind ${dlist(windy)} in ${dist}`, body: 'No spraying on those days; spray early morning on a calm day.'}) });
  const risk = {}; F.filter(f => f.b).forEach(f => f.b.watch.filter(w => w.risk === 'H' && w.isNew).forEach(w => { const k = w.en + '|' + f.cropName; (risk[k] = risk[k] || {w, crop: f.cropName, d: new Set(), n: 0}); risk[k].d.add(f.place.district); risk[k].n++ }));
  Object.values(risk).sort((a, b) => b.n - a.n).slice(0, 1).forEach(r => add({key: 'risk', k: 'hot', tag: 'Pest risk', title: `${r.w.en} risk high in ${r.crop.toLowerCase()} (${[...r.d].slice(0, 2).join(', ')})`, body: `Ask about: ${cap(r.w.symptom || '')}.`}));
  const ending = F.filter(f => f.b && !f.ended && f.b.stage.daysLeft != null && f.b.stage.daysLeft <= 3);
  if (ending.length) add({key: 'cal', k: 'warm', tag: 'Crop calendar', title: `${ending.length} farmer${ending.length > 1 ? 's' : ''} move to the next stage this week`, body: ending.slice(0, 3).map(f => f.short.split(' ')[0] + ' (' + f.cropName + ')').join(', ') + ': tell them what the next stage needs.'});
  return out.slice(0, 3);
}
/* ================= Farmers list ================= */
function vFarmers() {
  const dists = [...new Set(F.map(f => f.place.district))].sort(), crops = [...new Set(F.map(f => f.cropName))].sort();
  const q = FSEARCH.toLowerCase(), ords = allOrders();
  const L = F.filter(f => (!q || (f.name + ' ' + f.pin + ' ' + f.id + ' ' + f.village).toLowerCase().includes(q)) && (!FDIST || f.place.district === FDIST) && (!FCROP || f.cropName === FCROP) && (!FPOP || (FPOP === 'need' ? !f.pop.ok : FPOP === 'up' ? upOf(f.id).length : f.pop.ok)) && (!FUP2 || upOf(f.id).some(u => u.id === FUP2)));
  const UL = S.uploads.slice().reverse(), fu2 = S.uploads.find(u => u.id === FUP2);
  const upCard = UL.length ? `<section class="card upcard"><div class="qch"><h2>Uploaded call lists</h2><span class="rm">${UL.length} list${UL.length > 1 ? 's' : ''} · farmers are matched to Lens and their POP is fetched</span></div>
    <div class="tw2"><table class="uplt"><thead><tr><th>List</th><th>Uploaded</th><th class="n">Your farmers</th><th class="n">Found in Lens</th><th class="n">New</th><th class="n">Called</th><th></th></tr></thead><tbody>
    ${UL.map(u => { const called = u.rows.filter(x => logsOf(x.fid).some(l => l.d >= u.at.slice(0, 10) && ['Call', 'Visit'].includes(l.ch))).length;
      return `<tr${u.id === FUP2 ? ' class="qsel"' : ''}><td><b>${esc(u.name)}</b>${u.removed ? ' ' + chip('mute', 'Removed from queue') : ''}<div class="rm">${u.rows.length} farmers</div></td><td class="num">${fmt(u.at.slice(0, 10))}<div class="rm">${new Date(u.at).toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'})}</div></td>
      <td class="n">${u.counts.mine}</td><td class="n">${u.counts.lens}</td><td class="n">${u.counts.new}</td><td class="n">${called} / ${u.rows.length}</td>
      <td class="n"><div class="acts" style="justify-content:flex-end">${u.id === FUP2 ? `<button class="btn ghost sm" data-act="upshowall">Show all farmers</button>` : `<button class="btn ghost sm" data-act="upshow" data-id="${u.id}">Show farmers</button>`}${u.removed ? '' : `<button class="lk small" data-act="upremove" data-id="${u.id}">Remove from queue</button>`}</div></td></tr>` }).join('')}</tbody></table></div></section>` : '';
  return `${upCard}<div class="pagehead"><div><h2>Farmers${fu2 ? ' · ' + esc(fu2.name) : ''}</h2><p>${L.length} of ${F.length} · open a farmer for crop plan, orders, cattle, log and rating</p></div>
   <div class="acts"><button class="btn ghost" data-act="upopen">${icon2('up')}Upload list</button><input type="search" id="fsearch" placeholder="Name, pincode or ID" value="${esc(FSEARCH)}" aria-label="Search farmers">
   <select id="fdist" aria-label="District"><option value="">All districts</option>${dists.map(d => `<option${d === FDIST ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select>
   <select id="fcrop" aria-label="Crop"><option value="">All crops</option>${crops.map(d => `<option${d === FCROP ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select></div></div>
  <div class="filt" role="group" aria-label="POP status">${[['', 'All', F.length], ['ok', 'POP filled', F.filter(f => f.pop.ok).length], ['need', 'Needs crop details', F.filter(f => !f.pop.ok).length], ...(S.uploads.length ? [['up', 'From uploaded lists', F.filter(f => upOf(f.id).length).length]] : [])].map(([k, l, n]) => `<button class="chipb" type="button" data-act="fpop" data-k="${k}" aria-pressed="${FPOP === k}">${l} · ${n}</button>`).join('')}</div>
  <section class="card"><div class="tw2"><table><thead><tr><th>Farmer</th><th>Crop and stage</th><th>Pincode</th><th>Rating</th><th>Last order</th><th>Next follow-up</th><th>Open orders</th></tr></thead><tbody>
  ${L.map(f => { const r = rating(f), fu = fupOf(f.id)[0], oo = ords.filter(o => o.f === f.id && OPEN.includes(o.status));
    return `<tr><td><button class="lk" data-farmer="${f.id}">${esc(f.short)}</button><div class="rm">${esc(f.village)}, ${esc(f.district)} · ${f.acres} ac</div>
     <div class="chips">${f.lens || f.uploaded ? '' : f.sample ? SAMPLE : chip('ok', 'Lens ' + f.id)}${OPS.DUP[f.id] ? chip('hot', 'Possible duplicate') : ''}${(OPS.CATTLE[f.id] || S.cattle[f.id]) ? chip('soil', 'Cattle') : ''}${f.va ? chip('violet', 'AI call') : ''}${f.filled ? chip('ok', 'Filled on call') : ''}${upOf(f.id).length ? chip('upl', 'List: ' + upOf(f.id).slice(-1)[0].name) : ''}${f.lens ? chip('blue', 'Lens ' + f.id) : f.uploaded ? chip('warm', 'New from list') : ''}</div></td>
     <td>${esc(f.cropName)} <span class="rm">${esc(f.variety || '')}</span><div class="rm">${f.b ? esc(f.b.stage.das != null && f.b.stage.das >= 0 ? 'Day ' + f.b.stage.das + ' · ' : '') + esc(f.stageEn) : `<span class="chip warm">${esc(f.pop.nocrop ? 'No POP for this crop' : 'Needs ' + f.pop.missing.join(', '))}</span>`}</div></td>
     <td class="num">${esc(f.pin)}</td><td><span class="chip ${r.band === 'Strong' ? 'ok' : r.band === 'Possible' ? 'warm' : 'mute'}">${r.sc} · ${r.band}</span>${r.needsSenior ? '<div class="rm">needs senior check</div>' : ''}</td>
     <td>${(() => { const h = histOf(f)[0]; return h ? `<span class="num">${fmt(h.date)}</span><div class="rm">${diff(h.date, TODAY)} days ago</div>` : '<span class="muted small">Never</span>' })()}</td>
     <td>${fu ? `<span class="chip ${fu.due < TODAY ? 'solid' : fu.due === TODAY ? 'warm' : 'mute'}">${relDue(fu.due)}</span>` : '<span class="muted small">None set</span>'}</td>
     <td class="n">${oo.length || '–'}</td></tr>` }).join('')}</tbody></table></div></section>`;
}

/* ================= Farmer page ================= */
function vFarmer() {
  const f = FM[CUR]; if (!f) return '<p class="empty">Farmer not found.</p>';
  const r = rating(f), info = f.place, days = forecast(info), w = days ? cropWx(f, days) : null;
  const cat = [...(OPS.CATTLE[f.id] || []), ...(S.cattle[f.id] || [])], logs = logsOf(f.id), ords = allOrders().filter(o => o.f === f.id);
  const tabs = [['crop', 'Crop plan', ''], ['orders', 'Orders', histOf(f).length + ords.filter(o => OPEN.includes(o.status)).length || ''], ['cattle', 'Cattle', cat.length || '']];
  if (!tabs.some(x => x[0] === FTAB)) FTAB = 'crop';
  const dup = OPS.DUP[f.id], fu = fupOf(f.id)[0];
  const body = FTAB === 'orders' ? tOrders(f, ords) : FTAB === 'cattle' ? tCattle(f, cat) : tCrop(f);
  const onCall = CALLING === f.id;
  return `${onCall ? '' : `<button class="lk" data-act="back" style="margin-bottom:8px">← ${RET && RET.view === 'today' ? 'Back to call queue' : RET && RET.view === 'after' ? 'Back to After calls' : RET && RET.view === 'me' ? 'Back to My profile' : 'All farmers'}</button>`}${onCall ? `<div class="cbcall oncall"><span class="cbdot"></span><div><b>On call with ${esc(f.short)}</b><span class="num">${esc(f.phone)}</span></div><button class="btn ghost sm" data-copy="${esc(f.phone)}">Copy number</button><button class="btn sm cbend" data-act="qcomplete">Complete call</button></div>` : ''}
  <section class="card"><div class="fhead"><div><h2>${esc(f.short)}</h2>
    <div class="facts"><span>${esc(f.village)}, ${esc(f.district)}</span><span>Pincode <b class="num">${esc(f.pin)}</b></span><span><b class="num">${f.acres}</b> acres</span><span>Phone <b class="num">${esc(f.phone)}</b> <button class="lk small" data-copy="${esc(f.phone)}">Copy</button></span><span>BSO <b>${esc((OPS.BSOS.find(b => b.id === f.bso) || {}).name || '–')}</b></span></div>
    <div class="chips" style="margin-top:6px">${f.lens ? chip('blue', 'Lens ID ' + f.id + ' · fetched from Lens') : f.uploaded ? chip('warm', 'New farmer from uploaded list') : f.sample ? SAMPLE : chip('ok', 'Lens ID ' + f.id)}${upOf(f.id).map(u => chip('upl', 'List: ' + u.name + ' · ' + fmt(u.at.slice(0, 10)))).join('')}${!f.pop.ok ? chip('solid', f.pop.nocrop ? 'No POP for this crop' : 'POP not filled') : ''}${(() => { const ok = histOf(f).filter(o => o.status !== 'Returned'); return ok.length ? chip('blue', ok.length + ' orders · ' + rupee(ok.reduce((t, o) => t + o.lines.reduce((u, l) => u + l.amt, 0), 0))) : chip('mute', 'No orders yet') })()}${(OPS.IVR[f.id] || []).map(x => chip('violet', 'IVR heard: ' + x)).join('')}${fu ? chip(fu.due < TODAY ? 'solid' : 'warm', 'Follow-up ' + relDue(fu.due)) : ''}</div>
    ${dup ? `<p class="note hot" style="margin-top:8px">Possible duplicate record: Lens ID ${esc(dup.id)}. ${esc(dup.why)}. Merge before creating orders.</p>` : ''}</div>
   <div style="display:flex;gap:12px;align-items:center"><div class="score ${r.band}" title="Rating">${r.sc}</div><div class="small"><b>${r.band}</b> lead<br><span class="muted">${r.needsSenior ? 'Needs senior check' : 'Checked by ' + esc(OPS.RATERS[r.by][0])}</span></div></div></div>
   <div class="acts" style="margin-top:12px"><button class="btn" data-act="drawer">Products (Lens)</button><button class="btn ghost" data-act="catopen">Product catalog</button></div></section>
  ${wxCard(f, info, days, w)}
  <section class="card"><div class="tabs" role="tablist">${tabs.map(([k, l, n]) => `<button class="tab" role="tab" type="button" data-act="tab" data-tab="${k}" aria-selected="${FTAB === k}">${l}${n !== '' ? `<b>${n}</b>` : ''}</button>`).join('')}</div><div style="margin-top:12px">${body}</div></section>`;
}
/* weather and crop advice: one line when closed, the full forecast and advice when opened */
function wxCard(f, info, days, w) {
  const t = days ? (days.find(d => d.d === TODAY) || days[0]) : null, risks = w ? w.lines.filter(l => l.k !== 'soil').length : 0;
  const sum = days ? `<span class="wxs">${chip('mute', (t.d === TODAY ? 'Today ' : wkd(t.d) + ' ') + t.max + '° / ' + t.min + '° · ' + t.pop + '% rain')}${w.spray.length ? chip('ok', 'Spray on ' + w.spray.length + ' of ' + days.length + ' days') : chip('warm', 'No good spray day')}${risks ? chip('warm', risks + ' weather advice' + (risks > 1 ? 's' : '')) : chip('ok', 'No weather risk')}</span>` : `<span class="wxs">${chip('warm', 'No forecast')}</span>`;
  return `<section class="card wxcard${WXOPEN ? ' open' : ''}"><div class="wxhead"><button type="button" class="wxtog" data-act="wxtog" aria-expanded="${WXOPEN}"><span class="wxt"><b>Weather and crop advice</b><small>${esc(info.place)} ${esc(f.pin)} · ${esc(f.b ? f.cropName + ', ' + f.stageEn.toLowerCase() : 'crop advice after crop details are filled')}</small></span>${WXOPEN ? '' : sum}<span class="wxc">${WXOPEN ? 'Hide' : 'Show'}<i aria-hidden="true">›</i></span></button>
   ${days && WXOPEN ? `<button class="btn ghost sm" data-act="wxmsg" data-id="${f.id}">Copy Hindi advice for WhatsApp</button>` : ''}</div>
   ${!WXOPEN ? '' : days ? dayCards(days) + `<div class="sprayrow"><div><span class="sl">Spray on</span><div class="chips">${w.spray.length === days.length ? chip('ok', 'All 7 days') : w.spray.length ? w.spray.map(d => chip('ok', wkd(d.d) + ' ' + fmt(d.d))).join('') : chip('warm', 'No good spray day this week')}</div></div>
     ${w.nospray.length ? `<div><span class="sl">Avoid</span><div class="chips">${w.nospray.map(d => chip('warm', wkd(d.d) + ' ' + fmt(d.d) + ' · ' + why(d))).join('')}</div></div>` : ''}</div>
   ${w.lines.length ? `<div class="advs">${w.lines.map(advCard).join('')}</div>` : '<p class="note" style="margin-top:10px">No weather risk for this crop in the next 7 days.</p>'}${wxSrc(days)}` : `<p class="note warm">${esc(info.err || 'No forecast for this pincode.')}</p>`}</section>`;
}
/* order history placed on the crop's POP stages: what was bought in each stage vs what the POP asked for */
function stageOf(f, date) { if (!f.b) return null; const s = ENG.stageFor(f.b.cropKey, f.b.variety.variety, f.sowISO, date); return s.status === 'before' ? -1 : (s.status === 'after' || s.idx == null) ? 99 : s.idx }
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
  if (!f.b || (OPEN_FORM && OPEN_FORM.kind === 'prof')) return profForm(f);
  const st = f.b.stage, rows = st.rows, seen = S.seen[f.id] || {};
  const bar = stageBand(f);
  const nut = f.b.nutrition.filter(o => o.tier === 1 && o.id !== 'N_STOP');
  return `<div class="stagebig">${st.das != null ? `<b>Day ${st.das}</b>` : ''}<span class="sn">${esc(f.stageEn)}</span><span class="sh">${esc(f.stageHi)}</span>${st.daysLeft != null && st.status !== 'after' ? chip('mute', st.daysLeft + ' days left in this stage') : ''}</div>
  <div class="rm" style="margin-top:4px">${esc(f.b.crop)} · ${esc(f.variety)}${f.b.variety.exact ? '' : ' (POP plan of ' + esc(f.b.variety.variety) + ')'} · ${f.b.stage.isCal ? 'calendar plan' : 'sown ' + fmt(f.sowISO)}${f.filled ? ' · filled on call ' + fmt(f.filled.on) : ''} <button class="lk small" data-act="profedit">Edit crop details</button></div>${bar}
  ${f.ended ? `<p class="note warm" style="margin-top:10px">Crop is near or past harvest. Ask about the next crop and plan seed treatment and basal dose.</p>` : ''}
  ${watchBlocks(f)}
  ${nut.length ? `<section class="blk"><div class="blkh"><h3>Must-do nutrition</h3>${chip('green', nut.length + '')}</div><div class="advs">${nut.map(o => advCard({k: 'leaf', tag: 'Must do', title: o.en, sub: o.hi,
    why: o.why ? cap(o.why) : '', act: steps(o.how), products: o.products.map(p => ({p: p.p, dose: p.dose}))})).join('')}</div></section>` : ''}
  ${st.row && st.row.pop ? `<details style="margin-top:10px"><summary>POP text for this stage (Hindi)</summary><div class="pop">${esc(st.row.pop)}</div></details>` : ''}`;
}
/* ================= fill crop details while talking ================= */
let PD = null;   // draft of the crop details form
function profDraft(f) {
  if (PD && PD.id === f.id) return PD;
  const ck = f.crop ? ENG.resolveCrop(f.crop) : '';
  const vs = ck ? Object.keys(D.P[ck].varieties) : [], v = f.variety && vs.find(x => norm(x) === norm(f.variety));
  return PD = {id: f.id, crop: ck || (f.crop ? '__other' : ''), other: ck ? '' : (f.crop || ''), variety: v || (f.variety ? '__unsure' : ''), mode: 'date', sow: f.sowISO || '', stage: '', acres: f.acres || '', asked: f.variety || ''};
}
function draftSow(d) {
  if (d.mode === 'date') return d.sow;
  const vk = d.variety === '__unsure' ? Object.keys(D.P[d.crop].varieties)[0] : d.variety, r = d.stage !== '' && D.P[d.crop].varieties[vk].das ? D.P[d.crop].varieties[vk].das[+d.stage] : null;
  return r ? addDays(TODAY, -Math.round((r.a + Math.max(r.a, r.b)) / 2)) : '';
}
function profForm(f) {
  const d = profDraft(f), ck = d.crop && d.crop !== '__other' ? d.crop : null, vs = ck ? Object.keys(D.P[ck].varieties).sort() : [];
  const vk = ck ? (d.variety === '__unsure' ? vs[0] : d.variety) : null, cal = ck && vk && isCalOnly(ck, vk), rows = ck && vk && D.P[ck].varieties[vk].das ? D.P[ck].varieties[vk].das : [];
  const sow = ck && vk && !cal ? draftSow(d) : '';
  let prev = '';
  if (ck && vk && (cal || sow)) { const b = ENG.brief({crop: ck, variety: vk, sowing_date: sow || TODAY}, TODAY), st = b.stage;
    prev = `<div class="pfprev"><span class="sl">Stage today</span><b>${st.status === 'before' ? 'Not sown yet' : st.status === 'after' ? 'Past last stage (harvest)' : (st.das != null ? 'Day ' + st.das + ' · ' : '') + esc(st.row.en)}</b> <span class="rm">${esc(st.row ? st.row.hi : '')}</span>${d.variety === '__unsure' ? `<div class="rm">Variety not known: using the POP plan of ${esc(vk)}</div>` : ''}</div>` }
  const edit = !!f.b, miss = f.pop.missing;
  const hd = edit ? `<h3>Edit crop details</h3>` : `<h3>${f.pop.nocrop ? 'No POP for ' + esc(f.crop) : 'Fill crop details to build the POP plan'}</h3>
    <p class="sub" style="margin:2px 0 0">${f.pop.nocrop ? 'This crop is not in the POP data. If the farmer grows another crop too, pick it below; otherwise log the call and add products by hand.' : 'Ask the farmer while you are on the call. ' + (miss.length ? 'Missing: <b>' + esc(miss.join(', ')) + '</b>.' : '')}${f.source ? ` <span class="rm">Lead source: ${esc(f.source)}</span>` : ''}</p>`;
  const say = `<div class="pfsay"><span class="sl">Ask</span><ol>
    <li>आप कौन सी फसल लगाए हैं? <span class="rm">Which crop?</span></li><li>कौन सी किस्म / बीज है? <span class="rm">Which variety or seed?</span></li>
    <li>बुवाई / रोपाई कब की थी? <span class="rm">When was it sown or transplanted?</span></li><li>कितने एकड़ में? <span class="rm">How many acres?</span></li></ol></div>`;
  return `<section class="pf${edit ? '' : ' need'}">${hd}${edit ? '' : say}
   <div class="form" style="margin-top:12px">
    <label class="field"><span>Crop</span><select id="pf-crop"><option value="">Choose crop</option>${POPCROPS.map(k => `<option value="${esc(k)}"${d.crop === k ? ' selected' : ''}>${esc(D.P[k].crop)}</option>`).join('')}<option value="__other"${d.crop === '__other' ? ' selected' : ''}>Other crop (no POP)</option></select></label>
    ${d.crop === '__other' ? `<label class="field"><span>Crop name</span><input type="text" id="pf-other" value="${esc(d.other)}" placeholder="e.g. Strawberry"></label>` : ''}
    ${ck ? `<label class="field"><span>Variety</span><select id="pf-var"><option value="">Choose variety</option>${vs.map(v => `<option${d.variety === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}<option value="__unsure"${d.variety === '__unsure' ? ' selected' : ''}>Not sure / other${d.asked && d.variety === '__unsure' ? ' (' + esc(d.asked) + ')' : ''}</option></select></label>` : ''}
    <label class="field"><span>Acres</span><input type="number" id="pf-acres" min="0" step="0.5" value="${esc(d.acres)}"></label>
    ${ck && vk && !cal ? `<div class="field wide"><span>Sowing / transplant</span><div class="seg3" role="group" aria-label="How to enter sowing">
       <button type="button" data-act="pfmode" data-m="date" aria-pressed="${d.mode === 'date'}">Farmer knows the date</button><button type="button" data-act="pfmode" data-m="stage" aria-pressed="${d.mode === 'stage'}">Pick the stage he describes</button></div></div>
      ${d.mode === 'date' ? `<label class="field"><span>Sowing / transplant date</span><input type="date" id="pf-sow" max="${TODAY}" value="${esc(d.sow)}"></label>`
        : `<label class="field wide"><span>Stage the crop is in now</span><select id="pf-stage"><option value="">Choose stage</option>${rows.map((r, i) => `<option value="${i}"${String(d.stage) === String(i) ? ' selected' : ''}>${esc(r.en)} · ${esc(r.hi)} (day ${r.a}–${Math.max(r.a, r.b)})</option>`).join('')}</select></label>`}` : ''}
    ${cal ? '<p class="rm wide">This variety follows a calendar plan, so the sowing date is not needed.</p>' : ''}
   </div>${prev}
   <div class="acts" style="margin-top:12px"><button class="btn" data-act="pfsave" data-id="${f.id}"${(ck && vk && (cal || sow)) || (d.crop === '__other' && d.other.trim()) ? '' : ' disabled'}>${ck ? 'Save and build POP plan' : 'Save crop'}</button>${edit ? '<button class="btn ghost" data-act="cancel">Cancel</button>' : ''}</div></section>`;
}
const RISK = {H: ['hot', 'High risk'], M: ['warm', 'Medium risk'], L: ['leaf', 'Low risk']};
const BLK = [['disease', 'Diseases', 'Check after humid or rainy days'], ['pest', 'Pests', 'Check the plant parts listed on each card'], ['weed', 'Weeds', ''], ['other', 'Other problems', '']];
/* problems of this crop that are not on this stage's list: rest of the stage list, then other stages (with where they are expected) */
function moreIssues(f, shownIds) {
  const RO = {H: 0, M: 1, L: 2}, m = new Map();
  f.b.watch.forEach(x => { if (!shownIds.has(x.id)) m.set(x.id, Object.assign({}, x, {where: 'This stage, lower on the list'})) });
  f.b.stage.rows.forEach((r, i) => (r.w || []).forEach(([id, rk]) => { if (shownIds.has(id) || i === f.b.stage.idx || !D.I[id]) return;
    const e = m.get(id); if (e) { if (!e.cur) { e.st.push(r.en); if (RO[rk] < RO[e.risk]) e.risk = rk } return }
    const x = D.I[id]; let L = []; try { L = id === 'WEEDS' ? [] : ENG.pick(id, 'cure', f.b.context) } catch (er) {}
    m.set(id, {id, en: x.en, hi: x.hi, type: x.t, risk: rk, symptom: x.sym, weather: x.wx, part: x.part, st: [r.en], other: true,
      treat: L[0] ? {p: L[0].p, dose: ENG.doseOf(L[0].p, L[0].dose), note: L[0].note} : null, alt: L[1] && L[1].p !== L[0].p ? {p: L[1].p, dose: ENG.doseOf(L[1].p, L[1].dose)} : null}) }));
  m.forEach(e => { if (e.st) e.where = 'Usually in ' + [...new Set(e.st)].slice(0, 2).join(', ') });
  return [...m.values()].sort((a, b) => RO[a.risk] - RO[b.risk] || a.en.localeCompare(b.en));
}
function watchBlocks(f) {
  const seen = S.seen[f.id] || {}, L = f.b.watch.slice(0, 12).sort((a, b) => 'HML'.indexOf(a.risk) - 'HML'.indexOf(b.risk));
  const X2 = moreIssues(f, new Set(L.map(x => x.id)));
  if (!L.length && !X2.length) return '<p class="empty">No watch list for this stage.</p>';
  const isT = (x, k) => k === 'other' ? !['disease', 'pest', 'weed'].includes(x.type) : x.type === k;
  return `<p class="sub" style="margin-top:14px">Tick <b>Seen in field</b> when the farmer or BSO confirms a problem. Its cure product moves to the top of Products.</p>` +
   BLK.map(([k, lab, sub]) => { const g = L.filter(x => isT(x, k)), xs = X2.filter(x => isT(x, k)), key = f.id + '|' + k;
    const pin = xs.filter(x => seen[x.id]), rest = xs.filter(x => !seen[x.id]), open = MORE.has(key);
    if (!g.length && !xs.length) return '';
    const nm = lab.toLowerCase().replace('other problems', 'problems');
    return `<section class="blk"><div class="blkh"><h3>${lab}</h3>${chip('mute', g.length + '')}${[...g, ...pin].filter(x => seen[x.id]).length ? chip('hot', [...g, ...pin].filter(x => seen[x.id]).length + ' seen') : ''}${sub ? `<span class="rm">${sub}</span>` : ''}</div>
     ${g.length || pin.length ? `<div class="advs">${g.map(x => issueCard(f, x, !!seen[x.id])).join('')}${pin.map(x => issueCard(f, x, true)).join('')}</div>` : `<p class="rm" style="margin:4px 0 0">No ${nm} expected at this stage.</p>`}
     ${open && rest.length ? `<div class="advs moreadvs">${rest.map(x => issueCard(f, x, false)).join('')}</div>` : ''}
     ${rest.length ? `<button type="button" class="moreb secmore" data-act="more" data-k="${esc(key)}" aria-expanded="${open}">${open ? 'Show fewer ' + nm : 'More ' + nm + ' (' + rest.length + ')'}<i aria-hidden="true">›</i></button>` : ''}</section>` }).join('');
}
function issueCard(f, x, on) {
  const r = RISK[x.risk] || RISK.L, row = (lab, v) => v ? `<dt>${lab}</dt><dd>${v}</dd>` : '';
  const pc = (p, alt) => `<span class="chip ${alt ? 'mute' : 'blue'}"><b>${esc(p.p)}</b> · ${esc(perAcre(p.dose))}</span>`;
  return `<article class="adv ${r[0]}${on ? ' on' : ''}"><div class="advh"><span class="advt">${r[1]}${x.isNew ? ' · New this stage' : ''}${x.where ? ' · ' + esc(x.where) : ''}</span><h4>${esc(x.en)} <span class="hih">${esc(x.hi)}</span></h4></div>
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
   ${H.map(o => { const k = stageOf(f, o.date); return `<tr><td class="num" style="white-space:nowrap">${fmt(o.date)}</td><td class="small">${k == null ? '–' : k === -1 ? 'Before this crop' : k === 99 ? 'After last stage' : esc(f.b.stage.rows[k].en)}</td><td class="num small">${esc(o.id)}</td>
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
   <div class="rw">${o.items.length ? o.items.map(([p, q]) => q + ' × ' + esc(p)).join(', ') + ` · <b class="num">${rupee(oval(o))}</b>` : '<span class="muted">Products to be confirmed by the service team</span>'}</div>
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
/* product photos and the product catalog come from the POP page's catalog export (data/catalog.json) */
const CAT = (typeof CATD !== 'undefined' && CATD) || {cat: [], img: {}, link: {}, meta: {}}, CATBY = Object.fromEntries(CAT.cat.map(c => [c.id, c]));
Object.entries(CAT.link).forEach(([p, id]) => { if (CAT.img[id]) IMG[p] = CAT.img[id] });
CAT.cat.forEach(c => { if (CAT.img[c.id] && !IMG[c.n]) IMG[c.n] = CAT.img[c.id] });
const deskName = id => Object.keys(CAT.link).find(p => CAT.link[p] === id && price(p)) || Object.keys(CAT.link).find(p => CAT.link[p] === id) || null;
const CROLE = [['all', 'All'], ['ins', 'Insecticides', ['insecticide', 'acaricide']], ['fun', 'Fungicides', ['fungicide', 'bactericide', 'virus_management']], ['her', 'Herbicides', ['herbicide']],
  ['nut', 'Nutrition', ['nutrition', 'biostimulant', 'pgr', 'adjuvant']], ['kit', 'Kits and traps', ['combo_kit', 'trap']], ['seed', 'Seeds', ['seed']], ['cat', 'Cattle feed', ['cattle_feed']], ['eq', 'Equipment', ['equipment']]];
const RLAB = {insecticide: 'Insecticide', acaricide: 'Acaricide', fungicide: 'Fungicide', bactericide: 'Bactericide', virus_management: 'Virus management', herbicide: 'Herbicide', nutrition: 'Nutrition', biostimulant: 'Biostimulant', pgr: 'Growth regulator', adjuvant: 'Sticker', combo_kit: 'Kit', trap: 'Trap', seed: 'Seed', cattle_feed: 'Cattle feed', equipment: 'Equipment'};
let CV = null;   // product catalog panel: {q, r, gk, sel}
function catalog() {
  const el = $('catp'); if (!CV) { el.hidden = true; if ($('drawer').hidden && !OUT && !UPL && !RS) $('scrim').hidden = true; return }
  const f = FM[CUR], rec = new Set(f ? recs(f).now.map(x => CAT.link[x.product]).filter(Boolean) : []), sid = f ? storeOf(f) : 'LKO';
  const PK = c => c.pk.filter(k => k.sp > 1), pr = c => PK(c).length ? Math.min(...PK(c).map(k => k.sp)) : 0, mrp = c => PK(c).length ? PK(c).find(k => k.sp === pr(c)).mrp : 0, rp = v => v ? rupee(v) : '<span class="muted">Price not set</span>';
  const img = (c, cls) => CAT.img[c.id] ? `<img class="${cls}" src="${CAT.img[c.id]}" alt="${esc(c.n)}" loading="lazy">` : `<span class="${cls} ini">${esc(c.n.slice(0, 1))}</span>`;
  if (CV.sel != null) { const c = CATBY[CV.sel], dn = deskName(c.id), bk = f ? (S.basket[f.id] || {}) : {}, q = dn ? stock(sid, dn) : 0;
    el.innerHTML = `<div class="dh"><button class="btn ghost sm x" data-act="catclose">Close</button><button class="lk" data-act="catback">← All products</button></div>
     <div class="db"><div class="cph">${img(c, 'cpi')}<div class="cphi"><span class="lbl2">${esc(RLAB[c.r] || c.r)} · ${esc(c.c)}</span><h3>${esc(c.n)}</h3><div class="rm">${c.gk ? '<span class="chip ok">Gramik brand</span> ' : ''}${esc(c.b)}</div>
       ${c.tech ? `<div class="cpt">${esc(c.tech)}</div>` : ''}<div class="cpp"><b class="num">${rp(pr(c))}</b>${mrp(c) > pr(c) ? ` <s class="muted num">${rupee(mrp(c))}</s>` : ''} <span class="rm">catalog price${c.pk.length > 1 ? ', from' : ''}</span></div>
       <div class="chips">${rec.has(c.id) ? chip('green', 'Recommended for ' + f.short.split(' ')[0]) : ''}${dn ? (q > 0 ? chip('ok', q + ' in stock') : chip('hot', 'Out of stock here')) : chip('mute', 'Not in this desk\'s product list')}</div>
       ${dn && f && price(dn) ? `<div class="acts" style="margin-top:8px">${bk[dn] ? `<span class="chip ok">✓ ${bk[dn]} in cart</span><button class="btn ghost sm" data-act="catcart">Open cart</button>` : `<button class="btn sm" data-act="catadd" data-p="${esc(dn)}">Add to cart</button>`}</div>` : ''}</div></div>
     ${c.sd || c.tag ? `<p class="cpd">${esc(c.sd || c.tag)}</p>` : ''}
     ${c.ben.length ? `<div class="cps"><span class="sl">Benefits</span><ul class="ben">${c.ben.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
     ${c.crops.length || c.dose || (dn && PR[dn]) ? `<div class="cps"><span class="sl">Use</span><dl class="advd">${c.crops.length ? `<dt>Crops</dt><dd>${esc(c.crops.join(', '))}</dd>` : ''}${dn && PR[dn] && PR[dn].dose ? `<dt>Dose</dt><dd>${esc(perAcre(PR[dn].dose))}</dd>` : c.dose ? `<dt>Dose</dt><dd>${esc(c.dose)}</dd>` : ''}${dn && PR[dn] && PR[dn].use ? `<dt>For</dt><dd>${esc(PR[dn].use)}</dd>` : ''}</dl></div>` : ''}
     ${c.pk.length ? `<div class="cps"><span class="sl">Packs</span><div class="tw2"><table><thead><tr><th>Pack</th><th>SKU</th><th class="n">MRP</th><th class="n">Price</th></tr></thead><tbody>${c.pk.map(k => `<tr><td>${esc(k.pk)}</td><td class="num small">${esc(k.sku)}</td><td class="n">${k.sp > 1 ? rupee(k.mrp) : '–'}</td><td class="n"><b>${k.sp > 1 ? rupee(k.sp) : '<span class="muted">Not set</span>'}</b></td></tr>`).join('')}</tbody></table></div></div>` : ''}
     <p class="src" style="margin-top:12px">Catalog export ${esc(CAT.meta.merged || '')} · prices for Uttar Pradesh${c.upd ? ' · product updated ' + fmt(c.upd) : ''}</p></div>`;
  } else {
    const grp = CROLE.find(g => g[0] === CV.r) || CROLE[0], q = CV.q.trim().toLowerCase();
    const L = CAT.cat.filter(c => (grp[0] === 'all' || grp[2].includes(c.r)) && (!CV.gk || c.gk) && (!q || (c.n + ' ' + c.b + ' ' + c.tech + ' ' + c.crops.join(' ')).toLowerCase().includes(q)))
      .sort((a, b) => rec.has(b.id) - rec.has(a.id) || b.gk - a.gk || a.n.localeCompare(b.n));
    const cnt = k => k === 'all' ? CAT.cat.length : CAT.cat.filter(c => CROLE.find(g => g[0] === k)[2].includes(c.r)).length;
    el.innerHTML = `<div class="dh"><button class="btn ghost sm x" data-act="catclose">Close</button><h3>Product catalog</h3>
      <div class="rm">${CAT.cat.length} products · catalog export ${esc(CAT.meta.merged ? fmt(CAT.meta.merged) : '')}${f ? ' · recommended for ' + esc(f.short) + ' first' : ''}</div>
      <div class="catf"><input type="search" id="cat-q" placeholder="Search name, brand, technical, crop" value="${esc(CV.q)}" aria-label="Search the catalog"><label class="ck"><input type="checkbox" id="cat-gk"${CV.gk ? ' checked' : ''}> Gramik brand only</label></div>
      <div class="filt" role="group" aria-label="Category">${CROLE.filter(g => cnt(g[0])).map(([k, l]) => `<button class="chipb" type="button" data-act="catr" data-k="${k}" aria-pressed="${CV.r === k}">${l} <span class="muted">${cnt(k)}</span></button>`).join('')}</div></div>
     <div class="db">${L.length ? `<div class="cgrid">${L.map(c => `<button type="button" class="pc" data-act="catsel" data-id="${c.id}"><span class="ph">${img(c, 'pci')}${rec.has(c.id) ? '<span class="pct">Recommended</span>' : ''}</span>
       <span class="pcb"><b class="pcn">${esc(c.n)}</b><span class="pcm">${esc(c.tech || c.b)}</span><span class="pcf"><b class="num">${rp(pr(c))}</b>${mrp(c) > pr(c) ? `<s class="num">${rupee(mrp(c))}</s>` : ''}</span></span></button>`).join('')}</div>` : '<p class="empty">No product matches. Clear the search or pick All.</p>'}</div>`;
  }
  el.hidden = false; $('scrim').hidden = false;
}
function catOpen() { drawer(false); CV = CV || {q: '', r: 'all', gk: false, sel: null}; CV.sel = null; catalog() }
const TYPEC = {antiviral: ['#7A3E9D', 'VIRUS'], fungicide: ['#2F5FA7', 'FUNG'], insecticide: ['#C9353A', 'INSC'], herbicide: ['#5B3FB0', 'HERB'], nutrition: ['#2A7A4B', 'NUTR'], biostimulant: ['#3E8E5E', 'BIO'],
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
/* how to use a product: dose for this farm, method, best days, purpose and cautions */
function howTo(f, p) {
  const x = PR[p] || {}, r = f.b ? [...recs(f).now, ...recs(f).later].find(z => z.product === p) : null, dose = perAcre((r && r.dose && r.dose[0]) || x.dose || '');
  const days = forecast(f.place), w = days && f.b ? cropWx(f, days) : null, m = x.m || 'spray';
  const how = m === 'soil' ? ['Mix with sand, soil or fertiliser and spread near the roots, or give with irrigation as a drench', 'Apply when the soil is moist; water lightly after'] :
    m === 'trap' ? ['Install at or just above crop height, spread evenly across the field', 'Check every week; replace when full or after 4–6 weeks'] :
    ['Mix the dose in 150–200 litres of water per acre (about 10–13 tank loads of 15 L)', 'Spray in the early morning or after 4 pm on a calm day, covering both sides of the leaves', 'Add TIKAU-G sticker unless the label says not to'];
  const risk = ((D.CF && D.CF.risk && D.CF.risk[p]) || []).slice(0, 2);
  const row = (l, v) => v ? `<dt>${l}</dt><dd>${v}</dd>` : '';
  return `<dl class="advd how">${row('What it is', esc([x.tech, x.t].filter(Boolean).join(' · ')))}${row('Use for', esc(x.use || '') + (r && r.reasons && r.reasons.length ? `<div class="rm">${r.reasons.slice(0, 2).map(z => esc(z.text)).join(' · ')}</div>` : ''))}
   ${row('Dose', dose ? `<b>${esc(dose)}</b>${f.acres ? ` · ${esc(f.acres)} acre${f.acres == 1 ? '' : 's'} → ${Math.max(1, Math.ceil(f.acres))} pack${Math.ceil(f.acres) > 1 ? 's' : ''}` : ''}` : '')}
   ${row('How', `<ul>${how.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` + (r && r.tips && r.tips.length ? `<div class="rm">${r.tips.map(esc).join(' · ')}</div>` : ''))}
   ${m === 'spray' && w ? row('Best days', w.spray.length ? `<div class="chips">${w.spray.slice(0, 4).map(d => chip('ok', wkd(d.d) + ' ' + fmt(d.d))).join('')}</div>` : chip('warm', 'No good spray day this week')) : ''}
   ${row('Care', risk.length ? risk.map(k => `<div>${esc(k.w)}${k.d ? ` <span class="muted">· ${esc(k.d)}</span>` : ''}</div>`).join('') : 'Wear gloves and a mask. Keep away from children and animals. Follow the waiting period on the label before harvest.')}</dl>`;
}
/* how the products in the cart are used together on this crop: which tank, in what order, when, and safely */
const FORM = p => { const m = ((PR[p] && PR[p].tech) || p).match(/\b(WP|WDG|WG|SP|SG|GR|SC|CS|SE|OD|EC|EW|ME|SL)\b/); return m ? m[1] : '' };
const MIXRANK = p => { const x = PR[p] || {}, fm = FORM(p); if (p === 'TIKAU-G' || x.t === 'adjuvant') return [9, 'sticker, last'];
  if (['WP', 'WDG', 'WG', 'SP', 'SG'].includes(fm)) return [1, 'powder or granules (' + fm + ')']; if (['SC', 'CS', 'SE', 'OD'].includes(fm)) return [2, 'suspension (' + fm + ')'];
  if (['EC', 'EW', 'ME'].includes(fm)) return [3, 'emulsion (' + fm + ')']; if (fm === 'SL') return [4, 'solution (SL)'];
  if (x.t === 'nutrition' || x.t === 'biostimulant') return [5, /\d+:\d+:\d+|g$|kg$/.test(x.dose || '') ? 'water-soluble nutrient' : 'liquid nutrient'];
  return [3, 'liquid']; };
function scaleDose(d, ac) {
  const m = (d || '').match(/^([\d.]+)\s*(g|kg|ml|L|l|traps)\b/); if (!m || /pump/.test(d)) return '';
  let v = +m[1] * ac, u = m[2]; if (u === 'g' && v >= 1000) { v /= 1000; u = 'kg' } if (u === 'ml' && v >= 1000) { v /= 1000; u = 'L' }
  return (u === 'traps' ? Math.ceil(v) : Math.round(v * 10) / 10) + ' ' + u;
}
function perPump(d) { const m = (d || '').match(/^([\d.]+)\s*(g|kg|ml|L|l)\b/); if (!m) return /pump/.test(d || '') ? d : ''; let v = +m[1] * (/kg|L|l/.test(m[2]) ? 1000 : 1) / (175 / 15); return '≈ ' + (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + (/g/.test(m[2]) ? ' g' : ' ml') + ' per 15 L pump' }
/* the short version an agronomist reads out on the call: numbered steps, one pump recipe per spray, what not to mix, when, 3 safety points */
try { const l = localStorage.getItem('gramik_howl'); if (['en', 'hi', 'hing'].includes(l)) HOWL = l } catch (e) {}
const HL = {
  en: {lang: 'English', unit: {g: 'g', ml: 'ml', kg: 'kg', L: 'L', traps: 'traps'}, ord: n => 'Spray ' + n, wk: d => wkd(d) + ' ' + fmt(d),
    s1: d => d ? 'on ' + d : 'on a calm, dry day', sN: n => (n - 1 > 0 ? '5–7 days after spray ' + (n - 1) : ''), pump: 'In one 15 L pump', field: (ac, a, b) => `Whole field (${ac} acre): ${a}–${b} pumps`,
    tip: 'Fill the pump half with water, add one product at a time in this order, stir, then fill up', weed: 'Weed spray · use a separate sprayer',
    soil: (x) => `Soil: ${x} · mix in 25–50 kg sand or manure, put near the roots, then water lightly`, seed: x => `Seed treatment: ${x} · coat the seed, dry in shade, sow the same day`,
    trap: x => `Traps: ${x} · spread across the field, just above the crop`, nomix: (a, b) => `Do not mix ${a} with ${b}`, nomixH: 'Do not mix', whenH: 'When to spray', safeH: 'Safety',
    time: 'Morning, or after 4 pm. Not in wind or before rain', avoid: (d, r) => `Not on ${d} (${r})`, why: {rain: 'rain', windy: 'wind', unsettled: 'bad weather'},
    bees: 'Flowering now: insecticide only after 4 pm, to save bees', sticker: 'TIKAU-G', safe: ['Wear gloves and a mask', 'Do not eat or smoke while spraying; wash hands after', 'Keep children and animals away; bury the empty packs'],
    sum: (n, parts) => `${n} product${n > 1 ? 's' : ''}: ${parts.join(' + ')}`, parts: {sp: n => n + ' spray' + (n > 1 ? 's' : ''), soil: 'soil', seed: 'seed treatment', trap: 'traps'}, head: 'How to use', copy: 'Copy for WhatsApp', full: 'Full detail', less: 'Hide detail'},
  hi: {lang: 'हिंदी', unit: {g: 'ग्राम', ml: 'मि.ली.', kg: 'किलो', L: 'लीटर', traps: 'ट्रैप'}, ord: n => ['पहला', 'दूसरा', 'तीसरा', 'चौथा'][n - 1] + ' स्प्रे', wk: d => ({Mon: 'सोमवार', Tue: 'मंगलवार', Wed: 'बुधवार', Thu: 'गुरुवार', Fri: 'शुक्रवार', Sat: 'शनिवार', Sun: 'रविवार'})[wkd(d)] + ' ' + fmt(d),
    s1: d => d ? d + ' को' : 'साफ़, बिना हवा वाले दिन', sN: n => 'पिछले स्प्रे के 5–7 दिन बाद', pump: '15 लीटर पंप में', field: (ac, a, b) => `पूरे खेत (${ac} एकड़) के लिए ${a}–${b} पंप`,
    tip: 'पंप आधा पानी से भरें, दवा एक-एक करके इसी क्रम में डालें, घोलें, फिर पूरा भरें', weed: 'खरपतवार स्प्रे · अलग स्प्रेयर से',
    soil: x => `मिट्टी में: ${x} · 25–50 किलो रेत या खाद में मिलाकर जड़ों के पास डालें, फिर हल्की सिंचाई करें`, seed: x => `बीज उपचार: ${x} · बीज पर लगाएं, छाया में सुखाएं, उसी दिन बोएं`,
    trap: x => `ट्रैप: ${x} · पूरे खेत में बराबर, फसल से थोड़ा ऊपर लगाएं`, nomix: (a, b) => `${a} को ${b} के साथ न मिलाएं`, nomixH: 'एक साथ न मिलाएं', whenH: 'छिड़काव कब करें', safeH: 'सावधानी',
    time: 'सुबह, या शाम 4 बजे के बाद। तेज हवा में या बारिश से पहले नहीं', avoid: (d, r) => `${d} को नहीं (${r})`, why: {rain: 'बारिश', windy: 'तेज हवा', unsettled: 'मौसम खराब'},
    bees: 'फूल का समय है: कीटनाशक शाम 4 बजे के बाद ही, ताकि मधुमक्खी बचें', sticker: 'TIKAU-G', safe: ['दस्ताने और मास्क पहनें', 'छिड़काव के समय कुछ न खाएं, न बीड़ी पिएं; बाद में हाथ धोएं', 'बच्चों और पशुओं को दूर रखें; खाली पैकेट गाड़ दें'],
    sum: (n, parts) => `${n} दवा: ${parts.join(' + ')}`, parts: {sp: n => n + ' स्प्रे', soil: 'मिट्टी में', seed: 'बीज उपचार', trap: 'ट्रैप'}, head: 'इस्तेमाल का तरीका', copy: 'WhatsApp के लिए कॉपी', full: 'पूरी जानकारी', less: 'कम दिखाएं'},
  hing: {lang: 'Hinglish', unit: {g: 'gram', ml: 'ml', kg: 'kilo', L: 'litre', traps: 'trap'}, ord: n => ['Pehla', 'Doosra', 'Teesra', 'Chautha'][n - 1] + ' spray', wk: d => ({Mon: 'Somvar', Tue: 'Mangalvar', Wed: 'Budhvar', Thu: 'Guruvar', Fri: 'Shukravar', Sat: 'Shanivar', Sun: 'Ravivar'})[wkd(d)] + ' ' + fmt(d),
    s1: d => d ? d + ' ko' : 'saaf, bina hawa wale din', sN: n => 'pichhle spray ke 5–7 din baad', pump: '15 litre pump mein', field: (ac, a, b) => `Poore khet (${ac} acre) ke liye ${a}–${b} pump`,
    tip: 'Pump aadha paani se bharein, dawa ek-ek karke isi kram mein daalein, gholein, phir poora bharein', weed: 'Kharpatwar spray · alag sprayer se',
    soil: x => `Mitti mein: ${x} · 25–50 kilo ret ya khaad mein milakar jadon ke paas daalein, phir halki sinchai`, seed: x => `Beej upchar: ${x} · beej par lagayein, chhaon mein sukhayein, usi din boyein`,
    trap: x => `Trap: ${x} · poore khet mein barabar, fasal se thoda upar lagayein`, nomix: (a, b) => `${a} ko ${b} ke saath na milayein`, nomixH: 'Ek saath na milayein', whenH: 'Spray kab karein', safeH: 'Saavdhani',
    time: 'Subah, ya shaam 4 baje ke baad. Tez hawa mein ya baarish se pehle nahi', avoid: (d, r) => `${d} ko nahi (${r})`, why: {rain: 'baarish', windy: 'tez hawa', unsettled: 'mausam kharab'},
    bees: 'Phool ka samay hai: keetnashak shaam 4 baje ke baad hi, taaki madhumakkhi bachein', sticker: 'TIKAU-G', safe: ['Dastane aur mask pehnein', 'Spray ke samay kuch na khayein, na beedi piyein; baad mein haath dhoyein', 'Bachchon aur pashuon ko door rakhein; khaali packet gaad dein'],
    sum: (n, parts) => `${n} dawa: ${parts.join(' + ')}`, parts: {sp: n => n + ' spray', soil: 'mitti mein', seed: 'beej upchar', trap: 'trap'}, head: 'Istemal ka tarika', copy: 'WhatsApp ke liye copy', full: 'Poori jaankari', less: 'Kam dikhayein'}};
function amt(v, u, L) { v = v >= 100 ? Math.round(v / 5) * 5 : v >= 10 ? Math.round(v) : Math.round(v * 2) / 2; return v + ' ' + L.unit[u] }
function pumpAmt(d, L) { const m = (d || '').match(/^([\d.]+)\s*(g|kg|ml|L|l)\b/); if (!m) { const q = (d || '').match(/([\d.]+)\s*(ml|g)\s*per pump/); return q ? amt(+q[1], q[2], L) : '' } const big = /kg|L|l/.test(m[2]); return amt(+m[1] * (big ? 1000 : 1) / (175 / 15), /g/.test(m[2]) ? 'g' : 'ml', L) }
function fieldAmt(d, ac, L) { const m = (d || '').match(/^([\d.]+)\s*(g|kg|ml|L|l|traps)\b/); if (!m) return d || ''; let v = +m[1] * ac, u = m[2] === 'l' ? 'L' : m[2]; if (u === 'g' && v >= 1000) { v /= 1000; u = 'kg' } if (u === 'ml' && v >= 1000) { v /= 1000; u = 'L' } return (u === 'traps' ? Math.ceil(v) : Math.round(v * 10) / 10) + ' ' + L.unit[u] }
function cartShort(f, P) {
  const L = HL[HOWL] || HL.hing, ac = +f.acres || 1, T = p => (PR[p] || {}).t, M = p => (PR[p] || {}).m, dose = p => (PR[p] && PR[p].dose) || '';
  const seedT = P.filter(p => /seed|sett/i.test(dose(p))), soil = P.filter(p => !seedT.includes(p) && (M(p) === 'soil' || /drench|irrigation/i.test(dose(p)))), traps = P.filter(p => M(p) === 'trap' && !soil.includes(p));
  const herb = P.filter(p => T(p) === 'herbicide' && !soil.includes(p) && !seedT.includes(p)), fol = P.filter(p => ![...seedT, ...soil, ...traps, ...herb].includes(p));
  const pest = p => ['insecticide', 'fungicide', 'bactericide'].includes(T(p));
  const build = list => { const out = []; list.forEach(p => { let t = out.find(t => t.every(z => !ENG.clash(z, p)) && !(pest(p) && t.filter(pest).length >= 2)); if (!t) { t = []; out.push(t) } t.push(p) }); return out };
  const sprays = build(fol), weedT = build(herb), days = forecast(f.place), w = days && f.b ? cropWx(f, days) : null, good = w ? w.spray.filter(d => d.d >= TODAY) : [], bad = w ? w.nospray.filter(d => d.d >= TODAY) : [];
  const sticker = t => !t.includes('TIKAU-G') && !t.includes('COC') && t.every(p => { const x = ENG.compat('TIKAU-G', p); return !x || x.s === 'ut' || x.s === 'ok' });
  const pumps = [Math.ceil(150 * ac / 15), Math.ceil(200 * ac / 15)];
  const recipe = t => { const o = t.slice().sort((a, b) => MIXRANK(a)[0] - MIXRANK(b)[0]).map(p => [p, pumpAmt(dose(p), L)]); if (sticker(t)) o.push(['TIKAU-G', amt(50 / (175 / 15), 'ml', L)]); return o };
  const steps = [];
  sprays.forEach((t, i) => steps.push({t: L.ord(i + 1) + ' · ' + (i ? L.sN(i + 1) : L.s1(good[0] ? L.wk(good[0].d) : '')), r: recipe(t), pts: [L.field(ac, pumps[0], pumps[1]), ...(i ? [] : [L.tip])]}));
  weedT.forEach(t => steps.push({t: L.weed, r: recipe(t), pts: [L.field(ac, pumps[0], pumps[1])]}));
  soil.forEach(p => steps.push({t: L.soil(p + ' ' + fieldAmt(dose(p), ac, L)), r: [], pts: []}));
  seedT.forEach(p => steps.push({t: L.seed(p + ' ' + dose(p)), r: [], pts: []}));
  traps.forEach(p => steps.push({t: L.trap(p + ' ' + fieldAmt(dose(p), ac, L)), r: [], pts: []}));
  const NM = new Map(); for (let i = 0; i < sprays.length; i++) for (let j = i + 1; j < sprays.length; j++) sprays[i].forEach(a => sprays[j].forEach(b => { if (ENG.clash(a, b)) NM.set(b, [...(NM.get(b) || []), a]) }));
  const nomix = [...NM].map(([b, as]) => L.nomix(b, as.join(', ')));
  if (herb.length && fol.length) nomix.push(L.nomix(herb.join(', '), fol.join(', ')));
  const flowering = f.b && /flower/i.test(f.stageEn || ''), insect = P.some(p => T(p) === 'insecticide');
  const when = sprays.length || weedT.length ? [L.time, ...(bad.length ? [L.avoid(bad.slice(0, 3).map(d => L.wk(d.d)).join(', '), [...new Set(bad.slice(0, 3).map(d => L.why[why(d)] || why(d)))].join(', '))] : []), ...(flowering && insect ? [L.bees] : [])] : [];
  const parts = [...(sprays.length + weedT.length ? [L.parts.sp(sprays.length + weedT.length)] : []), ...(soil.length ? [L.parts.soil] : []), ...(seedT.length ? [L.parts.seed] : []), ...(traps.length ? [L.parts.trap] : [])];
  const text = [`${L.head} · ${f.short}`, L.sum(P.length, parts), '', ...steps.flatMap((s, i) => [`${i + 1}. ${s.t}`, ...(s.r.length ? [`   ${L.pump}: ${s.r.map(([p, a]) => p + ' ' + a).join(' + ')}`] : []), ...s.pts.map(x => '   ' + x)]),
    ...(nomix.length ? ['', L.nomixH + ':', ...nomix.map(x => '• ' + x)] : []), ...(when.length ? ['', L.whenH + ':', ...when.map(x => '• ' + x)] : []), '', L.safeH + ':', ...L.safe.map(x => '• ' + x), '— Gramik'].join('\n');
  return `<div class="howp all short" lang="${HOWL === 'hi' ? 'hi' : 'en'}"><div class="howh"><div class="seg3 lang" role="group" aria-label="Language">${Object.entries(HL).map(([k, x]) => `<button type="button" data-act="howl" data-k="${k}" aria-pressed="${HOWL === k}">${x.lang}</button>`).join('')}</div>
     <button type="button" class="btn ghost sm" data-copy="${esc(text)}">${L.copy}</button></div>
   <p class="hsum"><b>${esc(L.sum(P.length, parts))}</b> · ${esc(f.cropName || '')} · ${ac} ${HOWL === 'hi' ? 'एकड़' : 'acre'}</p>
   <ol class="hsteps">${steps.map(s => `<li><b>${esc(s.t)}</b>${s.r.length ? `<div class="hrec"><span>${esc(L.pump)}:</span> ${s.r.map(([p, a]) => `<span class="hpill">${IMG[p] ? `<img src="${esc(IMG[p])}" alt="">` : ''}${esc(p)} <b>${esc(a)}</b></span>`).join('<i>+</i>')}</div>` : ''}${s.pts.map(x => `<div class="rm">${esc(x)}</div>`).join('')}</li>`).join('')}</ol>
   ${nomix.length ? `<div class="hbox warn"><b>${esc(L.nomixH)}</b><ul>${nomix.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
   ${when.length ? `<div class="hbox"><b>${esc(L.whenH)}</b><ul>${when.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
   <div class="hbox safe"><b>${esc(L.safeH)}</b><ul>${L.safe.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
   <button type="button" class="lk small" data-act="howfull" aria-expanded="${HOWFULL}">${HOWFULL ? L.less : L.full}</button>${HOWFULL ? cartPlan(f, P) : ''}</div>`;
}
function cartPlan(f, P) {
  const ac = +f.acres || 1, T = p => (PR[p] || {}).t, M = p => (PR[p] || {}).m, dose = p => (PR[p] && PR[p].dose) || '';
  const seedT = P.filter(p => /seed|sett/i.test(dose(p))), soil = P.filter(p => !seedT.includes(p) && (M(p) === 'soil' || /drench|irrigation/i.test(dose(p)))), traps = P.filter(p => M(p) === 'trap' && !soil.includes(p));
  const herb = P.filter(p => T(p) === 'herbicide' && !soil.includes(p) && !seedT.includes(p)), fol = P.filter(p => ![...seedT, ...soil, ...traps, ...herb].includes(p));
  const build = list => { const out = []; list.forEach(p => { let t = out.find(t => t.every(z => !ENG.clash(z, p)) && !(['insecticide', 'fungicide', 'bactericide'].includes(T(p)) && t.filter(z => ['insecticide', 'fungicide', 'bactericide'].includes(T(z))).length >= 2)); if (!t) { t = []; out.push(t) } t.push(p) }); return out };
  const sprays = build(fol), weedT = build(herb), days = forecast(f.place), w = days && f.b ? cropWx(f, days) : null;
  const water = `${Math.round(150 * ac)}–${Math.round(200 * ac)} L water (${Math.ceil(150 * ac / 15)}–${Math.ceil(200 * ac / 15)} pumps of 15 L)`;
  const prow = (p, extra) => `<li><div class="mrow">${IMG[p] ? `<img class="cimg" src="${esc(IMG[p])}" alt="">` : ''}<div><b>${esc(p)}</b> <span class="muted">${esc(perAcre(dose(p)))}</span>${scaleDose(dose(p), ac) ? ` · <b>${esc(scaleDose(dose(p), ac))}</b> for ${ac} ac` : ''}${M(p) !== 'trap' && M(p) !== 'soil' && perPump(dose(p)) ? `<div class="rm">${esc(perPump(dose(p)))}</div>` : ''}${extra || ''}</div></div></li>`;
  const pairNotes = t => { const out = []; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const x = ENG.compat(t[i], t[j]); if (x && x.s !== 'ok') out.push(`${esc(t[i])} + ${esc(t[j])}: ${esc(x.label)}${x.why ? ' · ' + esc(x.why) : ''}`) } return out };
  const sticker = t => !t.includes('TIKAU-G') && !t.includes('COC') && t.every(p => { const x = ENG.compat('TIKAU-G', p); return !x || x.s === 'ut' || x.s === 'ok' });
  const tank = (t, title, sub) => { const o = t.slice().sort((a, b) => MIXRANK(a)[0] - MIXRANK(b)[0]), n = pairNotes(t);
    return `<div class="tank"><div class="tankh"><b>${title}</b><span class="rm">${sub}</span></div><ul class="mix">${o.map((p, i) => prow(p, `<span class="chip mute">${i + 1}. add ${esc(MIXRANK(p)[1])}</span>`)).join('')}</ul>
     <p class="rm">For each 15 L pump: fill half with clean water, add the products in this order (amounts per pump above), stir after each, then fill up.${sticker(t) ? ' Add TIKAU-G sticker last (≈ 4 ml per pump).' : ''}</p>
     ${n.length ? `<ul class="tnote">${n.map(x => `<li>${x}</li>`).join('')}</ul>` : t.length > 1 ? '<p class="rm ok3">No known clash between these products. Do a jar test the first time you mix them.</p>' : ''}</div>` };
  const split = []; for (let i = 0; i < sprays.length; i++) for (let j = i + 1; j < sprays.length; j++) sprays[i].forEach(a => sprays[j].forEach(b => { const x = ENG.compat(a, b); if (x && ENG.clash(a, b)) split.push(`${a} and ${b} are in different sprays: ${x.label.toLowerCase()}${x.why ? ' · ' + x.why : ''}`) }));
  const flowering = f.b && /flower/i.test(f.stageEn || ''), insect = P.some(p => T(p) === 'insecticide');
  const risk = P.flatMap(p => ((D.CF && D.CF.risk && D.CF.risk[p]) || []).filter(k => !(k.f.includes('harms_bees') && !flowering) && (!/\bapple\b/i.test(k.w) || /apple/i.test(f.cropName || ''))).map(k => [p, k]));
  const rules = ((D.CF && D.CF.rules) || []).filter(r => (r.f.includes('injures_crop') && herb.length && P.length > herb.length) || (/COC|copper/i.test(r.w) && P.includes('COC')) || (r.f.includes('stops_working') && insect));
  const steps = [];
  sprays.forEach((t, i) => steps.push(tank(t, sprays.length > 1 ? 'Spray ' + (i + 1) : 'Foliar spray', (i ? '5–7 days after Spray ' + i + ' · ' : '') + water)));
  weedT.forEach((t, i) => steps.push(tank(t, 'Weed spray' + (weedT.length > 1 ? ' ' + (i + 1) : ''), 'separate sprayer, or wash it well · ' + water)));
  if (soil.length) steps.push(`<div class="tank"><div class="tankh"><b>Soil application</b><span class="rm">not in the spray tank</span></div><ul class="mix">${soil.map(prow).join('')}</ul><p class="rm">Mix with 25–50 kg sand or soil (or with the fertiliser) and spread near the roots, or give with irrigation as a drench. Soil should be moist; irrigate lightly after.</p></div>`);
  if (seedT.length) steps.push(`<div class="tank"><div class="tankh"><b>Seed treatment</b><span class="rm">before sowing</span></div><ul class="mix">${seedT.map(prow).join('')}</ul><p class="rm">Coat the seed evenly, dry in shade and sow the same day.</p></div>`);
  if (traps.length) steps.push(`<div class="tank"><div class="tankh"><b>Traps</b><span class="rm">install in the field</span></div><ul class="mix">${traps.map(prow).join('')}</ul><p class="rm">Spread evenly at or just above crop height. Check weekly; replace when full or after 4–6 weeks. Keep traps out of the spray.</p></div>`);
  const sprayDays = w && (sprays.length || weedT.length) ? (w.spray.length ? `Good spray days: ${w.spray.slice(0, 5).map(d => wkd(d.d) + ' ' + fmt(d.d)).join(', ')}.` : 'No good spray day in the next 7 days; wait for calm, dry weather.') + (w.nospray.length ? ` Avoid ${w.nospray.slice(0, 3).map(d => wkd(d.d) + ' (' + why(d) + ')').join(', ')}.` : '') : '';
  const safety = ['Wear gloves, a mask, full sleeves and goggles while mixing and spraying', 'Spray in the early morning or after 4 pm, with the wind behind you; never spray in strong wind or before rain', 'Do not eat, drink, smoke or chew tobacco while spraying; wash hands, face and clothes after', 'Keep children, animals and ponds away; do not wash the sprayer in a canal or pond', 'Rinse empty packs three times into the tank, then crush and bury them; never reuse them for food or water', 'Respect the waiting period on the label before harvest'];
  if (flowering && insect) safety.unshift('Crop is flowering: spray insecticides only after 4 pm to protect bees');
  if (herb.length && P.length > herb.length) safety.unshift('Use a separate sprayer for the herbicide, or wash the sprayer well before other sprays');
  const hi = [...sprays.map((t, i) => `${sprays.length > 1 ? 'स्प्रे ' + (i + 1) : 'स्प्रे'}: ${t.map(p => p + ' ' + dose(p)).join(' + ')}${sticker(t) ? ' + TIKAU-G 50 ml' : ''} प्रति एकड़, 150–200 लीटर पानी में${i ? ' (पिछले स्प्रे के 5–7 दिन बाद)' : ''}`), ...weedT.map(t => `खरपतवार स्प्रे (अलग स्प्रेयर से): ${t.map(p => p + ' ' + dose(p)).join(' + ')} प्रति एकड़`), ...(soil.length ? [`मिट्टी में: ${soil.map(p => p + ' ' + dose(p)).join(' + ')} प्रति एकड़, रेत/खाद में मिलाकर या सिंचाई के साथ`] : []), ...(traps.length ? [`ट्रैप: ${traps.map(p => p + ' ' + dose(p)).join(', ')} प्रति एकड़`] : []), 'छिड़काव सुबह या शाम 4 बजे के बाद करें, दस्ताने और मास्क पहनें।'];
  return `<div class="howp full"><div class="howh"><span><b>${P.length} product${P.length > 1 ? 's' : ''} for ${esc(f.cropName || 'this crop')}</b>${f.b ? ' · ' + esc(f.stageEn) : ''} · ${ac} acre${ac === 1 ? '' : 's'}</span></div>
   <div class="sl">${sprays.length + weedT.length ? (sprays.length + weedT.length) + ' tank' + (sprays.length + weedT.length > 1 ? 's' : '') : 'No spray tank'}${soil.length ? ' · soil application' : ''}${seedT.length ? ' · seed treatment' : ''}${traps.length ? ' · traps' : ''}</div>
   ${steps.join('')}
   ${split.length ? `<div class="tnote2"><span class="sl">Why they are split</span><ul class="tnote">${split.slice(0, 4).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
   ${sprayDays ? `<p class="rm"><b>When:</b> ${esc(sprayDays)}</p>` : ''}
   ${risk.length || rules.length ? `<div class="care"><span class="sl">Care with these products</span><ul>${[...rules.map(r => `<li>${esc(r.w)}. <b>${esc(r.d)}</b></li>`), ...risk.map(([p, k]) => `<li><b>${esc(p)}:</b> ${esc(k.w)}. ${esc(k.d)}</li>`)].join('')}</ul></div>` : ''}
   <div class="care safe"><span class="sl">Safety</span><ul>${safety.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
}
function drawer(open) {
  const el = $('drawer');
  if (!open) { el.hidden = true; $('scrim').hidden = true; return }
  const f = FM[CUR], fx = recs(f), sid = storeOf(f), s = OPS.STORES[sid], alt = s.alt, bk = S.basket[f.id] || {};
  const nowSet = new Set(fx.now.map(x => x.product));
  const items = [...fx.now.map(x => ({x, rec: true})), ...fx.later.map(x => ({x, rec: false}))];
  const extra = popProducts(f).filter(p => !items.some(i => i.x.product === p) && stock(sid, p) > 0).map(p => ({x: {product: p, dose: [PR[p].dose], reasons: [{factorLabel: 'POP', text: 'Used in this crop\'s POP'}], gramik: true}, rec: false, other: true}));
  const cat = f.b ? [] : Object.keys(PR).filter(p => sold(p) && stock(sid, p) > 0).sort().map(p => ({x: {product: p, dose: [PR[p].dose], reasons: [], gramik: true}, rec: false, other: true, cat: true}));
  const all = [...items, ...extra, ...cat];
  const inS = i => sold(i.x.product) && stock(sid, i.x.product) > 0;
  const show = all.filter(i => DFILT === 'all' || (DFILT === 'rec' && i.rec) || (DFILT === 'stock' && inS(i)) || (DFILT === 'both' && i.rec && inS(i)));
  const seen = S.seen[f.id] || {};
  const BB = Object.fromEntries(boughtOf(f).map(b => [b.p, b]));
  const li = i => { const p = i.x.product, q = stock(sid, p), aq = alt ? stock(alt, p) : 0, pr = price(p), n = bk[p] || 0, g = sold(p);
    const st = !g ? chip('mute', 'Advice only, not sold by Gramik') : q > 0 ? chip('ok', q + ' in stock') : aq > 0 ? chip('warm', 'Out here · ' + aq + ' at ' + OPS.STORES[alt].name.replace(' dark store', '')) : chip('hot', 'Out of stock');
    return `<li><div class="pwrap">${thumb(p)}<div><div class="pn">${esc(p)}</div><div class="pt">${esc(PR[p] ? (PR[p].tech || '') : '')}</div></div></div>
     <div class="pr">${g ? rupee(pr) : '–'}<small>${esc(perAcre((i.x.dose || [])[0]))}</small></div>
     <div class="pw"><div class="chips">${i.rec ? chip('green', 'Recommended') : i.cat ? '' : i.other ? chip('blue', 'In stock for this crop') : chip('mute', 'Also useful now')}${st}${BB[p] ? chip('violet', 'Bought ' + BB[p].times + '× · last ' + fmt(BB[p].last)) : ''}${(i.x.reasons || []).slice(0, 2).map(r => chip(r.factor === 3 ? 'hot' : 'mute', (r.factorLabel ? r.factorLabel + ': ' : '') + r.text)).join('')}</div>
     ${g ? `<div class="acts" style="margin-top:6px;align-items:center">${n ? `<span class="qty"><button type="button" data-act="bq" data-p="${esc(p)}" data-d="-1" aria-label="Less">−</button><span>${n}</span><button type="button" data-act="bq" data-p="${esc(p)}" data-d="1" aria-label="More">+</button></span><span class="small muted">packs (1 pack = 1 acre dose)</span>` : `<button class="btn ghost sm" data-act="badd" data-p="${esc(p)}">Add ${Math.max(1, Math.ceil(f.acres))} for ${f.acres} ac</button>`}</div>` : ''}</div></li>` };
  const lines = Object.entries(bk).filter(([, n]) => n > 0), sub = lines.reduce((t, [p, n]) => t + price(p) * n, 0);
  const dsc = discount(f, sub), ex = +(S.extraDisc && S.extraDisc[f.id]) || 0, tot = dsc.r + ex, need = tot > dsc.cap;
  const openO = allOrders().filter(o => o.f === f.id && ['Placed', 'Confirmed'].includes(o.status));
  el.innerHTML = `<div class="dh"><button class="btn ghost sm x" data-act="dclose">Close</button><h3>Products for ${esc(f.short)}</h3>
   <div class="rm">${esc(f.cropName)} · ${esc(f.stageEn)} · ${f.acres} ac · stock from ${esc(s.name)} ${SAMPLE}</div>
   <div class="rm">Recommended products ordered so far: <b class="num">${S.recStats.ordered} of ${S.recStats.rec}</b></div></div>
  <div class="db">${!f.b ? `<p class="note warm">${f.pop.nocrop ? 'There is no POP for ' + esc(f.crop) + ', so nothing is recommended. Showing products in stock.' : 'Fill crop details first to get recommended products. Showing products in stock for now.'}</p>` : ''}${f.ended ? '<p class="note warm">Crop is past its last stage. Plan the next crop before recommending products.</p>' : ''}
   ${f.b ? `<div class="gh">Problems seen in the field</div>` : ''}<div class="chips">${(f.b ? f.b.watch : []).slice(0, 8).map(x => `<label class="chipb ck"><input type="checkbox" data-act="seen" data-id="${f.id}" data-issue="${x.id}"${seen[x.id] ? ' checked' : ''}> ${esc(x.en)}</label>`).join('')}</div>
   <div class="filt" role="group" aria-label="Filter products">${[['all', 'All'], ['rec', 'Recommended'], ['stock', 'In stock'], ['both', 'Recommended and in stock']].map(([k, l]) => `<button class="chipb" type="button" data-act="dfilt" data-k="${k}" aria-pressed="${DFILT === k}">${l}</button>`).join('')}</div>
   <ul class="pl">${show.map(li).join('') || '<li><p class="empty">Nothing matches this filter.</p></li>'}</ul></div>
  <div class="df">${lines.length ? `<div class="tot">${lines.map(([p, n]) => `<span class="totp">${IMG[p] ? `<img class="cimg" src="${esc(IMG[p])}" alt="">` : ''}<span>${n} × ${esc(p)}</span></span><span class="n">${rupee(price(p) * n)}</span>`).join('')}
    <div class="howall"><button type="button" class="btn ghost sm" data-act="howall" aria-expanded="${HOWALL}">${HOWALL ? 'Hide how to use' : `How to use ${lines.length > 1 ? 'these ' + lines.length + ' products together' : 'this product'}`}</button>${HOWALL ? cartShort(f, lines.map(([p]) => p)) : ''}</div>
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

/* ================= Stores & stock: what the agronomist needs from the dark stores while taking orders ================= */
const DSL = (typeof DSD !== 'undefined' && DSD) || {stores: []}, DSOF = Object.fromEntries(DSL.stores.filter(x => x.desk).map(x => [x.desk, x]));
const stName = sid => { const d = DSOF[sid]; return d ? d.name.replace(/^DS#\d+ - /, '').replace(/ - Gramik$/, '') + ' (' + d.id + ')' : ((OPS.STORES[sid] || {}).name || sid) };
const stEta = s => s.load >= 90 ? '2–3 days' : s.load >= 70 ? '1–2 days' : 'Next day';
let SQ = '', SREADY = false, SOPEN = null;
/* demand from today's calls: recommended products of farmers still to call, packs needed vs stock at their serving store */
function stockNeed() {
  const M = new Map();
  callQueue().filter(r => r.st !== 'done' && r.f.b && !r.f.ended).forEach(r => { const f = r.f, sid = storeOf(f), n = Math.max(1, Math.ceil(+f.acres || 1));
    recs(f).now.map(x => x.product).filter(sold).slice(0, 3).forEach(p => { const k = p + '|' + sid, e = M.get(k) || {p, sid, farmers: [], need: 0}; e.farmers.push(f.short); e.need += n; M.set(k, e) }) });
  return [...M.values()].map(e => { const s = OPS.STORES[e.sid], have = stock(e.sid, e.p), alt = s.alt ? stock(s.alt, e.p) : 0;
    return Object.assign(e, {have, alt, altSid: s.alt, short: have < e.need, out: have === 0}) }).sort((a, b) => b.out - a.out || b.short - a.short || (b.need - b.have) - (a.need - a.have));
}
function vStores() {
  const sids = Object.keys(OPS.STORES).sort((a, b) => OPS.STORES[b].load - OPS.STORES[a].load), q = SQ.trim().toLowerCase();
  const card = sid => { const s = OPS.STORES[sid], d = DSOF[sid], open = SOPEN === sid, left = Math.max(0, Math.round(s.cap * (1 - s.load / 100))), cls = s.load >= 90 ? 'hot' : s.load >= 70 ? 'warm' : '';
    const L = Object.entries(s.stock).filter(([p]) => sold(p) && (!q || (p + ' ' + ((PR[p] || {}).tech || '')).toLowerCase().includes(q))).sort((a, b) => a[0].localeCompare(b[0]));
    const inS = L.filter(([, n]) => n > 0), outS = L.filter(([, n]) => n === 0), row = ([p, n]) => `<li>${IMG[p] ? `<img src="${esc(IMG[p])}" alt="">` : '<span class="noimg"></span>'}<span>${esc(p)}</span><b class="sq ${n === 0 ? 'out' : n <= 5 ? 'low' : ''}">${n}</b></li>`;
    return `<article class="dsc ${cls}${open ? ' open' : ''}"><button type="button" class="dsb" data-act="sopen" data-k="${sid}" aria-expanded="${open}">
      <span class="dsn"><span class="lbl2">${d ? esc(d.id) : 'ID not in sheet'}</span><b>${esc(stName(sid).replace(/ \(DS\d+\)$/, ""))}</b></span>
      <span class="dsl"><span class="bar"><i class="${cls}" style="width:${Math.min(100, s.load)}%"></i></span><span class="rm num"><b>${s.load}%</b> full · room for ~${left} of ${s.cap} orders</span></span><span class="wxc">${open ? 'Hide' : 'Stock'}<i aria-hidden="true">›</i></span></button>
     ${open ? `<div class="dsx"><input type="search" id="st-q" class="stq" placeholder="Search product or technical name" value="${esc(SQ)}" aria-label="Search stock in ${esc(stName(sid))}">
      <div class="dscols"><div><h4>In stock <span class="muted">${inS.length}</span></h4>${inS.length ? `<ul class="dsli">${inS.map(row).join('')}</ul>` : '<p class="rm">None</p>'}</div>
       <div><h4>Out of stock <span class="muted">${outS.length}</span></h4>${outS.length ? `<ul class="dsli">${outS.map(row).join('')}</ul>` : '<p class="rm">None</p>'}</div></div></div>` : ''}</article>` };
  return `<div class="pagehead"><div><h2>Dark store capacity ${SAMPLE}</h2><p>Click a store to see what is in stock and out of stock.</p></div></div>
  <section class="dsg1">${sids.map(card).join('')}</section>`;
}
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

/* ================= My profile: the signed-in agronomist's own numbers and orders ================= */
const ME = OPS.ME || {name: 'Agronomist', role: 'Agronomist', hub: ''};
const MST = ['Placed', 'Confirmed', 'Manifested', 'Out for delivery', 'Delivered', 'Rescheduled', 'Cancelled', 'Returned'];
const FLOW = ['Placed', 'Confirmed', 'Manifested', 'Out for delivery', 'Delivered'];
const SRCL = {EXOTEL_OUTGOING: 'Call out', EXOTEL_INCOMING: 'Call in', RCS: 'RCS', WHATSAPP: 'WhatsApp', FIELD_VISIT: 'Field visit'};
const DEAD = ['Cancelled', 'Returned'];
let MY = {tab: 'orders', per: '30', st: '', pay: '', src: '', kind: '', q: '', page: 0, open: null};
const initials = n => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
function myOrders() {
  const mine = (OPS.MYORD || []).map(o => Object.assign({}, o, {date: addDays(TODAY, -o.dAgo)}));
  const fresh = allOrders().map(o => ({id: o.id, fid: o.f, kind: 'FARMER', items: o.items, date: o.date, time: '', source: 'EXOTEL_OUTGOING',
    status: o.status, pay: o.status === 'Delivered' ? 'Paid' : o.status === 'Returned' ? 'Refunded' : 'Unpaid', disc: o.disc || 0, isNew: S.newOrders.some(n => n.id === o.id), reason: o.note, dAgo: diff(o.date, TODAY)}));
  return [...fresh, ...mine].map(o => Object.assign(o, S.myo && S.myo[o.id] || {}, {
    who: o.fid && FM[o.fid] ? FM[o.fid].short : o.name, amt: o.items.reduce((t, [p, q]) => t + price(p) * q, 0) * (1 - (o.disc || 0) / 100)}))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || (b.time || '').localeCompare(a.time || ''));
}
const inPer = (d, per) => per === 'all' || diff(d, TODAY) < (per === 'today' ? 1 : +per);
function myStats(per) {
  const O = myOrders(), P = O.filter(o => inPer(o.date, per)), sum = L => L.reduce((t, o) => t + o.amt, 0);
  const net = P.filter(o => !DEAD.includes(o.status)), can = P.filter(o => DEAD.includes(o.status)), td = O.filter(o => o.date === TODAY), tdNet = td.filter(o => !DEAD.includes(o.status));
  const act = (OPS.MYACT || []).filter(a => inPer(addDays(TODAY, -a.dAgo), per));
  const pops = act.filter(a => a.kind === 'pop').length + Object.values(S.prof).filter(p => p.on && inPer(p.on, per)).length;
  const calls = act.filter(a => a.kind === 'call').length + S.log.filter(l => l.ch === 'Call' && inPer(l.d, per)).length;
  const callsToday = (OPS.MYACT || []).filter(a => a.kind === 'call' && a.dAgo === 0).length + S.log.filter(l => l.ch === 'Call' && l.d === TODAY).length;
  const disp = P.filter(o => o.dispute), due = P.filter(o => !DEAD.includes(o.status) && o.pay !== 'Paid');
  return {O, P, net, can, td, tdNet, pops, calls, callsToday, disp, due, sum};
}
const ICO = {
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>', bag: '<path d="M9 4h6l-1.5 3h-3z"/><path d="M7.5 9h9c2 2 3.5 5 3.5 7.5 0 2.5-2 3.5-8 3.5s-8-1-8-3.5C4 14 5.5 11 7.5 9z"/><path d="M12 11.5v6M10 13.2c0-.9.9-1.4 2-1.4s2 .5 2 1.4-1 1.2-2 1.4-2 .5-2 1.4.9 1.4 2 1.4 2-.5 2-1.4"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>', cash: '<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
  ban: '<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>', clip: '<rect x="5.5" y="5" width="13" height="15.5" rx="2"/><path d="M9 3.5h6v3H9zM8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
  call: '<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 6a2 2 0 0 1 2-2z"/>', warn: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  up: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M16 13.5h2"/>'};
const icon2 = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
function stPill(st) { return `<span class="sp2 ${st.replace(/ /g, '')}">${esc(st)}</span>` }
function stProg(o) { const i = FLOW.indexOf(o.status), dead = DEAD.includes(o.status), rs = o.status === 'Rescheduled', at = rs ? 2 : i;
  return `<span class="prog${dead ? ' dead' : rs ? ' rs' : ''}" aria-hidden="true">${FLOW.map((_, k) => `<i class="${!dead && k <= at ? 'on' : ''}"></i>`).join('')}</span>` }
function payPill(p) { return `<span class="pay ${p.replace(/ /g, '')}">${esc(p)}</span>` }
function timeline(o) {
  if (DEAD.includes(o.status)) return [['Placed', o.date], [o.status, addDays(o.date, Math.min(o.dAgo || 0, o.status === 'Returned' ? 4 : 1))]];
  const at = o.status === 'Rescheduled' ? 2 : FLOW.indexOf(o.status), step = [0, 0, 1, 2, 3];
  return FLOW.map((s, k) => [s, k <= at ? addDays(o.date, Math.min(step[k], o.dAgo || 0)) : null]).concat(o.status === 'Rescheduled' ? [['Rescheduled', addDays(o.date, Math.min(3, o.dAgo || 0))]] : []);
}
function vMe() {
  const per = MY.per, x = myStats(per), plab = {today: 'today', '7': 'last 7 days', '30': 'last 30 days', all: 'all time'}[per];
  const tile = (ic, cls, big, lab, sub, act) => `<button class="mt ${cls}" type="button" data-act="mtile" data-f="${act}"><span class="mi">${icon2(ic)}</span><span class="mtb"><b class="num">${big}</b><span class="mtl">${lab}</span>${sub ? `<span class="mts num">${sub}</span>` : ''}</span></button>`;
  const head = `<section class="card mehead"><div class="meid"><span class="av lg">${initials(ME.name)}</span><div><h2>${esc(ME.name)}</h2><div class="rm">${esc(ME.role)} · ${esc(ME.hub)}${ME.since ? ' · since ' + fmt(ME.since) : ''}</div></div></div>
    <div class="seg3" role="group" aria-label="Period">${[['today', 'Today'], ['7', '7 days'], ['30', '30 days'], ['all', 'All time']].map(([k, l]) => `<button type="button" data-act="mper" data-k="${k}" aria-pressed="${per === k}">${l}</button>`).join('')}</div></section>`;
  const tiles = `<div class="mtiles">
    ${tile('box', 'blue', x.P.length, 'Orders created', rupee(x.sum(x.P)) + ' total', 'all')}
    ${tile('bag', 'amber', x.net.length, 'Net orders', rupee(x.sum(x.net)) + ' total', 'net')}
    ${tile('cal', 'sky', x.td.length, "Today's orders", x.td.length ? rupee(x.sum(x.td)) + ' total' : 'None yet today', 'today')}
    ${tile('cash', 'green', rupee(x.sum(x.tdNet)), "Today's revenue", x.tdNet.length ? x.tdNet.length + ' net orders' : '', 'today')}
    ${tile('ban', 'red', x.can.length, 'Cancelled / returned', rupee(x.sum(x.can)) + ' total', 'dead')}
    ${tile('clip', 'leaf', x.pops, 'POP created', per === 'today' ? 'today' : plab, 'pop')}
    ${tile('call', 'blue', per === 'today' ? x.callsToday : x.calls, per === 'today' ? 'Calls today' : 'Calls', per === 'today' ? '' : x.callsToday + ' today', 'call')}
    ${tile('warn', 'amber', x.disp.length, 'Disputed', x.disp.length ? rupee(x.sum(x.disp)) + ' total' : '', 'disp')}
    ${tile('wallet', 'violet', rupee(x.sum(x.due)), 'Payment pending', x.due.length + ' orders', 'due')}</div>`;
  const tabs = `<div class="tabs" role="tablist">${[['orders', 'My orders', x.P.length], ['overview', 'Overview', '']].map(([k, l, n]) => `<button class="tab" role="tab" type="button" data-act="mtab" data-k="${k}" aria-selected="${MY.tab === k}">${l}${n !== '' ? `<b>${n}</b>` : ''}</button>`).join('')}</div>`;
  return `<div class="stack">${head}${tiles}<section class="card">${tabs}<div style="margin-top:12px">${MY.tab === 'orders' ? myOrderList(x) : myOverview(x, plab)}</div></section></div>`;
}
function myFiltered(x) {
  const q = MY.q.trim().toLowerCase();
  return x.P.filter(o => (!MY.st || (MY.st === 'Disputed' ? !!o.dispute : MY.st === 'Open' ? !DEAD.includes(o.status) && o.status !== 'Delivered' : o.status === MY.st))
    && (!MY.pay || (MY.pay === 'pending' ? !DEAD.includes(o.status) && o.pay !== 'Paid' : o.pay === MY.pay)) && (!MY.src || o.source === MY.src) && (!MY.kind || o.kind === MY.kind)
    && (!q || (o.id + ' ' + o.who + ' ' + o.items.map(i => i[0]).join(' ')).toLowerCase().includes(q)));
}
function myOrderList(x) {
  const L = myFiltered(x), PG = 10, pages = Math.max(1, Math.ceil(L.length / PG)); MY.page = Math.min(MY.page, pages - 1);
  const cnt = st => x.P.filter(o => st === 'Disputed' ? o.dispute : st === 'Open' ? !DEAD.includes(o.status) && o.status !== 'Delivered' : o.status === st).length;
  const chips = [['', 'All', x.P.length], ['Open', 'In progress', cnt('Open')], ...MST.map(s => [s, s, cnt(s)]).filter(c => c[2]), ['Disputed', 'Disputed', cnt('Disputed')]];
  const srcs = [...new Set(x.P.map(o => o.source))], any = MY.st || MY.pay || MY.src || MY.kind || MY.q;
  const rows = L.slice(MY.page * PG, MY.page * PG + PG).map(o => { const op = MY.open === o.id, f = o.fid && FM[o.fid];
    const prods = o.items.length ? esc(o.items[0][0]) + (o.items.length > 1 ? ` <span class="muted">+${o.items.length - 1} more</span>` : '') : '<span class="muted">To be confirmed</span>';
    return `<tr class="orow${op ? ' open' : ''}" data-act="mopen" data-id="${o.id}" tabindex="0" aria-expanded="${op}"><td><span class="oid num">${esc(o.id)}</span>${o.isNew ? ' ' + chip('green', 'New') : ''}</td>
     <td><span class="kind ${o.kind}">${o.kind === 'FARMER' ? 'Farmer' : 'Retailer'}</span></td>
     <td>${f ? `<button class="lk" data-farmer="${f.id}">${esc(o.who)}</button>` : esc(o.who)}<div class="rm">${prods}</div></td>
     <td class="n"><b>${rupee(o.amt)}</b></td><td>${payPill(o.pay)}</td><td><span class="srcp">${esc(SRCL[o.source] || o.source)}</span></td>
     <td class="num" style="white-space:nowrap">${o.date === TODAY ? 'Today' : o.date === addDays(TODAY, -1) ? 'Yesterday' : fmt(o.date)}${o.time ? `<div class="rm">${hm({hr: +o.time.split(':')[0], min: +o.time.split(':')[1]})}</div>` : ''}</td>
     <td><div class="stc">${stPill(o.status)}${o.dispute ? `<span class="sp2 Disputed" title="${esc(o.dispute)}">Disputed</span>` : ''}</div>${stProg(o)}</td></tr>
     ${op ? `<tr class="odet"><td colspan="8"><div class="odg">
       <div><span class="sl">Products</span><ul class="oil">${o.items.map(([p, q]) => `<li><span>${esc(p)} <span class="muted">× ${q}</span></span><span class="num">${rupee(price(p) * q)}</span></li>`).join('')}<li class="tot2"><span>Total${o.disc ? ' (after ' + o.disc + '% discount)' : ''}</span><span class="num">${rupee(o.amt)}</span></li></ul></div>
       <div><span class="sl">Tracking</span><ol class="otl">${timeline(o).map(([s, d]) => `<li class="${d ? 'done' : ''} ${DEAD.includes(s) ? 'dead' : s === 'Rescheduled' ? 'rs' : ''}"><b>${esc(s)}</b><span class="rm">${d ? fmt(d) : 'pending'}</span></li>`).join('')}</ol>
        ${o.reason ? `<p class="note warm" style="margin-top:8px">${esc(o.reason)}</p>` : ''}${o.dispute ? `<p class="note hot" style="margin-top:8px"><b>Dispute:</b> ${esc(o.dispute)}</p>` : ''}</div>
       <div class="acts" style="align-content:flex-start"><button class="btn ghost sm" data-copy="${esc(o.id)}">Copy order ID</button>${f ? `<button class="btn ghost sm" data-farmer="${f.id}" data-tab="orders">Open farmer</button>` : ''}<button class="btn ghost sm" data-act="msms" data-id="${o.id}">Copy SMS to customer</button></div></div></td></tr>` : ''}` }).join('');
  return `<div class="ofilt"><div class="filt" role="group" aria-label="Status">${chips.map(([k, l, n]) => `<button class="chipb${k ? ' f-' + k.replace(/ /g, '') : ''}" type="button" data-act="mst" data-k="${k}" aria-pressed="${MY.st === k}">${l} <b class="num">${n}</b></button>`).join('')}</div>
   <div class="acts" style="align-items:center"><input type="search" id="my-q" placeholder="Order ID, customer or product" value="${esc(MY.q)}" aria-label="Search orders" style="min-width:220px">
    <select id="my-pay" aria-label="Payment"><option value="">Any payment</option>${['pending', 'Paid', 'Unpaid', 'Partly paid', 'Refunded'].map(p => `<option value="${p}"${MY.pay === p ? ' selected' : ''}>${p === 'pending' ? 'Payment pending' : p}</option>`).join('')}</select>
    <select id="my-src" aria-label="Source"><option value="">Any source</option>${srcs.map(p => `<option value="${p}"${MY.src === p ? ' selected' : ''}>${esc(SRCL[p] || p)}</option>`).join('')}</select>
    <select id="my-kind" aria-label="Customer type"><option value="">Farmers and retailers</option><option value="FARMER"${MY.kind === 'FARMER' ? ' selected' : ''}>Farmers</option><option value="RETAILER"${MY.kind === 'RETAILER' ? ' selected' : ''}>Retailers</option></select>
    ${any ? '<button class="lk" data-act="mclear">Clear filters</button>' : ''}<span style="flex:1"></span><button class="btn ghost sm" data-act="mexport">Export CSV</button></div></div>
   <p class="rm" style="margin:10px 0 6px"><b class="num">${L.length}</b> orders · <b class="num">${rupee(L.reduce((t, o) => t + o.amt, 0))}</b>${L.length ? ' · tap a row for products and tracking' : ''}</p>
   ${L.length ? `<div class="tw2"><table class="otab"><thead><tr><th>Order ID</th><th>For</th><th>Customer</th><th class="n">Amount</th><th>Payment</th><th>Source</th><th>Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
   ${pages > 1 ? `<div class="pager"><span class="rm">Showing ${MY.page * PG + 1}–${Math.min(L.length, MY.page * PG + PG)} of ${L.length}</span><button class="btn ghost sm" data-act="mpage" data-d="-1"${MY.page ? '' : ' disabled'}>Previous</button><span class="num">${MY.page + 1} / ${pages}</span><button class="btn ghost sm" data-act="mpage" data-d="1"${MY.page < pages - 1 ? '' : ' disabled'}>Next</button></div>` : ''}`
   : `<p class="empty">No orders match these filters. ${any ? '<button class="lk" data-act="mclear">Clear filters</button>' : ''}</p>`}
   <p class="src">${SAMPLE} Example orders. New orders you create from a farmer's Products drawer appear here at the top.</p>`;
}
function myOverview(x, plab) {
  const T = ME.target || {}, mo = myStats('30'), bar = (v, t, lab, fmtv) => `<div class="tg"><div class="tgh"><b>${lab}</b><span class="num">${fmtv(v)} <span class="muted">of ${fmtv(t)}</span></span></div><div class="bar"><i class="${v / t >= 1 ? '' : v / t >= .6 ? 'warm' : 'hot'}" style="width:${Math.min(100, Math.round(v / t * 100))}%"></i></div></div>`;
  const by = (L, k) => { const m = {}; L.forEach(o => { const key = k(o); m[key] = m[key] || {n: 0, v: 0}; m[key].n++; m[key].v += o.amt }); return Object.entries(m).sort((a, b) => b[1].v - a[1].v) };
  const st = by(x.P, o => o.status), tot = x.P.length || 1, src = by(x.net, o => SRCL[o.source] || o.source);
  const prod = {}; x.net.forEach(o => o.items.forEach(([p, q]) => { prod[p] = prod[p] || {q: 0, v: 0}; prod[p].q += q; prod[p].v += price(p) * q }));
  const top = Object.entries(prod).sort((a, b) => b[1].v - a[1].v).slice(0, 6), conv = x.P.length ? Math.round(x.net.length / x.P.length * 100) : 0;
  return `<div class="grid2"><div class="stack">
    <section><h3 class="h3">Monthly targets <span class="rm">last 30 days</span></h3>${bar(mo.net.length, T.orders || 60, 'Net orders', v => v)}${bar(mo.sum(mo.net), T.revenue || 60000, 'Revenue', rupee)}${bar(mo.pops, T.pop || 40, 'POP created', v => v)}</section>
    <section><h3 class="h3">Orders by status <span class="rm">${plab}</span></h3><div class="stk">${st.map(([k, v]) => `<button type="button" class="sk ${k.replace(/ /g, '')}" style="flex-grow:${v.n}" data-act="mstgo" data-k="${esc(k)}" title="${esc(k)}: ${v.n}"></button>`).join('')}</div>
     <ul class="lg2">${st.map(([k, v]) => `<li><button type="button" class="lk" data-act="mstgo" data-k="${esc(k)}"><i class="dot ${k.replace(/ /g, '')}"></i>${esc(k)}</button><span class="num">${v.n} · ${Math.round(v.n / tot * 100)}%</span></li>`).join('')}</ul>
     <p class="rm">${conv}% of orders created went through (not cancelled or returned).</p></section></div>
   <div class="stack"><section><h3 class="h3">Where orders come from <span class="rm">net orders</span></h3><div class="tw2"><table><tbody>${src.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v.n}</td><td class="n">${rupee(v.v)}</td><td style="width:40%"><div class="bar"><i style="width:${Math.round(v.v / Math.max(1, x.sum(x.net)) * 100)}%"></i></div></td></tr>`).join('')}</tbody></table></div></section>
    <section><h3 class="h3">Top products sold</h3><div class="tw2"><table><tbody>${top.map(([p, v]) => `<tr><td><div class="pwrap">${thumb(p)}<b>${esc(p)}</b></div></td><td class="n">${v.q} packs</td><td class="n">${rupee(v.v)}</td></tr>`).join('') || '<tr><td class="muted">No sales in this period</td></tr>'}</tbody></table></div></section></div></div>`;
}
async function myExport() {
  const L = myFiltered(myStats(MY.per)), cell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = [['Order ID', 'For', 'Customer', 'Products', 'Amount', 'Payment', 'Source', 'Date', 'Time', 'Status', 'Dispute', 'Reason'].join(','),
    ...L.map(o => [o.id, o.kind, o.who, o.items.map(([p, q]) => p + ' x' + q).join('; '), Math.round(o.amt), o.pay, SRCL[o.source] || o.source, o.date, o.time, o.status, o.dispute || '', o.reason || ''].map(cell).join(','))].join('\n');
  let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null } catch (e) {}
  if (dl) { try { await dl.save({filename: 'my-orders-' + TODAY + '.csv', data: csv}); return } catch (e) { if (e && e.code === 'declined') return } }
  copy(csv); toast('CSV copied. Paste it into a spreadsheet.');
}
/* ================= Upload a call list ================= */
/* A call list (Excel or CSV) is read in the browser, each row is matched to an existing farmer or looked up in Lens
   (lensLookup: the one place to call the real Lens API), the agronomist checks a preview, and the rows join today's call queue. */
let UPL = null;
const UCOLS = {name: ['name', 'farmer', 'farmername', 'customer', 'customername', 'naam'], phone: ['phone', 'mobile', 'mobileno', 'mobilenumber', 'phoneno', 'phonenumber', 'contact', 'contactno', 'number'],
  id: ['lensid', 'farmerid', 'id', 'customerid', 'lenscode'], village: ['village', 'gram', 'gaon'], district: ['district', 'zila', 'jila'], pin: ['pincode', 'pin', 'postalcode', 'zip'],
  crop: ['crop', 'fasal'], variety: ['variety', 'seed', 'kism', 'seedvariety'], sow: ['sowingdate', 'sowing', 'sowdate', 'dateofsowing', 'transplantdate', 'transplanting', 'sown', 'buvai'],
  acres: ['acres', 'acre', 'land', 'area', 'landsize', 'landacres'], reason: ['reason', 'purpose', 'remark', 'remarks', 'note', 'notes', 'callpurpose', 'whycall'], pri: ['priority', 'pri']};
const UHEAD = ['Name', 'Phone', 'Lens ID', 'Village', 'District', 'Pincode', 'Crop', 'Variety', 'Sowing date', 'Acres', 'Reason', 'Priority'];
const phone10 = p => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : '' };
function parseCSV(text) {
  text = text.replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += ch }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload = () => window.XLSX ? ok(window.XLSX) : no(new Error('Excel reader did not load')); sc.onerror = () => no(new Error('Excel reader could not be loaded. Save the sheet as CSV and upload that.')); document.head.appendChild(sc) });
}
function excelDate(v) { const n = +v; if (!isFinite(n) || n < 20000 || n > 80000) return ''; return iso(new Date(Date.UTC(1899, 11, 30) + n * DAY)) }
function parseDateCell(v) {
  if (v == null || v === '') return ''; if (v instanceof Date && !isNaN(v)) return iso(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
  const t = String(v).trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(t))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  if (/^\d{5}(\.\d+)?$/.test(t)) return excelDate(t);
  const d = new Date(t); return isNaN(d) ? '' : iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}
/* the lookup: already my farmer → that farmer; found in Lens → the Lens record with its POP data; else a new farmer from the file */
function lensLookup(r) {
  const ph = phone10(r.phone), id = (r.id || '').trim();
  const mine = (id && FM[id]) || F.find(f => ph && phone10(f.phone) === ph);
  if (mine) return {type: 'mine', f: mine};
  const lens = (OPS.LENS || []).find(x => (id && x.id === id) || (ph && phone10(x.phone) === ph));
  if (lens) return {type: 'lens', rec: Object.assign({}, lens)};
  return {type: 'new'};
}
function readRows(table, fileName) {
  if (!table.length) return {err: 'The file is empty.'};
  const head = table[0].map(h => norm(String(h)));
  const col = {}; Object.entries(UCOLS).forEach(([k, names]) => { const i = head.findIndex(h => names.includes(h)); if (i >= 0) col[k] = i });
  if (col.phone == null && col.id == null) return {err: 'No Phone or Lens ID column found. The first row must be the column names, e.g. ' + UHEAD.slice(0, 3).join(', ') + '.'};
  const seenPh = new Set(), out = [];
  table.slice(1).forEach((row, i) => {
    const g = k => col[k] != null ? String(row[col[k]] ?? '').trim() : '';
    const r = {line: i + 2, name: g('name'), phone: g('phone'), id: g('id'), village: g('village'), district: g('district'), pin: g('pin').replace(/\D/g, ''), crop: g('crop'), variety: g('variety'),
      sow: parseDateCell(col.sow != null ? row[col.sow] : ''), acres: parseFloat(g('acres')) || 0, reason: g('reason'), pri: /high|urgent|1/i.test(g('pri')) ? 'high' : /low|3/i.test(g('pri')) ? 'low' : g('pri') ? 'med' : ''};
    if (!r.name && !r.phone && !r.id) return;
    const ph = phone10(r.phone);
    if (!ph && !r.id) { out.push(Object.assign(r, {type: 'skip', why: 'No valid phone number'})); return }
    if (ph && !/^[6-9]/.test(ph)) { out.push(Object.assign(r, {type: 'skip', why: 'Phone number looks wrong'})); return }
    const key = ph || r.id; if (seenPh.has(key)) { out.push(Object.assign(r, {type: 'skip', why: 'Same farmer appears twice in the file'})); return } seenPh.add(key);
    const m = lensLookup(r); Object.assign(r, m);
    if (m.type === 'new' && !r.name) r.name = 'Farmer ' + ph.slice(-4);
    r.preview = previewFarmer(r); out.push(r);
  });
  return {rows: out, fileName};
}
/* what this farmer will look like once added: crop, stage and POP status */
function previewFarmer(r) {
  if (r.type === 'mine') return r.f;
  const rec = r.type === 'lens' ? Object.assign({}, r.rec, {crop: r.rec.crop || r.crop, variety: r.rec.variety || r.variety, sow: r.rec.sow || r.sow})
    : {id: 'tmp', name: r.name, phone: phone10(r.phone), village: r.village, district: r.district, pin: r.pin, crop: r.crop || null, variety: r.variety || null, sow: r.sow || null, acres: r.acres, sample: false, uploaded: true};
  try { return prepFarmer(rec) } catch (e) { return null }
}
async function readFile(file) {
  const name = file.name || 'list', ext = (name.split('.').pop() || '').toLowerCase();
  if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
    const XL = await loadXLSX(), wb = XL.read(await file.arrayBuffer(), {type: 'array', cellDates: true});
    const ws = wb.Sheets[wb.SheetNames[0]]; return readRows(XL.utils.sheet_to_json(ws, {header: 1, raw: true, defval: ''}), name);
  }
  if (['csv', 'txt', 'tsv'].includes(ext) || /text|csv/.test(file.type)) return readRows(parseCSV(await file.text()), name);
  return {err: 'Upload an Excel (.xlsx) or CSV file.'};
}
function sampleList() {
  const ph = id => (OPS.FARM[id] || {}).phone || '', L = OPS.LENS || [];
  const t = [UHEAD,
    ['Insan Ali', ph('905605'), '', 'Malihabad', 'Lucknow', '', '', '', '', '', 'Check fruit set after Gibromax', 'High'],
    ['Brijesh Pal', ph('S-L07'), '', 'Gola', 'Lakhimpur Kheri', '', '', '', '', '', 'Top borer spray reminder', ''],
    ...L.slice(0, 6).map((x, i) => [x.name, x.phone, i % 2 ? x.id : '', x.village, x.district, '', '', '', '', '', ['Rabi seed treatment offer', 'IVR missed call', 'Weather advisory follow-up', 'Mandi price enquiry', 'KCC camp lead', 'Repeat buyer check'][i], i < 2 ? 'High' : '']),
    ['Shivam Tiwari', '9415507721', '', 'Bakshi Ka Talab', 'Lucknow', '226201', 'Wheat', 'HD-2967', '2026-10-25', '2', 'New lead from village meeting', ''],
    ['Meena Devi', '9415507722', '', 'Fatehpur', 'Fatehpur', '212601', 'Mustard', '', '', '1', 'Asked about aphid', ''],
    ['Sunil Kumar', '98765', '', 'Unnao', 'Unnao', '', '', '', '', '', 'Wrong number in sheet', ''],
    ['Insan Ali', ph('905605'), '', '', '', '', '', '', '', '', 'Duplicate row', '']];
  return readRows(t, 'Sample call list (built in)');
}
function templateCSV() { return [UHEAD.join(','), 'Ram Kumar,9876543210,,Malihabad,Lucknow,226102,Wheat,DBW 303,25-10-2026,2,New lead from IVR,High', 'Sita Devi,9876501234,LN-20412,,,,,,,,Follow up on potato order,'].join('\n') }
const UTYPE = {mine: ['ok', 'Already your farmer'], lens: ['blue', 'Found in Lens · POP fetched'], new: ['warm', 'New · not in Lens'], skip: ['mute', 'Skipped']};
function renderUpload() {
  const el = $('upl'); if (!UPL) { el.hidden = true; if ($('drawer').hidden) $('scrim').hidden = true; return }
  let body;
  if (UPL.step === 'pick') {
    body = `<div class="uph"><h3>Upload a call list</h3><button class="btn ghost sm" data-act="upclose">Close</button></div>
     <p class="sub" style="margin:0">Upload the list of farmers to call. Each farmer is matched to your farmers or looked up in Lens, and their crop, stage and POP details are fetched before they join today's call queue.</p>
     <label class="drop" for="upfile"><span class="dropi">${icon2('up')}</span><b>Choose an Excel or CSV file</b><span class="rm">.xlsx or .csv · first row = column names</span><input type="file" id="upfile" accept=".xlsx,.xls,.csv,text/csv"></label>
     ${UPL.busy ? '<p class="note">Reading the file…</p>' : ''}${UPL.err ? `<p class="note hot">${esc(UPL.err)}</p>` : ''}
     <div class="upcols"><span class="lbl2">Columns it understands</span><div class="chips">${UHEAD.map((h, i) => chip(i < 2 ? 'green' : 'mute', h + (i < 2 ? ' (needed)' : ''))).join('')}</div>
      <p class="rm" style="margin:6px 0 0">Phone or Lens ID is enough: crop, variety and sowing date come from Lens when the farmer is there. Hindi names like Fasal, Kism, Gaon also work.</p></div>
     <div class="acts"><button class="btn ghost" data-act="uptemplate">Download template</button><button class="btn ghost" data-act="upsample">Try the sample list</button></div>`;
  } else {
    const R = UPL.rows, ok = R.filter(r => r.type !== 'skip'), cnt = t => R.filter(r => r.type === t).length;
    body = `<div class="uph"><h3>${esc(UPL.fileName)}</h3><button class="btn ghost sm" data-act="upclose">Close</button></div>
     <div class="upsum">${['mine', 'lens', 'new', 'skip'].map(t => `<div class="ups ${t}"><b class="num">${cnt(t)}</b><span>${UTYPE[t][1]}</span></div>`).join('')}</div>
     <div class="tw2 uptab"><table><thead><tr><th>Row</th><th>Farmer</th><th>Crop · stage (POP)</th><th>Reason</th><th>Result</th></tr></thead><tbody>
     ${R.map(r => { const p = r.preview; return `<tr class="${r.type === 'skip' ? 'skip' : ''}"><td class="num rm">${r.line}</td>
       <td><b>${esc(r.type === 'mine' ? r.f.short : r.type === 'lens' ? r.rec.name : r.name || '–')}</b><div class="rm num">${esc(r.phone || r.id || '')}${r.type === 'lens' ? ' · ' + esc(r.rec.id) : r.type === 'mine' && !r.f.sample ? ' · ' + esc(r.f.id) : ''}</div></td>
       <td>${r.type === 'skip' || !p ? '<span class="rm">–</span>' : p.b ? `${esc(p.cropName)} · ${esc(p.stageEn)}<div class="rm">${p.b.stage.das != null && p.b.stage.das >= 0 ? 'Day ' + p.b.stage.das + ' · ' : ''}${esc(p.variety || '')}</div>` : `${esc(p.cropName)}<div>${chip('needpop', p.pop.nocrop ? 'No POP for this crop' : 'Fill crop details on the call')}</div>`}</td>
       <td>${esc(r.reason || '')}${r.pri === 'high' ? ' ' + chip('hot', 'High') : ''}</td>
       <td>${chip(UTYPE[r.type][0], r.type === 'skip' ? r.why : UTYPE[r.type][1])}</td></tr>` }).join('')}</tbody></table></div>
     <label class="ck" style="margin-top:4px"><input type="checkbox" id="uphigh"${UPL.high ? ' checked' : ''}> Call this list first (mark every farmer high priority)</label>
     <div class="acts"><button class="btn" data-act="upadd"${ok.length ? '' : ' disabled'}>Add ${ok.length} farmer${ok.length === 1 ? '' : 's'} to call queue</button><button class="btn ghost" data-act="upback">Choose another file</button></div>`;
  }
  el.innerHTML = `<div class="upin">${body}</div>`; el.hidden = false; $('scrim').hidden = false;
}
function addUpload() {
  const R = UPL.rows.filter(r => r.type !== 'skip'), bid = 'U' + Date.now().toString(36), farmers = [], rows = [];
  R.forEach((r, i) => {
    let fid;
    if (r.type === 'mine') fid = r.f.id;
    else if (r.type === 'lens') { const rec = Object.assign({}, r.rec, {list: UPL.fileName}); farmers.push(rec); addFarmer(rec); fid = rec.id }
    else { const rec = {id: bid + '-' + (i + 1), name: r.name, phone: phone10(r.phone), village: r.village, district: r.district, pin: r.pin, crop: r.crop || null, variety: r.variety || null, sow: r.sow || null, acres: r.acres, state: 'Uttar Pradesh', orders: 0, value: 0, bought: [], lensPop: [], sample: false, uploaded: true, list: UPL.fileName};
      farmers.push(rec); addFarmer(rec); fid = rec.id }
    rows.push({fid, reason: r.reason, pri: UPL.high ? 'high' : (r.pri || 'med'), type: r.type});
  });
  S.uploads.push({id: bid, name: UPL.fileName, at: new Date().toISOString(), rows, farmers, counts: {mine: R.filter(r => r.type === 'mine').length, lens: R.filter(r => r.type === 'lens').length, new: R.filter(r => r.type === 'new').length, skip: UPL.rows.length - R.length}});
  save(); UPL = null; renderUpload(); QTAB = 'list'; QK = null; QSEL = rows[0] ? rows[0].fid : QSEL;
  toast(rows.length + ' farmers added to the call queue'); go('today');
}
const upOf = id => S.uploads.filter(u => u.rows.some(x => x.fid === id));
/* ================= End of call: outcome, interaction and rating in one form ================= */
/* After a call the farmer goes to one of three places:
   Order placed -> Orders (the service team confirms stock, delivery, payment)
   Callback -> your callbacks on the chosen date and time
   Undecided -> closed for now, back into the call queue after a few days (the call loop) */
let OUT = null;
const OKIND = [['order', 'Order placed', 'Goes to Orders · service team handles delivery'], ['callback', 'Callback', 'Comes back to you on the date you set'], ['undecided', 'Undecided', 'Closed now · back in the call queue later']];
const OREASONS = {
  callback: ['Not ordered yet', 'Wants time to think', 'Busy, asked to call later', 'Discussing with family', 'Waiting for the next crop stage', 'Waiting for money / payment', 'Wants price or product details', 'Product out of stock', 'Other'],
  undecided: ['Price feels high', 'Buys from the local shop', 'Not sure the product will work', 'Will decide after seeing the crop', 'Money not available now', 'Needs family approval', 'Not interested right now', 'Other']};
/* callback calendar: how many callbacks are already set on each date */
const cbLoad = () => { const m = {}; allFup().forEach(x => { m[x.due] = (m[x.due] || 0) + 1 }); return m };
const loadCls = n => !n ? '' : n <= 3 ? 'l1' : n <= 5 ? 'l2' : 'l3';
function calGrid(month, sel, act, from) {
  const [y, mo] = month.split('-').map(Number), first = new Date(Date.UTC(y, mo - 1, 1)), days = new Date(Date.UTC(y, mo, 0)).getUTCDate(), lead = (first.getUTCDay() + 6) % 7, L = cbLoad();
  const cells = []; for (let i = 0; i < lead; i++) cells.push('<span class="cd pad"></span>');
  for (let d = 1; d <= days; d++) { const k = `${month}-${String(d).padStart(2, '0')}`, n = L[k] || 0, past = k < TODAY;
    cells.push(`<button type="button" class="cd ${loadCls(n)}${k === sel ? ' sel' : ''}${k === TODAY ? ' tdy' : ''}${k === from ? ' from' : ''}" data-act="${act}" data-d="${k}"${past ? ' disabled' : ''} aria-pressed="${k === sel}" aria-label="${fmt(k)}: ${n} callback${n === 1 ? '' : 's'}"><b>${d}</b><span>${n || ''}</span></button>`) }
  const title = first.toLocaleDateString('en-IN', {month: 'long', year: 'numeric', timeZone: 'UTC'}), canBack = month > TODAY.slice(0, 7);
  return `<div class="cal"><div class="calh"><button type="button" class="btn ghost sm" data-act="calm" data-d="-1"${canBack ? '' : ' disabled'} aria-label="Previous month">‹</button><b>${title}</b><button type="button" class="btn ghost sm" data-act="calm" data-d="1" aria-label="Next month">›</button></div>
   <div class="calw">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(w => `<span>${w}</span>`).join('')}</div><div class="calg">${cells.join('')}</div>
   <div class="calk"><span><i class="l1"></i>1–3</span><span><i class="l2"></i>4–5</span><span><i class="l3"></i>6+ callbacks</span></div></div>`;
}
const monthAdd = (m, d) => { const [y, mo] = m.split('-').map(Number), t = new Date(Date.UTC(y, mo - 1 + d, 1)); return iso(t).slice(0, 7) };
const dayList = (d, skip) => allFup().filter(x => x.due === d && x.id !== skip && FM[x.f]).sort((a, b) => (a.time ? Date.parse('2000/1/1 ' + a.time) : 9e15) - (b.time ? Date.parse('2000/1/1 ' + b.time) : 9e15));
/* reschedule a callback with the calendar */
let RS = null;
function openResched(id) { const x = allFup().find(z => z.id === id); if (!x) return; RS = {id, from: x.due, sel: x.due < TODAY ? TODAY : x.due, month: (x.due < TODAY ? TODAY : x.due).slice(0, 7), time: x.time || ''}; renderResched() }
function renderResched() {
  const el = $('cal'); if (!RS) { el.hidden = true; if ($('drawer').hidden && !UPL && !OUT) $('scrim').hidden = true; return }
  const x = allFup().find(z => z.id === RS.id), f = FM[x.f], L = dayList(RS.sel, RS.id), taken = new Set(L.map(z => z.time).filter(Boolean)), n = L.length;
  el.innerHTML = `<div class="upin"><div class="uph"><div><span class="lbl2 g">Reschedule callback</span><h3>${esc(f.short)}</h3><span class="rm">${esc(x.why)} · now ${x.due < TODAY ? relDue(x.due) : fmt(x.due)}${x.time ? ', ' + esc(x.time) : ''}</span></div><button class="btn ghost sm" data-act="rsclose">Cancel</button></div>
   <div class="rsg"><div>${calGrid(RS.month, RS.sel, 'rsday', RS.from)}</div>
    <div class="rsd"><span class="lbl2">${fmt(RS.sel)} · ${wkd(RS.sel)}</span><b class="rsn ${loadCls(n + 1)}">${n} callback${n === 1 ? '' : 's'} already</b>
     ${L.length ? `<ul class="rsl">${L.map(z => `<li><span class="num">${esc(z.time || 'Any time')}</span><span>${esc(FM[z.f].short)}</span></li>`).join('')}</ul>` : '<p class="rm" style="margin:0">Nothing scheduled yet. A light day.</p>'}
     <label class="field"><span>Time</span><select id="rs-time"><option value="">Any time</option>${CB_TIMES.map(t => `<option${t === RS.time ? ' selected' : ''}${taken.has(t) ? ' disabled' : ''}>${t}${taken.has(t) ? ' · booked' : ''}</option>`).join('')}</select></label>
     <button class="btn" data-act="rsok">Confirm ${fmt(RS.sel)}</button></div></div></div>`;
  el.hidden = false; $('scrim').hidden = false;
}
function confirmResched() {
  const x = allFup().find(z => z.id === RS.id), t = $('rs-time') ? $('rs-time').value.replace(/ · booked$/, '') : RS.time, from = x.due, to = RS.sel;
  S.fup[x.id] = Object.assign(S.fup[x.id] || {}, {due: to, time: t, moved: (x.moved || 0) + 1, lastWhy: 'Rescheduled'}); save();
  const L = cbLoad(); RS = null; renderResched(); rerender();
  toast(from === to ? 'Time updated · ' + fmt(to) + (t ? ', ' + t : '') : `Moved to ${fmt(to)}${t ? ', ' + t : ''} · ${fmt(from)} now ${L[from] || 0}, ${fmt(to)} now ${L[to] || 0}`);
}
const CB_TIMES = ['9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM'];
function createOrder(f, lines, pref, urgent) {
  const sub = lines.reduce((s, [p, n]) => s + price(p) * n, 0), dsc = discount(f, sub), sid0 = storeOf(f), st = OPS.STORES[sid0] || OPS.STORES.LKO;
  const sid = st.load >= 90 && st.alt ? st.alt : sid0, oid = 'GO-' + (48300 + S.newOrders.length);
  S.newOrders.push({id: oid, f: f.id, date: TODAY, items: lines, status: 'Placed', store: OPS.STORES[sid] ? sid : 'LKO', pref: pref || null, urgent: !!urgent, urgentWhy: '', disc: dsc.r, approval: false, fromCall: true});
  return oid;
}
function openOutcome(id) {
  const f = FM[id]; if (!f) return; const r = callQueue().find(z => z.f.id === id) || {purpose: ''}, rt = rating(f);
  const pre = S.callOrder && S.callOrder.f === id ? S.callOrder.id : null, top = recs(f).now.filter(x => sold(x.product)).slice(0, 4);
  const bk = Object.entries(S.basket[id] || {}).filter(([, n]) => n > 0), packs = Math.max(1, Math.ceil(f.acres || 1));
  OUT = {fid: id, kind: pre ? 'order' : '', topic: r.needPop ? 'Other' : 'Crop problem', note: '', interest: rt.interest, trust: rt.trust, purpose: r.purpose, fu: r.fu || null,
    preOrder: pre, lines: bk.length ? bk.map(([p, n]) => ({p, n, on: true})) : top.map((x, i) => ({p: x.product, n: packs, on: i === 0})), pref: '',
    cbDate: addDays(TODAY, 1), cbTime: '', calM: addDays(TODAY, 1).slice(0, 7), cbWhy: r.purpose || '', back: 3, err: ''};
  renderOutcome();
}
function renderOutcome() {
  const el = $('cop'); if (!OUT) { el.hidden = true; if ($('drawer').hidden && !UPL) $('scrim').hidden = true; return }
  const o = OUT, f = FM[o.fid], stars = (k, v, lab, d) => `<div class="rate"><div><b>${lab}</b><div class="d">${d}</div></div><div class="seg3" role="group" aria-label="${lab}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="oset" data-k="${k}" data-v="${n}" aria-pressed="${v === n}">${n}</button>`).join('')}</div></div>`;
  const bk = o.lines.filter(l => l.on && S.basket[o.fid] && S.basket[o.fid][l.p]);
  const reasons = OREASONS[o.kind] || [], cbN = (cbLoad()[o.cbDate] || 0);
  const extra = o.kind === 'order' ? `<p class="note ok2">Order placed. ${o.preOrder ? 'Order <b>' + esc(o.preOrder) + '</b> was made during the call. ' : bk.length ? 'Products picked during the call: ' + bk.map(l => esc(l.p) + ' × ' + l.n).join(', ') + '. ' : ''}The service team confirms products, stock, delivery and payment. Just rate the farmer below.</p>`
    : o.kind === 'callback' ? `<div class="cbcal"><div>${calGrid(o.calM, o.cbDate, 'ocbday')}</div><div class="rsd"><span class="lbl2">Call back on</span><b class="cbsel">${fmt(o.cbDate)} · ${wkd(o.cbDate)}</b><span class="rsn ${loadCls(cbN + 1)}">${cbN} callback${cbN === 1 ? '' : 's'} already that day</span>
        ${cbTimes(o)}
        <label class="field"><span>What to talk about next time</span><input type="text" id="o-cbw" value="${esc(o.cbWhy)}"></label></div></div>`
    : o.kind === 'undecided' ? `<div class="form"><label class="field"><span>Back in the call queue after</span><select id="o-back">${[2, 3, 5, 7, 14].map(n => `<option value="${n}"${+o.back === n ? ' selected' : ''}>${n} days (${fmt(addDays(TODAY, n))})</option>`).join('')}</select></label></div>` : '';
  const why = reasons.length ? `<div class="form"><label class="field"><span>${o.kind === 'callback' ? 'Reason for callback' : 'Why undecided'}</span><select id="o-topic">${reasons.map(t => `<option${t === o.topic ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
     <label class="field wide"><span>What was discussed</span><textarea id="o-note" placeholder="What the farmer said">${esc(o.note)}</textarea></label></div>` : '';
  if (o.busy) { el.innerHTML = busyPanel(o, f); el.hidden = false; $('scrim').hidden = false; return }
  el.innerHTML = `<div class="upin"><div class="uph"><div><span class="lbl2 g">Call with ${esc(f.short)} · ${esc(f.phone)}</span><h3>Call outcome</h3></div><button class="btn ghost sm" data-act="ocancel">Back to call</button></div>
   <section class="osec"><h4>1 · Interaction</h4>
    <div class="okinds" role="radiogroup" aria-label="Outcome">${OKIND.map(([k, l, d]) => `<button type="button" role="radio" class="okind ${k}" data-act="okind" data-k="${k}" aria-checked="${o.kind === k}"><b>${l}</b><span>${d}</span></button>`).join('')}</div>
    ${extra}${why}</section>
   <section class="osec"><h4>2 · Rating</h4>${stars('interest', o.interest, 'Interest', 'Asks questions, wants to try products')}${stars('trust', o.trust, 'Trust in Gramik', 'Follows advice, buys again, refers others')}</section>
   ${o.err ? `<p class="note hot">${esc(o.err)}</p>` : ''}
   <div class="acts"><button class="btn" data-act="osave"${o.kind ? '' : ' disabled'}>Save and complete call</button><button class="btn ghost" data-act="obusy">Busy · call again today</button></div></div>`;
  el.hidden = false; $('scrim').hidden = false;
}
function readOutcomeForm() { const o = OUT, v = id => $(id) ? $(id).value : undefined;
  if (v('o-topic') !== undefined) o.topic = v('o-topic'); if (v('o-note') !== undefined) o.note = v('o-note'); if (v('o-pref') !== undefined) o.pref = v('o-pref');
  if (v('o-cbw') !== undefined) o.cbWhy = v('o-cbw'); if (v('o-back') !== undefined) o.back = +v('o-back') }
function saveOutcome() {
  readOutcomeForm(); const o = OUT, f = FM[o.fid]; let msg = '';
  if (o.kind === 'callback' && (!o.cbDate || o.cbDate < TODAY)) { o.err = 'Pick a callback date from today onwards.'; return renderOutcome() }
  let note = o.note.trim();
  if (o.kind === 'order') { const picked = Object.entries(S.basket[f.id] || {}).filter(([, n]) => n > 0), oid = o.preOrder || createOrder(f, picked, null); o.topic = 'Order';
    note = (note ? note + ' · ' : '') + 'Order ' + oid; msg = 'Order ' + oid + ' sent to the service team'; S.basket[f.id] = {} }
  if (o.kind === 'callback') { S.newFup.push({id: 'N' + Date.now(), f: f.id, due: o.cbDate, time: o.cbTime || '', why: o.cbWhy || o.topic || 'Call back', reason: o.topic, by: 'Agronomist'});
    note = o.topic + (note ? ': ' + note : '') + ' · Callback ' + fmt(o.cbDate) + (o.cbTime ? ', ' + o.cbTime : ''); msg = 'Callback set for ' + (o.cbDate === TODAY ? 'today' : fmt(o.cbDate)) + (o.cbTime ? ', ' + o.cbTime : '') }
  if (o.kind === 'undecided') { S.undecided.forEach(u => { if (u.f === f.id) u.closed = true }); note = o.topic + (note ? ': ' + note : '');
    S.undecided.push({f: f.id, at: TODAY, back: addDays(TODAY, o.back), note: note, why: o.purpose}); msg = 'Closed as undecided · back in the queue on ' + fmt(addDays(TODAY, o.back)) }
  if (o.fu) S.fup[o.fu.id] = Object.assign(S.fup[o.fu.id] || {}, {status: 'done'});
  addLog({f: f.id, ch: 'Call', topic: o.topic, out: {order: 'Ordered', callback: 'Callback', undecided: 'Undecided'}[o.kind], note: note || OKIND.find(k => k[0] === o.kind)[1]});
  S.rating[f.id] = Object.assign(S.rating[f.id] || {}, {interest: o.interest, trust: o.trust, by: 'R3', on: TODAY, confirmed: true});
  if (S.callOrder && S.callOrder.f === f.id) S.callOrder = null;
  save(); OUT = null; CALLING = null; renderOutcome();
  backToQueue(); toast('Call completed · ' + msg);
}
/* after a call: back to the call queue where you left it, next farmer selected */
function backToQueue() {
  const y = RET && RET.view === 'today' ? RET.y || 0 : 0; RET = null; VIEW = 'today'; OPEN_FORM = null; if (QTAB === 'done') QTAB = 'all';
  const nx = callQueue().find(z => z.st !== 'done'); if (nx) QSEL = nx.f.id; render(); window.scrollTo(0, y);
}
/* Busy: the farmer was busy or did not pick up; the call is scheduled again for later today at a chosen time */
const BUSY_WHY = ['Busy, asked to call later', "Didn't pick up", 'Switched off / not reachable', 'Call cut / network issue'];
const BUSY_TIMES = [...CB_TIMES, '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM'];
const tmin = t => { const m = t.match(/(\d+):(\d+) (AM|PM)/); return (+m[1] % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + +m[2] };
function busySlots() { const n = new Date(), now = n.getHours() * 60 + n.getMinutes(); let day = TODAY, L = BUSY_TIMES.filter(t => tmin(t) >= now + 20);
  if (!L.length) { day = addDays(TODAY, 1); L = BUSY_TIMES.slice(0, 8) } return {day, L} }
/* callback time on the chosen date: past times hidden for today, booked times show how many */
function cbTimes(o) {
  const n = new Date(), now = n.getHours() * 60 + n.getMinutes(), L = BUSY_TIMES.filter(t => o.cbDate !== TODAY || tmin(t) >= now + 20), taken = new Map();
  allFup().filter(x => x.due === o.cbDate && x.time && x.f !== o.fid).forEach(x => taken.set(x.time, (taken.get(x.time) || 0) + 1));
  if (o.cbTime && !L.includes(o.cbTime)) o.cbTime = '';
  return `<div class="cbtime"><span class="lbl2">Time</span><div class="btimes sm"><button type="button" class="bt" data-act="ocbtime" data-k="" aria-pressed="${!o.cbTime}">Any time</button>${L.map(t => `<button type="button" class="bt" data-act="ocbtime" data-k="${t}" aria-pressed="${o.cbTime === t}">${t}${taken.get(t) ? `<small>${taken.get(t)} booked</small>` : ''}</button>`).join('')}</div>${!L.length ? '<p class="rm" style="margin:4px 0 0">No time left today. Pick another date or keep Any time.</p>' : ''}</div>`;
}
function busyPanel(o, f) {
  const {day, L} = busySlots(), taken = new Map(); allFup().filter(x => x.due === day && x.time && x.f !== f.id).forEach(x => taken.set(x.time, (taken.get(x.time) || 0) + 1));
  if (!o.bTime || !L.includes(o.bTime)) o.bTime = L.find(t => !taken.has(t)) || L[0];
  return `<div class="upin"><div class="uph"><div><span class="lbl2 g">Call with ${esc(f.short)} · ${esc(f.phone)}</span><h3>Busy · call again ${day === TODAY ? 'today' : 'tomorrow'}</h3></div><button class="btn ghost sm" data-act="obusyback">Back</button></div>
   <section class="osec"><h4>What happened</h4><div class="chips bwhy">${BUSY_WHY.map(w => `<button type="button" class="chipb" data-act="obwhy" data-k="${esc(w)}" aria-pressed="${o.bWhy === w}">${esc(w)}</button>`).join('')}</div></section>
   <section class="osec"><h4>Call again at</h4>${day !== TODAY ? '<p class="note warm">No time left today. Pick a time tomorrow morning.</p>' : ''}
    <div class="btimes">${L.map(t => `<button type="button" class="bt" data-act="obtime" data-k="${t}" aria-pressed="${o.bTime === t}">${t}${taken.get(t) ? `<small>${taken.get(t)} booked</small>` : ''}</button>`).join('')}</div>
    <p class="rm" style="margin:8px 0 0">${f.short} stays in the call queue as a callback at the time you pick. No rating needed.</p></section>
   <div class="acts"><button class="btn" data-act="obsave">Schedule call at ${esc(o.bTime)}${day === TODAY ? '' : ' tomorrow'}</button></div></div>`;
}
function busySave() {
  const o = OUT, f = FM[o.fid], {day} = busySlots(), why = o.bWhy || BUSY_WHY[0];
  addLog({f: f.id, ch: 'Call', topic: 'Other', out: 'Not reachable', note: why + ' · call again ' + (day === TODAY ? 'today' : fmt(day)) + ' ' + o.bTime});
  if (o.fu) S.fup[o.fu.id] = Object.assign(S.fup[o.fu.id] || {}, {status: 'done'});
  S.newFup.push({id: 'N' + Date.now(), f: f.id, due: day, time: o.bTime, why: why + ': ' + (o.fu ? o.fu.why : o.purpose || 'call again'), reason: why, by: 'Agronomist'});
  save(); OUT = null; CALLING = null; renderOutcome(); backToQueue(); toast(`${f.short}: ${why.toLowerCase()} · call again ${day === TODAY ? 'today' : 'tomorrow'} at ${o.bTime}`);
}
function noAnswer() {
  const f = FM[OUT.fid]; addLog({f: f.id, ch: 'Call', topic: 'Other', out: 'Not reachable', note: "Didn't pick up"});
  save(); OUT = null; CALLING = null; renderOutcome(); backToQueue(); toast(f.short + " didn't pick up · stays in the call queue");
}
/* ================= After calls: where each call ended up ================= */
function vAfter() {
  const fromCall = allOrders().filter(o => o.fromCall || S.newOrders.some(n => n.id === o.id)), samples = allOrders().filter(o => !fromCall.includes(o) && OPEN.includes(o.status));
  const ords = [...fromCall.sort((a, b) => b.date.localeCompare(a.date)), ...samples];
  const cbs = allFup().sort((a, b) => a.due.localeCompare(b.due) || (Date.parse('2000/1/1 ' + (a.time || '11:59 PM')) - Date.parse('2000/1/1 ' + (b.time || '11:59 PM'))));
  const und = S.undecided.filter(u => !u.closed && FM[u.f]).sort((a, b) => a.back.localeCompare(b.back));
  const who = f => `<button class="lk qn" data-farmer="${f.id}">${esc(f.short)}</button><div class="rm">${esc(f.village)}, ${esc(f.district)} · ${esc(f.cropName)}</div>`;
  return `<div class="pagehead"><div><h2>After calls</h2><p>Every call ends in one of three places.</p></div></div>
  <div class="after3">
   <section class="card acol"><div class="ach o"><h3>Orders</h3><span>${ords.length}</span></div><p class="rm">Handled by the service team: stock, delivery and payment.</p>
    ${ords.length ? `<ul class="alist">${ords.map(o => { const f = FM[o.f]; return f ? `<li><div>${who(f)}<div class="rw">${o.items.length ? o.items.map(([p, q]) => q + ' × ' + esc(p)).join(', ') : '<span class="muted">Products to be confirmed by the service team</span>'}</div><div class="rm num">${esc(o.id)} · ${fmt(o.date)}${o.items.length ? ' · ' + rupee(oval(o)) : ''}${o.fromCall || S.newOrders.some(n => n.id === o.id) ? '' : ' · ' + 'sample'}</div></div><span class="st ${o.status.split(' ')[0]}">${esc(o.status)}</span></li>` : '' }).join('')}</ul>` : '<p class="empty">No orders yet.</p>'}</section>
   <section class="card acol"><div class="ach c"><h3>Callbacks</h3><span>${cbs.length}</span></div><p class="rm">Yours to call back. Due ones are in today's call queue.</p>
    ${cbs.length ? `<ul class="alist">${cbs.map(x => { const f = FM[x.f]; if (!f) return ''; const late = x.due < TODAY;
      return `<li><div>${who(f)}<div class="rw">${esc(x.why)}</div></div><div class="arr"><span class="chip ${late ? 'solid' : x.due === TODAY ? 'warm' : 'blue'}">${late ? relDue(x.due) : x.due === TODAY ? 'Today' : fmt(x.due)}${x.time ? ' · ' + esc(x.time) : ''}</span><div class="acts" style="justify-content:flex-end">${x.due <= TODAY ? `<button class="btn sm" data-act="gocall" data-id="${f.id}">${CALLING === f.id ? 'On call' : 'Call'}</button>` : ''}<button class="btn ghost sm" data-act="resch" data-id="${x.id}">Reschedule</button></div></div></li>` }).join('')}</ul>` : '<p class="empty">No callbacks set.</p>'}</section>
   <section class="card acol"><div class="ach u"><h3>Undecided</h3><span>${und.length}</span></div><p class="rm">Closed for now. They come back into the call queue on the date shown.</p>
    ${und.length ? `<ul class="alist">${und.map(u => { const f = FM[u.f]; return `<li><div>${who(f)}<div class="rw">${esc(u.note || u.why || 'Undecided')}</div><div class="rm">Undecided on ${fmt(u.at)}</div></div><span class="chip ${u.back <= TODAY ? 'upl' : 'mute'}">${u.back <= TODAY ? 'In queue now' : 'Back ' + fmt(u.back)}</span></li>` }).join('')}</ul>` : '<p class="empty">No undecided farmers.</p>'}</section>
  </div>`;
}
/* ================= events ================= */
function copy(text) {
  const done = () => toast('Copied');
  try { navigator.clipboard.writeText(text).then(done, () => fallback(text)) } catch (e) { fallback(text) }
}
function fallback(text) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Copied') } catch (e) { toast('Select the text and copy it') } t.remove() }
function addLog(e) { const n = new Date(); S.log.push(Object.assign({d: TODAY, by: 'Agronomist', hr: n.getHours(), at: n.toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'})}, e)) }
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y) }

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-go],[data-farmer],[data-act],[data-copy]'); if (!t) return;
  if (t.dataset.copy) return copy(t.dataset.copy);
  if (t.dataset.farmer && !t.dataset.act) { if (VIEW === 'today') QSEL = t.dataset.farmer; return go('farmer', t.dataset.farmer, t.dataset.tab || 'crop') }
  if (t.dataset.go && !t.dataset.act) { if (t.dataset.go === 'farmers' && t.closest('#rail')) FPOP = ''; return go(t.dataset.go) }
  const a = t.dataset.act, id = t.dataset.id;
  if (a === 'seen' || a === 'oline') return; // handled on change
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
  if (a === 'needlist') { FPOP = 'need'; return go('farmers') }
  if (a === 'fpop') { FPOP = t.dataset.k; return rerender() }
  if (a === 'profedit') { PD = null; OPEN_FORM = {kind: 'prof'}; return rerender() }
  if (a === 'pfmode') { PD.mode = t.dataset.m; return rerender() }
  if (a === 'pfsave') { const f = FM[id], d = PD, ck = d.crop && d.crop !== '__other' ? d.crop : null;
    const vk = ck ? (d.variety === '__unsure' ? Object.keys(D.P[ck].varieties).sort()[0] : d.variety) : null;
    const rec = {crop: ck || d.other.trim(), variety: vk, sow: ck && vk && !isCalOnly(ck, vk) ? draftSow(d) : null, acres: +d.acres || f.acres, on: TODAY, unsureVariety: d.variety === '__unsure' ? (d.asked || true) : false};
    S.prof[id] = rec; const nf = refit(id); PD = null; OPEN_FORM = null; STG = null;
    addLog({f: id, ch: 'Call', topic: 'Crop problem', out: 'Resolved', note: 'Crop details filled: ' + nf.cropName + (vk ? ', ' + vk : '') + (rec.sow ? ', sown ' + fmt(rec.sow) : '') + ', ' + rec.acres + ' ac'});
    save(); toast(nf.pop.ok ? 'POP plan ready: ' + nf.stageEn : 'Crop saved'); return rerender() }
  if (a === 'mtab') { MY.tab = t.dataset.k; return rerender() }
  if (a === 'mper') { MY.per = t.dataset.k; MY.page = 0; return rerender() }
  if (a === 'mst') { MY.st = t.dataset.k; MY.page = 0; MY.tab = 'orders'; return rerender() }
  if (a === 'mstgo') { MY.st = t.dataset.k; MY.tab = 'orders'; MY.page = 0; return rerender() }
  if (a === 'mclear') { Object.assign(MY, {st: '', pay: '', src: '', kind: '', q: '', page: 0}); return rerender() }
  if (a === 'mpage') { MY.page += +t.dataset.d; MY.open = null; return rerender() }
  if (a === 'mopen') { if (ev.target.closest('button,a')) return; MY.open = MY.open === id ? null : id; return rerender() }
  if (a === 'mexport') return myExport();
  if (a === 'msms') { const o = myOrders().find(z => z.id === id); return copy(`नमस्ते ${o.who} जी, आपका ग्रामिक ऑर्डर ${o.id} (${rupee(o.amt)}) की स्थिति: ${{Placed: 'दर्ज हो गया है', Confirmed: 'कन्फर्म हो गया है', Manifested: 'पैक होकर भेजने के लिए तैयार है', 'Out for delivery': 'आज डिलीवरी के लिए निकला है', Delivered: 'डिलीवर हो चुका है', Rescheduled: 'की डिलीवरी की तारीख बदली गई है', Cancelled: 'रद्द हो गया है', Returned: 'वापस आ गया है'}[o.status] || o.status}। ग्रामिक`) }
  if (a === 'mtile') { const k = t.dataset.f; Object.assign(MY, {st: '', pay: '', src: '', kind: '', q: '', page: 0, tab: 'orders'});
    if (k === 'today') MY.per = 'today'; else if (k === 'net') MY.st = 'Open'; else if (k === 'dead') MY.st = 'Cancelled'; else if (k === 'disp') MY.st = 'Disputed'; else if (k === 'due') MY.pay = 'pending';
    else if (k === 'pop') { FPOP = 'ok'; return go('farmers') } else if (k === 'call') { MY.tab = 'overview' }
    return rerender() }
  if (a === 'qtab') { QTAB = t.dataset.k; OPEN_FORM = null; return rerender() }
  if (a === 'qtab-overdue' || a === 'qtab-callback') { QTAB = a.slice(5); return rerender() }
  if (a === 'upopen') { UPL = {step: 'pick'}; return renderUpload() }
  if (a === 'upclose') { UPL = null; return renderUpload() }
  if (a === 'upback') { UPL = {step: 'pick'}; return renderUpload() }
  if (a === 'upsample') { UPL = Object.assign({step: 'preview'}, sampleList()); return renderUpload() }
  if (a === 'uptemplate') { const csv = templateCSV(); (async () => { let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null } catch (e) {}
      if (dl) { try { await dl.save({filename: 'gramik-call-list-template.csv', data: csv}); return } catch (e) { if (e && e.code === 'declined') return } } copy(csv); toast('Template copied. Paste it into Excel.') })(); return }
  if (a === 'upadd') { UPL.high = $('uphigh') && $('uphigh').checked; return addUpload() }
  if (a === 'upremove') { const u = S.uploads.find(x => x.id === id); if (u) { u.removed = true; save(); toast('"' + u.name + '" removed from the call queue') } return rerender() }
  if (a === 'upshow') { FUP2 = id; FPOP = ''; return rerender() }
  if (a === 'upshowall') { FUP2 = ''; return rerender() }
  if (a === 'qk') { QK = QK === t.dataset.k ? null : t.dataset.k; return rerender() }
  if (a === 'qsel') { if (ev.target.closest('button') && ev.target.closest('button') !== t) return; QSEL = id; QTAB = 'all'; rerender(); const b = document.querySelector('.card.cb'); if (b && b.scrollIntoView && t.closest('.qkp')) b.scrollIntoView({behavior: 'smooth', block: 'start'}); return }
  if (a === 'qorders') { Object.assign(MY, {per: 'today', st: '', pay: '', src: '', kind: '', q: '', page: 0, tab: 'orders'}); return go('me') }
  if (a === 'avail') { S.avail = t.dataset.k; save(); return rerender() }
  if (a === 'qopen' || a === 'qcall') return openCall(id);
  if (a === 'qcomplete') return CALLING ? openOutcome(CALLING) : null;
  if (a === 'qend') return CALLING ? openOutcome(CALLING) : null;
  if (a === 'back') return goBack();
  if (a === 'okind') { readOutcomeForm(); OUT.kind = t.dataset.k; OUT.err = ''; const R = OREASONS[OUT.kind] || []; if (R.length && !R.includes(OUT.topic)) OUT.topic = R[0]; return renderOutcome() }
  if (a === 'ocbtime') { readOutcomeForm(); OUT.cbTime = t.dataset.k; return renderOutcome() }
  if (a === 'ocbday') { readOutcomeForm(); OUT.cbDate = t.dataset.d; return renderOutcome() }
  if (a === 'calm') { const d = +t.dataset.d; if (RS) { RS.month = monthAdd(RS.month, d); return renderResched() } if (OUT) { readOutcomeForm(); OUT.calM = monthAdd(OUT.calM, d); return renderOutcome() } return }
  if (a === 'resch') return openResched(id);
  if (a === 'rsday') { RS.time = $('rs-time') ? $('rs-time').value : RS.time; RS.sel = t.dataset.d; return renderResched() }
  if (a === 'rsok') return confirmResched();
  if (a === 'rsclose') { RS = null; return renderResched() }
  if (a === 'oset') { readOutcomeForm(); OUT[t.dataset.k] = +t.dataset.v; return renderOutcome() }
  if (a === 'oqty') { readOutcomeForm(); const l = OUT.lines[+t.dataset.i]; l.n = Math.max(1, l.n + (+t.dataset.d)); l.on = true; return renderOutcome() }
  if (a === 'osave') return saveOutcome();
  if (a === 'ocancel') { OUT = null; renderOutcome(); return }
  if (a === 'onoans') return noAnswer();
  if (a === 'obusy') { readOutcomeForm(); OUT.busy = true; OUT.bWhy = OUT.bWhy || BUSY_WHY[0]; return renderOutcome() }
  if (a === 'obusyback') { OUT.busy = false; return renderOutcome() }
  if (a === 'obwhy') { OUT.bWhy = t.dataset.k; return renderOutcome() }
  if (a === 'obtime') { OUT.bTime = t.dataset.k; return renderOutcome() }
  if (a === 'obsave') return busySave();
  if (a === 'gocall') { RET = {view: 'after', y: window.scrollY}; return openCall(id) }
  if (a === 'qnext') { if (CALLING && FM[CALLING]) return openCall(CALLING); const open = callQueue().filter(r => r.st !== 'done'); if (!open.length) return toast('Nobody left to call today');
    const r = open.find(z => z.f.id === QSEL) || open[0]; return openCall(r.f.id) }
  if (a === 'qexport') { const Q = callQueue(), cell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [['Priority', 'Farmer', 'Phone', 'Village', 'District', 'Crop', 'Stage', 'Call purpose', 'Last contact', 'Status'].join(','), ...Q.map(r => [r.pri, r.f.short, r.f.phone, r.f.village, r.f.district, r.f.cropName, r.f.b ? r.f.stageEn : '', r.purpose, r.last, r.status].map(cell).join(','))].join('\n');
    (async () => { let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null } catch (e) {}
      if (dl) { try { await dl.save({filename: 'call-list-' + TODAY + '.csv', data: csv}); return } catch (e) { if (e && e.code === 'declined') return } } copy(csv); toast('CSV copied. Paste it into a spreadsheet.') })(); return }
  if (a === 'sready') { SREADY = !SREADY; return rerender() }
  if (a === 'sopen') { SOPEN = SOPEN === t.dataset.k ? null : t.dataset.k; SQ = ''; return rerender() }
  if (a === 'wxtog') { WXOPEN = !WXOPEN; return rerender() }
  if (a === 'more') { const k = t.dataset.k; MORE.has(k) ? MORE.delete(k) : MORE.add(k); return rerender() }
  if (a === 'howall') { HOWALL = !HOWALL; return drawer(true) }
  if (a === 'howl') { HOWL = t.dataset.k; try { localStorage.setItem('gramik_howl', HOWL) } catch (e) {} return drawer(true) }
  if (a === 'howfull') { HOWFULL = !HOWFULL; return drawer(true) }
  if (a === 'tab') { FTAB = t.dataset.tab; OPEN_FORM = null; return rerender() }
  if (a === 'drawer') { CV = null; catalog(); return drawer(true) }
  if (a === 'catopen') return catOpen();
  if (a === 'catclose') { CV = null; return catalog() }
  if (a === 'catback') { CV.sel = null; return catalog() }
  if (a === 'catsel') { CV.sel = +t.dataset.id; catalog(); $('catp').scrollTop = 0; const b = $('catp').querySelector('.db'); if (b) b.scrollTop = 0; return }
  if (a === 'catr') { CV.r = t.dataset.k; return catalog() }
  if (a === 'catadd') { const f = FM[CUR], bk = S.basket[f.id] = S.basket[f.id] || {}; bk[t.dataset.p] = Math.max(1, Math.ceil(f.acres)); save(); toast(t.dataset.p + ' added to the cart'); return catalog() }
  if (a === 'catcart') { CV = null; catalog(); return drawer(true) }
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
      S.newOrders.push({id: oid, f: f.id, date: TODAY, items: lines, status: 'Placed', store: sid, pref, urgent: urg, urgentWhy: '', disc: dsc.r + ex, approval: dsc.r + ex > dsc.cap, fromCall: CALLING === f.id});
      toast(oid + ' created' + (sid !== sid0 ? ', routed to ' + OPS.STORES[sid].name : '')) }
    if (CALLING === f.id) { const last = S.newOrders[S.newOrders.length - 1]; S.callOrder = {f: f.id, id: to || (last && last.id)} }
    else addLog({f: f.id, ch: 'Call', topic: 'Order', out: 'Ordered', note: lines.map(([p, n]) => n + ' × ' + p).join(', ')});
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
  if (t.dataset && t.dataset.act === 'oline' && OUT) { readOutcomeForm(); OUT.lines[+t.dataset.i].on = t.checked; return renderOutcome() }
  if (t.id === 'upfile' && t.files && t.files[0]) { const file = t.files[0]; UPL = {step: 'pick', busy: true}; renderUpload();
    readFile(file).then(r => { UPL = r.err ? {step: 'pick', err: r.err} : Object.assign({step: 'preview'}, r); if (!r.err && !r.rows.length) UPL = {step: 'pick', err: 'No farmer rows found under the column names.'}; renderUpload() })
      .catch(e => { UPL = {step: 'pick', err: (e && e.message) || 'Could not read this file.'}; renderUpload() }); return }
  if (t.dataset && t.dataset.act === 'seen') { const s = S.seen[t.dataset.id] = S.seen[t.dataset.id] || {}; s[t.dataset.issue] = t.checked; save();
    if (!$('drawer').hidden) drawer(true); else rerender(); return }
  if (t.id === 'xdisc') { S.extraDisc = S.extraDisc || {}; S.extraDisc[CUR] = Math.max(0, +t.value || 0); save(); return drawer(true) }
  if (t.id && t.id.startsWith('pf-') && PD) { const k = {'pf-crop': 'crop', 'pf-var': 'variety', 'pf-sow': 'sow', 'pf-stage': 'stage', 'pf-acres': 'acres', 'pf-other': 'other'}[t.id];
    PD[k] = t.value; if (k === 'crop') { PD.variety = ''; PD.stage = '' } if (k === 'variety') PD.stage = ''; return rerender() }
  if (t.id === 'my-pay' || t.id === 'my-src' || t.id === 'my-kind') { MY[t.id.slice(3)] = t.value; MY.page = 0; return rerender() }
  if (t.id === 'fdist') { FDIST = t.value; return rerender() }
  if (t.id === 'fcrop') { FCROP = t.value; return rerender() }
});
document.addEventListener('input', ev => { if (ev.target.id === 'my-q') { MY.q = ev.target.value; MY.page = 0; const pos = ev.target.selectionStart; render(); const s = $('my-q'); s.focus(); try { s.setSelectionRange(pos, pos) } catch (e) {} return } if (ev.target.id === 'fsearch') { FSEARCH = ev.target.value; const pos = ev.target.selectionStart; render(); const s = $('fsearch'); s.focus(); try { s.setSelectionRange(pos, pos) } catch (e) {} } });
$('scrim').addEventListener('click', () => { if (CV) { CV = null; return catalog() } if (RS) { RS = null; return renderResched() } if (OUT) return; if (UPL) { UPL = null; renderUpload() } drawer(false) });
document.addEventListener('input', e => { if (e.target && e.target.id === 'st-q') { SQ = e.target.value; const pos = e.target.selectionStart; rerender(); const i = $('st-q'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos) } catch (er) {} } } });
$('fab').addEventListener('click', () => { CV = null; catalog(); drawer(true) });
$('catp').addEventListener('input', e => { if (!CV) return; if (e.target.id === 'cat-q') { CV.q = e.target.value; const pos = e.target.selectionStart; catalog(); const i = $('cat-q'); i.focus(); try { i.setSelectionRange(pos, pos) } catch (er) {} } if (e.target.id === 'cat-gk') { CV.gk = e.target.checked; catalog() } });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && (e.target.classList.contains('orow') || e.target.classList.contains('qrow'))) { e.preventDefault(); e.target.click(); return } if (e.key === 'Escape' && CV) { CV = null; catalog(); return } if (e.key === 'Escape' && RS) { RS = null; renderResched(); return } if (e.key === 'Escape' && UPL) { UPL = null; renderUpload(); return } if (e.key === 'Escape' && !$('drawer').hidden) drawer(false) });
seedTodayList();
/* start: through the viewer's update hook when there is one, so a newly published version redraws fully in a page that is already open */
function start() { try { render() } catch (e) { console.error(e) } }
try { if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start() } catch (e) { start() }
/* if the view ever comes back empty (an update swapped the page under us), draw it again */
setTimeout(() => { if ($('view') && !$('view').children.length) start() }, 400);
document.addEventListener('visibilitychange', () => { if (!document.hidden && $('view') && !$('view').querySelector('.qdesk, .card, table, .pagehead, .fhead')) start() });
