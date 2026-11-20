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
  function schedule() { clearTimeout(S.timer); S.timer = setTimeout(poll, S.root && document.visibilityState === 'visible' ? 4000 : 20000) }
  function markRead() { var to = S.last; if (to <= S.read) return; S.read = to; notify(); api('POST', {read: to}).catch(function () {}) }
  function send() {
    var ta = S.root && S.root.querySelector('.gdc-in'); if (!ta || S.sending) return; var body = ta.value.trim(); if (!body) return;
    S.sending = true; paintBtn();
    api('POST', {body: body}).then(function (j) { ta.value = ''; S.draft = ''; add(j.message); S.read = Math.max(S.read, j.message.id); S.err = ''; paint(true); ta.focus() })
      .catch(function (e) { S.err = e.message; paint() }).then(function () { S.sending = false; paintBtn(); notify() });
  }
  function del(id) {
    var m = S.byId[id]; if (!m) return; if (!confirmDelete()) return;
    api('POST', {del: id}).then(function () { m.deleted = true; m.body = ''; paint() }).catch(function (e) { S.err = e.message; paint() });
  }
  function confirmDelete() { return true }   /* no browser dialog: the delete button itself asks "Delete?" first */

  var CSS = '.gdc{display:flex;flex-direction:column;min-height:0}' +
    '.gdc-hd{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;margin-bottom:8px}.gdc-hd h2{margin:0;font-size:20px}.gdc-hd .gdc-sub{color:var(--ink-2,#5b6b62);font-size:13px}' +
    '.gdc-mem{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.gdc-m{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#dfe7e2);border-radius:999px;padding:3px 10px 3px 4px;font-size:13px;background:#fff}' +
    '.gdc-m .av{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#E8F1EC;color:var(--deep,#1f4d38);font-size:11px;font-weight:700;position:relative}' +
    '.gdc-m .av i{position:absolute;right:-2px;bottom:-2px;width:9px;height:9px;border-radius:50%;border:2px solid #fff;background:#B8C4BD}.gdc-m.on .av i{background:#1f9d55}.gdc-m small{color:var(--ink-2,#5b6b62)}' +
    '.gdc-list{flex:1;min-height:260px;height:calc(100vh - 330px);max-height:640px;overflow-y:auto;background:#F4F7F5;border:1px solid var(--line,#dfe7e2);border-radius:12px;padding:12px 12px 4px}' +
    '.gdc-day{text-align:center;margin:8px 0}.gdc-day span{font-size:12px;background:#fff;border:1px solid var(--line,#dfe7e2);border-radius:999px;padding:2px 10px;color:var(--ink-2,#5b6b62)}' +
    '.gdc-row{display:flex;margin:4px 0}.gdc-row.mine{justify-content:flex-end}' +
    '.gdc-b{max-width:min(78%,560px);background:#fff;border:1px solid var(--line,#dfe7e2);border-radius:12px 12px 12px 4px;padding:6px 10px 4px;box-shadow:0 1px 1px rgba(20,35,28,.05)}' +
    '.gdc-row.mine .gdc-b{background:#DCF3E4;border-color:#C4E6D0;border-radius:12px 12px 4px 12px}' +
    '.gdc-b .nm{font-size:12px;font-weight:700;color:var(--deep,#1f4d38);display:flex;gap:6px;align-items:center}.gdc-b .nm .ad{font-size:10px;font-weight:700;background:#1f4d38;color:#fff;border-radius:4px;padding:0 5px}' +
    '.gdc-b .tx{white-space:pre-wrap;word-break:break-word;font-size:15px;line-height:1.45}.gdc-b .tx a{color:#1b6fb5}' +
    '.gdc-b .mt{display:flex;justify-content:flex-end;gap:8px;align-items:center;font-size:11px;color:var(--ink-2,#5b6b62);margin-top:2px}' +
    '.gdc-b .mt button{all:unset;cursor:pointer;color:var(--ink-2,#5b6b62);font-size:11px;text-decoration:underline}.gdc-b .mt button.sure{color:#b42318;font-weight:700}' +
    '.gdc-b.del .tx{font-style:italic;color:var(--ink-2,#5b6b62);font-size:13px}' +
    '.gdc-empty{text-align:center;color:var(--ink-2,#5b6b62);padding:40px 10px}' +
    '.gdc-form{display:flex;gap:8px;align-items:flex-end;margin-top:10px}.gdc-in{flex:1;min-height:44px;max-height:140px;resize:vertical;font:inherit;font-size:15px;padding:10px 12px;border:1px solid var(--line,#dfe7e2);border-radius:10px}' +
    '.gdc-in:focus{outline:2px solid var(--green,#1f9d55);outline-offset:0}.gdc-send{min-height:44px}' +
    '.gdc-err{color:#b42318;font-size:13px;margin-top:6px}.gdc-hint{color:var(--ink-2,#5b6b62);font-size:12px;margin-top:4px}';
  function css() { if (document.getElementById('gdc-css')) return; var st = document.createElement('style'); st.id = 'gdc-css'; st.textContent = CSS; document.head.appendChild(st) }

  function membersHtml() {
    var on = S.members.filter(function (m) { return m.online }), off = S.members.filter(function (m) { return !m.online });
    return '<div class="gdc-mem" aria-label="Team members">' + on.concat(off).map(function (m) {
      return '<span class="gdc-m' + (m.online ? ' on' : '') + '" title="' + esc(m.online ? 'Online now' : 'Last seen ' + ago(m.last_seen)) + '"><span class="av">' + esc(initials(m.name)) + '<i></i></span>' + esc(m.name) +
        (m.role === 'admin' ? ' <small>admin</small>' : '') + (S.me && m.id === S.me.id ? ' <small>(you)</small>' : '') + '</span>' }).join('') + '</div>';
  }
  function listHtml() {
    if (!S.loaded) return '<div class="gdc-empty">Loading messages…</div>';
    if (!S.msgs.length) return '<div class="gdc-empty">No messages yet. Ask the team a question: a crop problem, a product, a difficult farmer. Anyone available can answer.</div>';
    var out = [], prev = '', prevUser = null;
    S.msgs.forEach(function (m) {
      var d = day(m.at); if (d !== prev) { out.push('<div class="gdc-day"><span>' + esc(dayLabel(m.at)) + '</span></div>'); prev = d; prevUser = null }
      var mine = S.me && m.user_id === S.me.id, canDel = !m.deleted && S.me && (mine || S.me.role === 'admin');
      out.push('<div class="gdc-row' + (mine ? ' mine' : '') + '"><div class="gdc-b' + (m.deleted ? ' del' : '') + '">' +
        (!mine && prevUser !== m.user_id ? '<div class="nm">' + esc(m.name) + (m.role === 'admin' ? '<span class="ad">ADMIN</span>' : '') + '</div>' : '') +
        '<div class="tx">' + (m.deleted ? 'This message was deleted' : linkify(m.body)) + '</div>' +
        '<div class="mt">' + (canDel ? '<button type="button" data-ch="del" data-id="' + m.id + '">Delete</button>' : '') + '<span>' + esc(hm(m.at)) + '</span></div></div></div>');
      prevUser = m.user_id;
    });
    return out.join('');
  }
  function paintBtn() { var b = S.root && S.root.querySelector('.gdc-send'); if (b) { b.disabled = S.sending; b.textContent = S.sending ? 'Sending…' : 'Send' } }
  function paint(toBottom) {
    if (!S.root) return;
    var list = S.root.querySelector('.gdc-list'), mem = S.root.querySelector('.gdc-memw'), err = S.root.querySelector('.gdc-err'), sub = S.root.querySelector('.gdc-sub');
    if (!list) return;
    var near = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = listHtml(); mem.innerHTML = membersHtml(); err.textContent = S.err || '';
    var on = S.members.filter(function (m) { return m.online }).length;
    sub.textContent = S.members.length + ' members · ' + on + ' online now';
    if (toBottom || near || S.jump) { list.scrollTop = list.scrollHeight; S.jump = false }
  }
  function mount(el) {
    css(); if (S.root === el && el.querySelector('.gdc')) return;
    S.root = el; S.jump = true;
    el.innerHTML = '<div class="gdc"><div class="gdc-hd"><h2>Team chat</h2><span class="gdc-sub"></span></div>' +
      '<div class="gdc-memw"></div><div class="gdc-list" role="log" aria-live="polite" aria-label="Messages"></div>' +
      '<form class="gdc-form"><label class="sr" for="gdc-in" style="position:absolute;left:-9999px">Message</label><textarea id="gdc-in" class="gdc-in" rows="1" maxlength="2000" placeholder="Message the team… (Enter to send, Shift+Enter for a new line)"></textarea>' +
      '<button class="btn gdc-send" type="submit">Send</button></form><div class="gdc-err" role="alert"></div>' +
      '<div class="gdc-hint">Everyone in the team sees these messages: all agronomists and the admin.</div></div>';
    var ta = el.querySelector('.gdc-in'); ta.value = S.draft;
    ta.addEventListener('input', function () { S.draft = ta.value });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); send() } });
    el.querySelector('.gdc-form').addEventListener('submit', function (e) { e.preventDefault(); send() });
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-ch="del"]'); if (!b) return; e.preventDefault(); e.stopPropagation();
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Delete?'; setTimeout(function () { if (b.isConnected) { b.classList.remove('sure'); b.textContent = 'Delete' } }, 4000); return }
      del(+b.dataset.id) });
    paint(true); if (S.last > S.read) markRead(); clearTimeout(S.timer); poll();
  }
  function unmount() { if (!S.root) return; S.root = null; schedule() }
  function start() { if (S.started) return; S.started = true; poll();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { clearTimeout(S.timer); poll() } }) }
  window.GDChat = {mount: mount, unmount: unmount, start: start, unread: unread, onChange: function (f) { S.subs.push(f) }, onMessage: function (f) { S.onMsg.push(f) }};
})();
