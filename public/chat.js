/* Team chat: one group for every agronomist and the admin (like a WhatsApp group).
   Used by the agronomist desk and the admin desk. Talks to /api/chat; checks for new messages every 4 s while open, every 20 s otherwise. */
(function () {
  var S = {msgs: [], byId: {}, last: 0, read: 0, me: null, members: [], root: null, draft: '', timer: null, busy: false, err: '', since: '', loaded: false, sending: false, subs: [], onMsg: [], started: false, first: true};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c] }) };
  var day = function (iso) { var d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() };
  var dayLabel = function (iso) { var d = new Date(iso), t = new Date(), y = new Date(Date.now() - 864e5);
    if (day(iso) === day(t.toISOString())) return 'Today'; if (day(iso) === day(y.toISOString())) return 'Yesterday';
    return d.toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric', month: 'short'}) };
  var hm = function (iso) { return new Date(iso).toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'}) };
  var ago = function (iso) { if (!iso) return 'not seen yet'; var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago' };
  var initials = function (n) { return String(n || '?').split(/\s+/).map(function (w) { return w[0] }).slice(0, 2).join('').toUpperCase() };
  var HUES = ['#1f7a4d', '#2563a8', '#a8551f', '#7b3fa0', '#b0306a', '#0f7d86', '#8a6d00', '#5a5fc7', '#c2410c', '#3f7d20'];
  var hue = function (id) { id = Math.abs(+id || 0); return HUES[id % HUES.length] };
  var avatar = function (m, extra) { return '<span class="gdc-av' + (extra || '') + '" style="background:' + hue(m.user_id != null ? m.user_id : m.id) + '" aria-hidden="true">' + esc(initials(m.name)) + '</span>' };
  var linkify = function (t) { return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>') };

  function api(method, body, qs) {
    return fetch('/api/chat' + (qs || ''), {method: method, credentials: 'same-origin', headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined})
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Chat is not reachable right now.'); return j }) });
  }
  function unread() { if (!S.me) return 0; var n = 0; for (var i = 0; i < S.msgs.length; i++) { var m = S.msgs[i]; if (m.id > S.read && m.user_id !== S.me.id && !m.deleted) n++ } return n }
  function notify() { S.subs.forEach(function (f) { try { f(unread()) } catch (e) {} }) }
  function add(m) { if (S.byId[m.id]) { Object.assign(S.byId[m.id], m); return false } S.byId[m.id] = m; S.msgs.push(m); if (m.id > S.last) S.last = m.id; return true }
  function poll() {
    if (S.busy) return; S.busy = true;
    api('GET', null, '?after=' + S.last + (S.since ? '&since=' + encodeURIComponent(S.since) : '')).then(function (j) {
      S.me = j.me; S.read = Math.max(S.read, j.read || 0); S.members = j.members || S.members; S.since = j.now || S.since;
      var fresh = [];
      (j.messages || []).forEach(function (m) { if (add(m) && !S.first) fresh.push(m) });
      (j.deleted || []).forEach(function (id) { var m = S.byId[id]; if (m) { m.deleted = true; m.body = '' } });
      S.first = false; S.loaded = true; S.err = '';
      if (fresh.length) fresh.forEach(function (m) { if (S.me && m.user_id !== S.me.id) S.onMsg.forEach(function (f) { try { f(m) } catch (e) {} }) });
      if (S.root && document.visibilityState === 'visible' && S.last > S.read) markRead();
    }).catch(function (e) { S.err = e.message }).then(function () { S.busy = false; paint(); notify(); schedule() });
  }
  /* light on the database: no checks while the tab is hidden or nobody has used the page for 5 minutes (they restart on the next touch);
     every 8 s while the chat is open, every 60 s otherwise */
  var IDLE_MS = 5 * 60e3; S.act = Date.now();
  function idle() { return document.visibilityState !== 'visible' || Date.now() - S.act > IDLE_MS }
  function schedule() { clearTimeout(S.timer); S.timer = null; if (idle()) return; S.timer = setTimeout(function () { if (idle()) { S.timer = null; return } poll() }, S.root ? 8000 : 60000) }
  function wake() { var was = idle(); S.act = Date.now(); if (S.started && (was || !S.timer) && !S.busy && document.visibilityState === 'visible') { clearTimeout(S.timer); poll() } }
  function markRead() { var to = S.last; if (to <= S.read) return; S.read = to; notify(); api('POST', {read: to}).catch(function () {}) }
  function send() {
    var ta = S.root && S.root.querySelector('.gdc-in'); if (!ta || S.sending) return; var body = ta.value.trim(); if (!body) return;
    S.sending = true; paintBtn();
    api('POST', {body: body}).then(function (j) { ta.value = ''; S.draft = ''; grow(ta); add(j.message); S.read = Math.max(S.read, j.message.id); S.err = ''; paint(true); ta.focus() })
      .catch(function (e) { S.err = e.message; paint() }).then(function () { S.sending = false; paintBtn(); notify() });
  }
  function del(id) {
    var m = S.byId[id]; if (!m) return; if (!confirmDelete()) return;
    api('POST', {del: id}).then(function () { m.deleted = true; m.body = ''; paint() }).catch(function (e) { S.err = e.message; paint() });
  }
  function confirmDelete() { return true }   /* no browser dialog: the delete button itself asks "Delete?" first */

  var CSS = '.gdc{display:flex;flex-direction:column;min-height:0;margin:-4px}' +
    '.gdc-top{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line,#dfe7e2);border-bottom:0;border-radius:14px 14px 0 0;background:var(--deep,#1f4d38);color:#fff}' +
    '.gdc-gav{flex:0 0 42px;width:42px;height:42px;border-radius:50%;background:#fff;display:grid;place-items:center}.gdc-gav svg{width:24px;height:24px}' +
    '.gdc-ttl{flex:1;min-width:0}.gdc-ttl b{display:block;font-size:17px;line-height:1.2}.gdc-sub{font-size:12.5px;color:#CFE3D6}' +
    '.gdc-stack{display:flex;align-items:center}.gdc-stack .gdc-av{width:28px;height:28px;font-size:11px;margin-left:-8px;border:2px solid var(--deep,#1f4d38)}' +
    '.gdc-mbtn{all:unset;cursor:pointer;font-size:13px;font-weight:600;color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:5px 12px;white-space:nowrap}.gdc-mbtn:hover{background:rgba(255,255,255,.12)}.gdc-mbtn:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
    '.gdc-mem{display:none;flex-wrap:wrap;gap:6px;padding:10px 12px;border:1px solid var(--line,#dfe7e2);border-bottom:0;background:#fff}.gdc.showmem .gdc-mem{display:flex}' +
    '.gdc-m{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#dfe7e2);border-radius:999px;padding:3px 10px 3px 3px;font-size:13px;background:#fff}.gdc-m small{color:var(--ink-2,#5b6b62)}' +
    '.gdc-av{flex:0 0 auto;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:700;position:relative;letter-spacing:.02em}' +
    '.gdc-m .gdc-av{width:24px;height:24px;font-size:10px}.gdc-dot{position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;border:2px solid #fff;background:#B8C4BD}.on .gdc-dot,.gdc-dot.on{background:#25D366}' +
    '.gdc-wrap{position:relative}' +
    '.gdc-list{height:calc(100vh - 300px);min-height:320px;max-height:680px;overflow-y:auto;padding:10px 14px 8px;border:1px solid var(--line,#dfe7e2);border-top:0;border-bottom:0;' +
      'background-color:#ECF2EE;background-image:radial-gradient(rgba(31,77,56,.06) 1px,transparent 1px);background-size:18px 18px}' +
    '.gdc-day{position:sticky;top:0;z-index:2;text-align:center;margin:8px 0;pointer-events:none}.gdc-day span{display:inline-block;font-size:12px;font-weight:600;background:#fff;border-radius:8px;padding:3px 12px;color:var(--ink-2,#5b6b62);box-shadow:0 1px 2px rgba(20,35,28,.12)}' +
    '.gdc-new{text-align:center;margin:10px 0}.gdc-new span{display:inline-block;font-size:12px;font-weight:700;color:var(--deep,#1f4d38);background:#FFF6D6;border-radius:8px;padding:3px 12px}' +
    '.gdc-row{display:flex;align-items:flex-end;gap:8px;margin:2px 0}.gdc-row.first{margin-top:10px}.gdc-row.mine{justify-content:flex-end}' +
    '.gdc-row .gdc-sp{flex:0 0 30px}' +
    '.gdc-bub{position:relative;max-width:min(76%,560px);background:#fff;border-radius:10px;padding:6px 10px 5px;box-shadow:0 1px 1px rgba(20,35,28,.13)}' +
    '.gdc-row.first:not(.mine) .gdc-bub{border-top-left-radius:2px}.gdc-row.mine .gdc-bub{background:#D9FDD3}.gdc-row.mine.first .gdc-bub{border-top-right-radius:2px}' +
    '.gdc-who{font-size:12.5px;font-weight:700;margin-bottom:1px;display:flex;align-items:center;gap:6px}.gdc-tag{font-size:10px;font-weight:700;background:var(--deep,#1f4d38);color:#fff;border-radius:4px;padding:0 5px}' +
    '.gdc-txt{white-space:pre-wrap;word-break:break-word;font-size:15px;line-height:1.45;color:#111b21}.gdc-txt a{color:#1b6fb5}' +
    '.gdc-meta{float:right;display:flex;gap:8px;align-items:center;margin:6px 0 -2px 12px;font-size:11px;color:#667781;line-height:1}' +
    '.gdc-meta button{all:unset;cursor:pointer;color:#667781;font-size:11px;opacity:0;transition:opacity .15s}.gdc-bub:hover .gdc-meta button,.gdc-meta button:focus-visible,.gdc-meta button.sure{opacity:1}.gdc-meta button:focus-visible{outline:2px solid var(--green,#1f9d55)}.gdc-meta button.sure{color:#b42318;font-weight:700}' +
    '.gdc-bub::after{content:"";display:block;clear:both}.gdc-bub.del .gdc-txt{font-style:italic;color:#667781;font-size:13.5px}' +
    '.gdc-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;color:var(--ink-2,#5b6b62);padding:40px 16px}.gdc-empty b{color:var(--deep,#1f4d38);font-size:16px}' +
    '.gdc-ideas{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:6px}.gdc-idea{all:unset;cursor:pointer;background:#fff;border:1px solid var(--line,#dfe7e2);border-radius:999px;padding:6px 12px;font-size:13px;color:var(--deep,#1f4d38)}.gdc-idea:hover{border-color:var(--deep,#1f4d38)}.gdc-idea:focus-visible{outline:2px solid var(--green,#1f9d55)}' +
    '.gdc-jump{position:absolute;right:16px;bottom:12px;width:40px;height:40px;border-radius:50%;border:0;background:#fff;box-shadow:0 2px 8px rgba(20,35,28,.25);cursor:pointer;display:none;place-items:center;color:var(--deep,#1f4d38)}.gdc-jump.show{display:grid}' +
    '.gdc-jump b{position:absolute;top:-6px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#25D366;color:#fff;font-size:11px;display:grid;place-items:center;padding:0 4px}' +
    '.gdc-form{display:flex;gap:8px;align-items:flex-end;padding:10px 12px;border:1px solid var(--line,#dfe7e2);border-top:0;border-radius:0 0 14px 14px;background:#F0F2F0}' +
    '.gdc-in{flex:1;min-height:44px;max-height:132px;resize:none;font:inherit;font-size:15px;line-height:1.4;padding:11px 16px;border:1px solid var(--line,#dfe7e2);border-radius:22px;background:#fff;overflow-y:auto}' +
    '.gdc-in:focus{outline:2px solid var(--green,#1f9d55);outline-offset:0}' +
    '.gdc-send{flex:0 0 44px;width:44px;height:44px;border-radius:50%;border:0;background:var(--deep,#1f4d38);color:#fff;display:grid;place-items:center;cursor:pointer}.gdc-send svg{width:20px;height:20px;margin-left:2px}' +
    '.gdc-send:disabled{opacity:.45;cursor:default}.gdc-send:focus-visible{outline:2px solid var(--green,#1f9d55);outline-offset:2px}' +
    '.gdc-err{color:#b42318;font-size:13px;margin-top:6px}.gdc-hint{color:var(--ink-2,#5b6b62);font-size:12px;margin-top:6px}' +
    '@media (max-width:640px){.gdc-bub{max-width:86%}.gdc-list{height:calc(100vh - 260px)}.gdc-stack{display:none}}';
  function css() { if (document.getElementById('gdc-css')) return; var st = document.createElement('style'); st.id = 'gdc-css'; st.textContent = CSS; document.head.appendChild(st) }

  function membersHtml() {
    var on = S.members.filter(function (m) { return m.online }), off = S.members.filter(function (m) { return !m.online });
    return on.concat(off).map(function (m) {
      return '<span class="gdc-m' + (m.online ? ' on' : '') + '" title="' + esc(m.online ? 'Online now' : 'Last seen ' + ago(m.last_seen)) + '"><span class="gdc-av" style="background:' + hue(m.id) + '">' + esc(initials(m.name)) + '<i class="gdc-dot"></i></span>' + esc(m.name) +
        (m.role === 'admin' ? ' <small>admin</small>' : '') + (S.me && m.id === S.me.id ? ' <small>(you)</small>' : '') + (m.online ? '' : ' <small>· ' + esc(ago(m.last_seen)) + '</small>') + '</span>' }).join('');
  }
  function stackHtml() {
    var on = S.members.filter(function (m) { return m.online && (!S.me || m.id !== S.me.id) }).slice(0, 5);
    return on.map(function (m) { return '<span class="gdc-av" style="background:' + hue(m.id) + '" title="' + esc(m.name) + ' is online">' + esc(initials(m.name)) + '</span>' }).join('');
  }
  var IDEAS = ['Mustard me aphid ka best spray kya hai?', 'Farmer bol raha hai price zyada hai, kya bolu?', 'Wheat me pehli sinchai ke baad kya dena chahiye?'];
  function listHtml() {
    if (!S.loaded) return '<div class="gdc-empty">Loading messages…</div>';
    if (!S.msgs.length) return '<div class="gdc-empty"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" stroke-linejoin="round"/></svg><b>No messages yet</b>' +
      '<span>Ask the team anything: a crop problem, a product, a difficult farmer. Whoever is free can answer.</span><div class="gdc-ideas">' + IDEAS.map(function (t) { return '<button type="button" class="gdc-idea" data-ch="idea">' + esc(t) + '</button>' }).join('') + '</div></div>';
    var out = [], prev = '', prevUser = null, newShown = false;
    S.msgs.forEach(function (m, i) {
      var d = day(m.at); if (d !== prev) { out.push('<div class="gdc-day"><span>' + esc(dayLabel(m.at)) + '</span></div>'); prev = d; prevUser = null }
      var mine = S.me && m.user_id === S.me.id;
      if (!newShown && S.openRead != null && m.id > S.openRead && !mine) { out.push('<div class="gdc-new" id="gdc-new"><span>Unread messages</span></div>'); newShown = true; prevUser = null }
      var first = prevUser !== m.user_id, canDel = !m.deleted && S.me && (mine || S.me.role === 'admin');
      out.push('<div class="gdc-row' + (mine ? ' mine' : '') + (first ? ' first' : '') + '">' + (!mine ? (first ? avatar(m) : '<span class="gdc-sp"></span>') : '') +
        '<div class="gdc-bub' + (m.deleted ? ' del' : '') + '">' +
        (!mine && first ? '<div class="gdc-who" style="color:' + hue(m.user_id) + '">' + esc(m.name) + (m.role === 'admin' ? '<span class="gdc-tag">ADMIN</span>' : '') + '</div>' : '') +
        '<span class="gdc-meta">' + (canDel ? '<button type="button" data-ch="del" data-id="' + m.id + '" aria-label="Delete message">Delete</button>' : '') + '<span>' + esc(hm(m.at)) + '</span></span>' +
        '<div class="gdc-txt">' + (m.deleted ? '🚫 This message was deleted' : linkify(m.body)) + '</div></div></div>');
      prevUser = m.user_id;
    });
    return out.join('');
  }
  var SEND_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>';
  function paintBtn() { var b = S.root && S.root.querySelector('.gdc-send'), ta = S.root && S.root.querySelector('.gdc-in'); if (b) { b.disabled = S.sending || !(ta && ta.value.trim()); b.setAttribute('aria-label', S.sending ? 'Sending' : 'Send message') } }
  function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(132, ta.scrollHeight + 2) + 'px' }
  function paint(toBottom) {
    if (!S.root) return;
    var list = S.root.querySelector('.gdc-list'), mem = S.root.querySelector('.gdc-mem'), err = S.root.querySelector('.gdc-err'), sub = S.root.querySelector('.gdc-sub'), st = S.root.querySelector('.gdc-stack'), jb = S.root.querySelector('.gdc-jump');
    if (!list) return;
    var near = list.scrollHeight - list.scrollTop - list.clientHeight < 80, before = S.msgs.length;
    list.innerHTML = listHtml(); mem.innerHTML = membersHtml(); st.innerHTML = stackHtml(); err.textContent = S.err || '';
    var on = S.members.filter(function (m) { return m.online }).length;
    sub.textContent = S.members.length + ' members · ' + on + ' online';
    if (S.jump) { var nw = list.querySelector('#gdc-new'); if (nw) list.scrollTop = Math.max(0, nw.offsetTop - 40); else list.scrollTop = list.scrollHeight; S.jump = false }
    else if (toBottom || near) list.scrollTop = list.scrollHeight;
    else if (jb) { S.missed = (S.missed || 0) + Math.max(0, before - (S.seenCount || before)) }
    S.seenCount = before; jumpBtn();
  }
  function jumpBtn() { var list = S.root && S.root.querySelector('.gdc-list'), jb = S.root && S.root.querySelector('.gdc-jump'); if (!list || !jb) return;
    var up = list.scrollHeight - list.scrollTop - list.clientHeight > 160; if (!up) S.missed = 0;
    jb.classList.toggle('show', up); jb.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>' + (S.missed ? '<b>' + S.missed + '</b>' : '') }
  function mount(el) {
    css(); if (S.root === el && el.querySelector('.gdc')) return;
    S.root = el; S.jump = true; S.openRead = S.read; S.missed = 0; S.seenCount = S.msgs.length;
    el.innerHTML = '<div class="gdc"><div class="gdc-top"><span class="gdc-gav" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#1f4d38" stroke-width="1.8"><path d="M12 21c-4-3.2-7-7-7-11a7 7 0 0 1 14 0c0 4-3 7.8-7 11z"/><path d="M12 14V8m0 0c-1.6 0-3 1-3 2.6M12 8c1.6 0 3 1 3 2.6"/></svg></span>' +
      '<div class="gdc-ttl"><b>Agronomist team</b><span class="gdc-sub"></span></div><span class="gdc-stack" aria-hidden="true"></span><button type="button" class="gdc-mbtn" data-ch="mem" aria-expanded="false">Members</button></div>' +
      '<div class="gdc-mem" aria-label="Team members"></div>' +
      '<div class="gdc-wrap"><div class="gdc-list" role="log" aria-live="polite" aria-label="Messages"></div><button type="button" class="gdc-jump" data-ch="jump" aria-label="Go to latest message"></button></div>' +
      '<form class="gdc-form"><label for="gdc-in" style="position:absolute;left:-9999px">Message</label><textarea id="gdc-in" class="gdc-in" rows="1" maxlength="2000" placeholder="Type a message"></textarea>' +
      '<button class="gdc-send" type="submit" aria-label="Send message" disabled>' + SEND_SVG + '</button></form><div class="gdc-err" role="alert"></div>' +
      '<div class="gdc-hint">Enter to send · Shift+Enter for a new line · everyone in the team sees these messages.</div></div>';
    var ta = el.querySelector('.gdc-in'), list = el.querySelector('.gdc-list'); ta.value = S.draft; grow(ta);
    ta.addEventListener('input', function () { S.draft = ta.value; grow(ta); paintBtn() });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); send() } });
    list.addEventListener('scroll', jumpBtn);
    el.querySelector('.gdc-form').addEventListener('submit', function (e) { e.preventDefault(); send() });
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ch]'); if (!t) return; var k = t.dataset.ch;
      if (k === 'mem') { var g = el.querySelector('.gdc'), open = !g.classList.contains('showmem'); g.classList.toggle('showmem', open); t.setAttribute('aria-expanded', open); return }
      if (k === 'jump') { list.scrollTop = list.scrollHeight; S.missed = 0; jumpBtn(); return }
      if (k === 'idea') { ta.value = t.textContent; S.draft = ta.value; grow(ta); paintBtn(); ta.focus(); return }
      if (k === 'del') { e.preventDefault(); e.stopPropagation();
        if (!t.classList.contains('sure')) { t.classList.add('sure'); t.textContent = 'Delete?'; setTimeout(function () { if (t.isConnected) { t.classList.remove('sure'); t.textContent = 'Delete' } }, 4000); return }
        del(+t.dataset.id) }
    });
    paint(true); paintBtn(); if (S.last > S.read) markRead(); clearTimeout(S.timer); poll();
  }
  function unmount() { if (!S.root) return; S.root = null; schedule() }
  function start() { if (S.started) return; S.started = true; poll();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') wake(); else { clearTimeout(S.timer); S.timer = null } });
    var last = 0; ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, function () { var n = Date.now(); if (n - last > 5000) { last = n; wake() } else S.act = n }, {passive: true, capture: true}) }) }
  window.GDChat = {mount: mount, unmount: unmount, start: start, unread: unread, onChange: function (f) { S.subs.push(f) }, onMessage: function (f) { S.onMsg.push(f) }};
})();
