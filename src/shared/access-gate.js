/* ui.getskibots.com ACCESS GATE — client overlay.
 *
 * Shows a password screen and asks /api/gate to check it (server-side). The passwords
 * are NEVER in this file or the bundle — they live in Vercel env vars. This script only
 * carries the UI + the fetch calls.
 *
 * Scope: engages ONLY on Vercel hosts (ui.getskibots.com + *.vercel.app). The public
 * GitHub Pages demo (getskibots.github.io) and local dev stay OPEN, so BotScrew's
 * reference demo is never gated. NOT part of the widget deliverable.
 */
(function () {
  var h = location.hostname;
  // Open everywhere except Vercel: demo (github.io) + local dev are ungated.
  if (h.endsWith('github.io') || h === 'localhost' || h === '127.0.0.1' || h === '') return;

  var STYLE =
    '#gsb-gate{position:fixed;inset:0;z-index:2147483647;background:#0f2233;' +
    'display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;}' +
    '#gsb-gate .gate-card{background:#fff;border-radius:14px;padding:32px 28px;width:min(360px,90vw);' +
    'box-shadow:0 20px 60px rgba(0,0,0,.35);text-align:center;}' +
    '#gsb-gate .gate-logo{font-size:22px;font-weight:700;color:#1f3b57;margin:0 0 4px;}' +
    '#gsb-gate .gate-sub{font-size:13px;color:#6b7a88;margin:0 0 20px;}' +
    '#gsb-gate input{width:100%;box-sizing:border-box;padding:12px 14px;font-size:15px;' +
    'border:1px solid #cfd8e0;border-radius:9px;outline:none;margin:0 0 12px;}' +
    '#gsb-gate input:focus{border-color:#2182BF;box-shadow:0 0 0 3px rgba(33,130,191,.15);}' +
    '#gsb-gate button{width:100%;padding:12px;font-size:15px;font-weight:600;color:#fff;' +
    'background:#2182BF;border:0;border-radius:9px;cursor:pointer;}' +
    '#gsb-gate button:hover{background:#1b6fa3;}' +
    '#gsb-gate .gate-err{color:#c0392b;font-size:13px;min-height:18px;margin:10px 0 0;}' +
    '#gsb-gate .gate-msg{color:#6b7a88;font-size:13px;}';

  function mount(inner) {
    var el = document.getElementById('gsb-gate');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gsb-gate';
      (document.body || document.documentElement).appendChild(el);
      var s = document.createElement('style'); s.textContent = STYLE; document.head.appendChild(s);
    }
    el.innerHTML = inner;
    return el;
  }
  function remove() { var el = document.getElementById('gsb-gate'); if (el) el.remove(); }

  function form(errMsg) {
    var el = mount(
      '<div class="gate-card">' +
        '<div class="gate-logo">Get Ski Bots</div>' +
        '<p class="gate-sub">Enter the password to continue.</p>' +
        '<input id="gsb-gate-pw" type="password" autocomplete="current-password" placeholder="Password" autofocus />' +
        '<button id="gsb-gate-go" type="button">Unlock</button>' +
        '<p class="gate-err">' + (errMsg || '') + '</p>' +
      '</div>');
    var input = el.querySelector('#gsb-gate-pw');
    var btn = el.querySelector('#gsb-gate-go');
    function submit() {
      var pw = input.value || '';
      btn.disabled = true; btn.textContent = 'Checking…';
      fetch('/api/gate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      }).then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (d && d.ok) { remove(); return; }
          if (d && d.configured === false) { form('Gate not configured yet.'); return; }
          form('Incorrect password.');
        })
        .catch(function () { form('Something went wrong — try again.'); });
    }
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    setTimeout(function () { try { input.focus(); } catch (_) {} }, 0);
  }

  // Cover the page immediately (opaque), then decide once we hear back from the server.
  mount('<div class="gate-card"><p class="gate-msg">Loading…</p></div>');
  fetch('/api/gate', { method: 'GET' })
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (d) {
      if (d && d.authed) { remove(); return; }
      if (d && d.configured === false) { form('Access gate is not configured. Set GATE_PW_1 / GATE_PW_2 in Vercel.'); return; }
      form('');
    })
    .catch(function () {
      // No /api reachable (e.g. a non-Vercel static host) — don't trap the user behind a dead gate.
      remove();
    });
})();
