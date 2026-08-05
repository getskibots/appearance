/* ui.getskibots.com ACCESS GATE — server-side password check (Vercel serverless).
 *
 * Works out of the box, no env vars needed: the two accepted passwords are stored as
 * SHA-256 HASHES below (never as plain text, and never in the client bundle — this file
 * runs server-side only). A submitted password is hashed and compared to these.
 *
 * Optional overrides (set in Vercel → Settings → Environment Variables to rotate without
 * a code change):
 *     GATE_PW_1, GATE_PW_2   plain-text passwords (take priority over the baked hashes)
 *     GATE_SECRET            random string that signs the session cookie (recommended)
 *
 * The client overlay (src/shared/access-gate.js) calls this:
 *     GET  /api/gate            -> { authed }                     (is this browser let in?)
 *     POST /api/gate {password} -> { ok } + Set-Cookie on success (try a password)
 *
 * On success we set an HttpOnly cookie holding an HMAC token (NOT the password). Soft gate:
 * a short password's hash is brute-forceable by someone reading this public repo, so treat
 * it as a deterrent, not hard security. NOT part of the widget deliverable.
 */
import crypto from 'node:crypto';

const COOKIE = 'gsb_gate';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// SHA-256 of the accepted passwords (Kickass1! and botscrew). Plain text stays out of the repo.
const PW_HASHES = [
  '684e789c00a440e197e44ac882173a459345b0e793d3899313a07649211e361e',
  '9f39d70fa95215936268ddd32ed426fe1b86a39d02f02dc367a8b1f2e3e5f0a5',
];

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

// Accepted password hashes: env overrides if provided, else the baked defaults.
function acceptedHashes() {
  const envPw = [process.env.GATE_PW_1, process.env.GATE_PW_2].filter(Boolean);
  return envPw.length ? envPw.map(sha256) : PW_HASHES;
}

// Session token = HMAC over a constant, keyed by a server-side secret. Unforgeable without
// the secret. Falls back to a baked constant when GATE_SECRET isn't set.
function token() {
  const secret = process.env.GATE_SECRET || ('gsb-gate|' + acceptedHashes().join('|'));
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
  const cookieVal = parseCookies(req.headers.cookie)[COOKIE] || '';
  return safeEqual(cookieVal, token());
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    let authed = false;
    try { authed = isAuthed(req); } catch (_) { authed = false; }
    return res.status(200).json({ authed: authed, configured: true });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const submitted = sha256(((body && body.password) || '').toString());
    const valid = acceptedHashes().some(function (h) { return safeEqual(h, submitted); });
    if (!valid) return res.status(401).json({ ok: false });
    res.setHeader('Set-Cookie', COOKIE + '=' + token() + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + MAX_AGE);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
