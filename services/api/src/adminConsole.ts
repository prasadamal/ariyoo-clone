// A small moderation page for the founder, served by the API itself at /admin-console.
// It holds no secrets: every action calls the existing /admin endpoints with the admin key the
// moderator types in, kept only for this browser tab (sessionStorage). The script is a separate
// same-origin file so the default Content-Security-Policy (no inline scripts) stays in force, and
// all text from users is written with textContent, never as HTML.

export const ADMIN_CONSOLE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ariyoo moderation</title>
<style>
  :root { color-scheme: light dark; --bg: #0f172a; --card: #1e293b; --line: #334155; --text: #f8fafc; --muted: #94a3b8; --red: #f87171; --green: #4ade80; --blue: #60a5fa; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.45 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--text); }
  main { max-width: 860px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; margin: 8px 0 4px; } h2 { font-size: 17px; margin: 24px 0 8px; }
  p.muted, .muted { color: var(--muted); }
  input, select, button { font: inherit; border-radius: 8px; border: 1px solid var(--line); padding: 8px 10px; background: #0b1222; color: var(--text); }
  button { cursor: pointer; background: var(--card); }
  button.danger { border-color: var(--red); color: var(--red); }
  button.ok { border-color: var(--green); color: var(--green); }
  button:disabled { opacity: .5; cursor: default; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin: 12px 0; }
  .msg { border-left: 3px solid var(--line); padding: 4px 10px; margin: 6px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .tag { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; font-size: 13px; color: var(--muted); }
  #notice { min-height: 1.4em; }
  #notice.error { color: var(--red); } #notice.ok { color: var(--green); }
</style>
</head>
<body>
<main>
  <h1>Ariyoo moderation</h1>
  <p class="muted">Act on every report within 24 hours. Your key stays in this browser tab only.</p>
  <form id="keyForm" class="row" autocomplete="off">
    <input id="key" type="password" placeholder="Admin key (ADMIN_API_KEY on Render)" aria-label="Admin key" style="flex:1;min-width:240px">
    <select id="status" aria-label="Which reports">
      <option value="open">Open reports</option>
      <option value="resolved">Resolved</option>
      <option value="dismissed">Dismissed</option>
    </select>
    <button type="submit">Load</button>
    <button type="button" id="forget">Forget key</button>
  </form>
  <p id="notice" role="status"></p>
  <section id="reports"></section>
  <h2>Find a member by email</h2>
  <form id="findForm" class="row" autocomplete="off">
    <input id="email" type="email" placeholder="member@example.com" aria-label="Member email" style="flex:1;min-width:240px">
    <button type="submit">Find</button>
  </form>
  <section id="member"></section>
</main>
<script src="/admin-console.js"></script>
</body>
</html>
`;

export const ADMIN_CONSOLE_JS = `'use strict';
(function () {
  var KEY = 'ariyoo-admin-key';
  var $ = function (id) { return document.getElementById(id); };
  var store = { get: function () { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } },
                set: function (v) { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) {} } };
  $('key').value = store.get();

  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') node.textContent = props[k];
      else if (k === 'className') node.className = props[k];
      else if (k === 'onclick') node.addEventListener('click', props[k]);
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return node;
  }
  function notice(text, kind) { var n = $('notice'); n.textContent = text || ''; n.className = kind || ''; }
  function when(iso) { try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); } }

  function call(method, path, body) {
    var key = $('key').value.trim();
    if (!key) return Promise.reject(new Error('Enter the admin key first.'));
    store.set(key);
    return fetch(path, {
      method: method,
      headers: Object.assign({ 'x-admin-key': key }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) throw new Error('That key is not right.');
        if (res.status === 429) throw new Error('Too many requests. Wait a few minutes.');
        if (!res.ok) throw new Error(data.message || ('Request failed (' + res.status + ')'));
        return data;
      });
    });
  }

  function personLine(label, p) {
    if (!p) return el('div', { className: 'muted', text: label + ': account deleted' });
    return el('div', {}, [label + ': ', el('strong', { text: p.fullName || '(no name)' }), ' ', el('span', { className: 'muted', text: '<' + p.email + '> #' + p.id }),
      p.suspendedAt ? el('span', { className: 'tag', text: ' suspended ' }) : null]);
  }

  function actions(buttons) { return el('div', { className: 'row', style: 'margin-top:10px' }, buttons); }
  function button(label, kind, run) {
    var b = el('button', { type: 'button', className: kind || '', text: label });
    b.addEventListener('click', function () {
      b.disabled = true;
      Promise.resolve().then(run).catch(function (e) { notice(e.message, 'error'); }).then(function () { b.disabled = false; });
    });
    return b;
  }

  function suspendButtons(person, after) {
    if (!person) return [];
    return [
      button(person.suspendedAt ? 'Lift suspension' : 'Suspend', person.suspendedAt ? 'ok' : 'danger', function () {
        return call('POST', '/admin/users/' + person.id + '/suspend', { suspended: !person.suspendedAt })
          .then(function (r) { return Promise.resolve(after()).then(function () { notice(r.suspended ? 'Suspended.' : 'Suspension lifted.', 'ok'); }); });
      }),
      button('Delete account', 'danger', function () {
        var typed = window.prompt('This permanently deletes ' + person.email + ' and their conversations. Type DELETE to confirm.');
        if (typed !== 'DELETE') return notice('Not deleted.', '');
        return call('DELETE', '/admin/users/' + person.id).then(function () { return Promise.resolve(after()).then(function () { notice('Account deleted.', 'ok'); }); });
      })
    ];
  }

  function loadReports() {
    var status = $('status').value;
    notice('Loading…');
    return call('GET', '/admin/reports?status=' + encodeURIComponent(status)).then(function (reports) {
      var box = $('reports'); box.textContent = '';
      notice(reports.length ? reports.length + ' ' + status + ' report' + (reports.length === 1 ? '' : 's') + '.' : 'No ' + status + ' reports.', 'ok');
      reports.forEach(function (r) {
        var messages = el('div', {}, (r.messages || []).map(function (m) {
          return el('div', { className: 'msg' }, [el('div', { className: 'muted', text: when(m.createdAt) }), m.messageText || (m.imageUrl ? '[photo]' : '')]);
        }));
        box.appendChild(el('div', { className: 'card' }, [
          el('div', { className: 'row' }, [el('strong', { text: r.reason }), el('span', { className: 'tag', text: r.status }), el('span', { className: 'muted', text: when(r.createdAt) + ' · report #' + r.id })]),
          r.details ? el('div', { className: 'msg', text: r.details }) : null,
          personLine('Reported', r.reported),
          personLine('Reporter', r.reporter),
          (r.messages || []).length ? el('div', { className: 'muted', text: 'Their latest messages in that conversation:' }) : null,
          messages,
          actions([
            r.status !== 'resolved' ? button('Mark resolved', 'ok', function () { return call('POST', '/admin/reports/' + r.id, { status: 'resolved' }).then(loadReports); }) : null,
            r.status !== 'dismissed' ? button('Dismiss', '', function () { return call('POST', '/admin/reports/' + r.id, { status: 'dismissed' }).then(loadReports); }) : null,
            r.status !== 'open' ? button('Reopen', '', function () { return call('POST', '/admin/reports/' + r.id, { status: 'open' }).then(loadReports); }) : null
          ].concat(suspendButtons(r.reported, loadReports)))
        ]));
      });
    }).catch(function (e) { notice(e.message, 'error'); });
  }

  function findMember() {
    var email = $('email').value.trim();
    var box = $('member'); box.textContent = '';
    if (!email) return Promise.resolve();
    return call('GET', '/admin/users?email=' + encodeURIComponent(email)).then(function (u) {
      box.appendChild(el('div', { className: 'card' }, [
        personLine('Member', u),
        el('div', { className: 'muted', text: 'Joined ' + when(u.createdAt) + (u.isSolver ? ' · expert' : '') }),
        actions(suspendButtons(u, findMember))
      ]));
    }).catch(function (e) { box.appendChild(el('p', { className: 'muted', text: e.message })); });
  }

  $('keyForm').addEventListener('submit', function (e) { e.preventDefault(); loadReports(); });
  $('findForm').addEventListener('submit', function (e) { e.preventDefault(); findMember(); });
  $('forget').addEventListener('click', function () { store.set(''); $('key').value = ''; $('reports').textContent = ''; notice('Key forgotten on this tab.', 'ok'); });
  if (store.get()) loadReports();
})();
`;
