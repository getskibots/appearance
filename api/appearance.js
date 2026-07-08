/* Standalone appearance store endpoint (dependency-free).
 * =============================================================================
 * The self-contained appearance product: this API lives in the SAME repo as the
 * dashboard and deploys with it on Vercel, pointing at appearance's OWN Supabase
 * project (bimflyqohaxrpylkquhs) — fully independent of omni/Sendy.
 *
 * Dependency-free: raw fetch against Supabase's REST API (no @supabase/supabase-js),
 * matching this repo's zero-prod-dependency posture. Uses the SERVICE-ROLE key
 * server-side (bypasses RLS) after gating writes on the embed token.
 *
 *   GET /api/appearance?id=<publicIdentifier>   → PUBLIC  (the live widget reads)
 *   GET /api/appearance?bot_id=<botId>          → PUBLIC  (the dashboard loads)
 *         → { config, publicIdentifier, updatedAt }
 *   PUT /api/appearance   body { bot_id, config, public_identifier? }  → AUTHED
 *         → { updatedAt }
 *   GET /api/appearance?diag=1                  → non-secret config readout
 *
 * Env vars (Vercel, server-side only):
 *   APPEARANCE_SUPABASE_URL         — https://bimflyqohaxrpylkquhs.supabase.co
 *   APPEARANCE_SUPABASE_SERVICE_KEY — service-role secret key
 *   APPEARANCE_EMBED_SECRET         — shared secret gating PUT (FAIL-CLOSED)
 * =============================================================================
 */

const WRITE_ORIGINS = [
  'https://getskibots.github.io',
  'http://localhost:5173',
  'http://localhost:5180',
];

function header(req, name) {
  const h = req.headers && req.headers[name.toLowerCase()];
  return (Array.isArray(h) ? h[0] : h) || '';
}

function setCors(req, res) {
  const origin = header(req, 'origin');
  res.setHeader('Access-Control-Allow-Origin', WRITE_ORIGINS.includes(origin) ? origin : '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/** FAIL-CLOSED write gate: no secret configured → writes denied. */
function denyWrite(req) {
  const secret = process.env.APPEARANCE_EMBED_SECRET;
  if (!secret) return 'writes disabled: server missing APPEARANCE_EMBED_SECRET';
  const bearer = header(req, 'authorization').replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return 'missing embed token';
  if (bearer !== secret) return 'invalid embed token';
  return null;
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined) {
      resolve(typeof req.body === 'string' ? safeParse(req.body) : req.body);
      return;
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(safeParse(raw)));
    req.on('error', () => resolve(null));
  });
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

function qp(req, name) {
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const base = (process.env.APPEARANCE_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.APPEARANCE_SUPABASE_SERVICE_KEY;

  // Non-secret diagnostics.
  if (req.method === 'GET' && qp(req, 'diag')) {
    const secretRaw = process.env.APPEARANCE_EMBED_SECRET;
    res.status(200).json({
      writeConfigured: !!secretRaw,
      valueLength: (secretRaw || '').length,
      appearanceDbConfigured: !!(base && key),
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
      env: process.env.VERCEL_ENV || null,
    });
    return;
  }

  if (!base || !key) {
    res.status(500).json({ error: 'Server misconfigured: APPEARANCE_SUPABASE_URL / _SERVICE_KEY missing' });
    return;
  }
  const sbHeaders = { apikey: key, Authorization: 'Bearer ' + key };

  // ------------------------------------------------------------- GET (public)
  if (req.method === 'GET') {
    const id = qp(req, 'id');
    const botId = qp(req, 'bot_id');
    if (!id && !botId) { res.status(400).json({ error: 'Provide `id` (publicIdentifier) or `bot_id`' }); return; }
    const filter = id
      ? 'public_identifier=eq.' + encodeURIComponent(id)
      : 'bot_id=eq.' + encodeURIComponent(botId);
    try {
      const r = await fetch(`${base}/rest/v1/bot_appearance?${filter}&select=config,public_identifier,updated_at&limit=1`, { headers: { ...sbHeaders, Accept: 'application/json' } });
      if (!r.ok) { res.status(500).json({ error: `store ${r.status} ${await r.text().catch(() => '')}` }); return; }
      const rows = await r.json();
      const row = rows && rows[0];
      res.status(200).json({
        config: (row && row.config) || null,
        publicIdentifier: (row && row.public_identifier) || null,
        updatedAt: (row && row.updated_at) || null,
      });
    } catch (e) { res.status(502).json({ error: String(e && e.message || e) }); }
    return;
  }

  // -------------------------------------------------------------- PUT (authed)
  if (req.method === 'PUT') {
    const denied = denyWrite(req);
    if (denied) { res.status(401).json({ error: 'Unauthorized: ' + denied }); return; }
    const body = await readBody(req);
    if (!body || typeof body.bot_id !== 'string' || !body.bot_id) { res.status(400).json({ error: 'Missing or invalid `bot_id`' }); return; }
    if (!body.config || typeof body.config !== 'object') { res.status(400).json({ error: 'Missing or invalid `config`' }); return; }
    const nowIso = new Date().toISOString();
    const row = { bot_id: body.bot_id, config: body.config, updated_at: nowIso };
    if (typeof body.public_identifier === 'string' && body.public_identifier) row.public_identifier = body.public_identifier;
    try {
      const r = await fetch(`${base}/rest/v1/bot_appearance?on_conflict=bot_id`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row),
      });
      if (!r.ok) { res.status(500).json({ error: `store ${r.status} ${await r.text().catch(() => '')}` }); return; }
      res.status(200).json({ updatedAt: nowIso });
    } catch (e) { res.status(502).json({ error: String(e && e.message || e) }); }
    return;
  }

  res.status(405).send('Method Not Allowed');
}
