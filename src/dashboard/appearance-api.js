/* GetSkiBots — appearance API client (endpoint-backed config transport).
 * =============================================================================
 * The dashboard's per-bot config load/save in embed mode. Talks to omni-odin's
 * `/api/appearance` (public GET, embed-token-gated PUT) instead of hitting
 * Supabase from the browser — so the dashboard is a stateless editor over the
 * GSB appearance service and Supabase is a detail behind the endpoint. This is
 * the production shape (mirrors how omni-odin's Knowledge page saves the prompt
 * through api/sendy-email-instructions.ts).
 *
 * Contract: getskibots/omni-odin → docs/handoff/APPEARANCE_CONTRACT.md
 *   GET  {apiBase}/api/appearance?bot_id=<botId>   → { config, publicIdentifier, updatedAt }
 *   PUT  {apiBase}/api/appearance                  → { updatedAt }
 *        body { bot_id, config, public_identifier? }, Authorization: Bearer <token>
 *
 * Image blobs are NOT sent here — they go to Storage first (materializeImages),
 * and the config carries only their URLs.
 * =============================================================================
 */

/**
 * @param {{ apiBase:string, token?:string }} opts
 *   apiBase — omni-odin origin hosting /api/appearance (e.g. https://omni-odin.vercel.app)
 *   token   — embed token for the authed PUT (per-bot JWT in prod; shared secret in dev)
 */
export function createAppearanceApi(opts) {
  opts = opts || {};
  var base = String(opts.apiBase || '').replace(/\/+$/, '');
  var token = opts.token || '';
  if (!base) throw new Error('[appearance-api] apiBase is required');

  function headers(extra) {
    var h = {};
    if (token) h.Authorization = 'Bearer ' + token;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  /** Load a bot's saved appearance. Returns { config, publicIdentifier, updatedAt } (config null if none yet). */
  async function load(botId) {
    if (!botId) throw new Error('[appearance-api] load: botId required');
    var res = await fetch(base + '/api/appearance?bot_id=' + encodeURIComponent(botId), {
      headers: headers({ Accept: 'application/json' }),
    });
    if (!res.ok) throw new Error('[appearance-api] load ' + res.status + ' ' + (await safeText(res)));
    return res.json();
  }

  /** Upsert a bot's appearance config (BotScrew-shaped object). */
  async function save(botId, config, publicIdentifier) {
    if (!botId) throw new Error('[appearance-api] save: botId required');
    var payload = { bot_id: botId, config: config };
    if (publicIdentifier) payload.public_identifier = publicIdentifier;
    var res = await fetch(base + '/api/appearance', {
      method: 'PUT',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('[appearance-api] save ' + res.status + ' ' + (await safeText(res)));
    return res.json();
  }

  return { load: load, save: save };
}

function safeText(res) { try { return res.text(); } catch (e) { return Promise.resolve(''); } }
