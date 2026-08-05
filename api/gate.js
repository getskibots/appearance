/* ui.getskibots.com ACCESS GATE — server-side password check (Vercel serverless).
 *
 * The two passwords live ONLY in Vercel environment variables — never in this repo,
 * never in the client bundle:
 *     GATE_PW_1   (e.g. the master password)
 *     GATE_PW_2   (e.g. the shared "botscrew" password)
 *     GATE_SECRET (optional; a random string that signs the session cookie — recommended)
 *
 * The client overlay (src/shared/access-gate.js) calls this:
 *     GET  /api/gate            -> { authed, configured }        (is this browser let in?)
 *     POST /api/gate {password} -> { ok } + Set-Cookie on success (try a password)
 *
 * On success we set an HttpOnly cookie holding an HMAC token (NOT the password), so the
 * password never reaches the browser. Fail-closed: if no passwords are configured, nobody
 * gets in and the overlay says so.
 *
 * NOT part of the widget deliverable — BotScrew can ignore or strip this file.
 */
import crypto from 'node:crypto';

const COOKIE = 'gsb_gate';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function configured() {
  return !!(process.env.GATE_PW_1 || process.env.GATE_PW_2);
}

// Session token = HMAC over a constant, keyed by a server-only secret. Deterministic so we
// can re-verify it on later requests, but unforgeable without the secret.
function token() {
  const secret = process.env.GATE_SECRET || ((process.env.GATE_PW_1 || '') + '|' + (process.env.GATE_PW_2 || ''));
  return crypto.createHmac('sha256', secret).update('gsb-gate-v1').digest('hex');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch (_) { return false; }
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body != null) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (_) { return resolve({}); } }
      return resolve(req.body);
    }
    let data = '';
    req.on('data', function (c) { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (_) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

function isAuthed(req) {
  if (!configured()) return false;
  const cookieVal = parseCookies(req.headers.cookie)[COOKIE] || '';
  return safeEqual(cookieVal, token());
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    let authed = false;
    try { authed = isAuthed(req); } catch (_) { authed = false; }
    return res.status(200).json({ authed: authed, configured: configured() });
  }

  if (req.method === 'POST') {
    if (!configured()) return res.status(200).json({ ok: false, configured: false });
    const body = await readBody(req);
    const pw = ((body && body.password) || '').toString();
    const candidates = [process.env.GATE_PW_1, process.env.GATE_PW_2].filter(Boolean);
    const valid = candidates.some(function (p) { return safeEqual(p, pw); });
    if (!valid) return res.status(401).json({ ok: false });
    res.setHeader('Set-Cookie', COOKIE + '=' + token() + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + MAX_AGE);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
