/* GetSkiBots — Appearance Store connector (Supabase-backed).
 * =============================================================================
 * Production persistence for the appearance dashboard when embedded as an iframe
 * micro-frontend in BotScrew's admin. Replaces the prototype's localStorage
 * (gsb_widget_settings / gsb_preview_config).
 *
 * MULTI-TENANT: everything is keyed by botId — row-per-bot. "Across multiple bot
 * IDs" is just the primary key; there is no separate tenant system to build.
 *   - Config blob → table `bot_appearance` (PK bot_id), jsonb column `config`
 *   - Images      → Storage bucket `appearance`, path `{botId}/{filename}`
 *
 * DEPENDENCY-FREE: raw fetch against Supabase's REST + Storage HTTP APIs — no
 * @supabase/supabase-js. Keeps the repo's zero-prod-dependency posture.
 *
 * AUTH: the iframe receives a signed identity token from BotScrew (who + which
 * botIds). That token is the Bearer on Supabase requests; Supabase RLS scopes
 * access by bot_id. The Supabase anon key is the `apikey` header (publishable —
 * RLS is what protects the data). Credentials are INJECTED at init, never
 * hardcoded here.
 *
 * -----------------------------------------------------------------------------
 * Supabase one-time setup (run in the SQL editor):
 *
 *   create table bot_appearance (
 *     bot_id      text primary key,
 *     config      jsonb not null default '{}'::jsonb,
 *     updated_at  timestamptz not null default now()
 *   );
 *   alter table bot_appearance enable row level security;
 *   -- RLS: allow read/write only for bot_ids the caller's token is authorized for.
 *   -- (Example assumes the JWT carries an `authorized_bots` claim = array of ids.)
 *   create policy read_own  on bot_appearance for select
 *     using ( bot_id = any (coalesce((auth.jwt() -> 'authorized_bots')::text[], '{}')) );
 *   create policy write_own on bot_appearance for insert with check (
 *     bot_id = any (coalesce((auth.jwt() -> 'authorized_bots')::text[], '{}')) );
 *   create policy upd_own   on bot_appearance for update
 *     using ( bot_id = any (coalesce((auth.jwt() -> 'authorized_bots')::text[], '{}')) );
 *
 *   -- Storage: create a bucket `appearance`; public read (images render via <img>),
 *   -- writes gated by an equivalent path-prefix RLS on storage.objects (name like botId||'/%').
 * -----------------------------------------------------------------------------
 * Usage (in the dashboard's embed=1 boot):
 *
 *   import { createAppearanceStore, resolveEmbedContext, bindAutoResize } from './shared/appearance-store.js';
 *   const ctx   = await resolveEmbedContext({ allowedParentOrigin: 'https://bots.getskitickets.com' });
 *   const store = createAppearanceStore({ supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON, token: ctx.token });
 *   const saved = await store.load(ctx.botId);            // hydrate the dashboard (null = first run)
 *   // …on Save changes:
 *   await store.save(ctx.botId, toBotscrewWidgetSettings(state));
 *   // …on image upload (already optimized by image-compress.js):
 *   const url = await store.uploadImage(ctx.botId, optimizedBlob);
 *   bindAutoResize({ targetOrigin: 'https://bots.getskitickets.com' });
 * =============================================================================
 */

/**
 * @param {{ supabaseUrl:string, anonKey:string, token?:string, bucket?:string, table?:string }} opts
 */
export function createAppearanceStore(opts) {
  opts = opts || {};
  var base = String(opts.supabaseUrl || '').replace(/\/+$/, '');
  var anonKey = opts.anonKey || '';
  var token = opts.token || anonKey; // authorized JWT; falls back to anon (RLS still applies)
  var bucket = opts.bucket || 'appearance';
  var table = opts.table || 'bot_appearance';

  if (!base || !anonKey) throw new Error('[appearance-store] supabaseUrl + anonKey are required');

  function headers(extra) {
    var h = { apikey: anonKey, Authorization: 'Bearer ' + token };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  /** Load a bot's saved appearance config. Returns the config object, or null if none yet. */
  async function load(botId) {
    if (!botId) throw new Error('[appearance-store] load: botId required');
    var url = base + '/rest/v1/' + table +
      '?bot_id=eq.' + encodeURIComponent(botId) + '&select=config&limit=1';
    var res = await fetch(url, { headers: headers({ Accept: 'application/json' }) });
    if (!res.ok) throw new Error('[appearance-store] load ' + res.status + ' ' + (await safeText(res)));
    var rows = await res.json();
    return (rows && rows[0] && rows[0].config) || null;
  }

  /** Upsert a bot's appearance config (the whole BotScrew-shaped object). */
  async function save(botId, config) {
    if (!botId) throw new Error('[appearance-store] save: botId required');
    var url = base + '/rest/v1/' + table + '?on_conflict=bot_id';
    var res = await fetch(url, {
      method: 'POST',
      headers: headers({
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      }),
      body: JSON.stringify({ bot_id: botId, config: config })
    });
    if (!res.ok) throw new Error('[appearance-store] save ' + res.status + ' ' + (await safeText(res)));
    return true;
  }

  /**
   * Upload an (already-optimized) image blob to Storage, return its public URL.
   * The dashboard optimizes via image-compress.js first — this just stores the result.
   */
  async function uploadImage(botId, blob, filename) {
    if (!botId) throw new Error('[appearance-store] uploadImage: botId required');
    var name = sanitize(filename || (blob && blob.name) || 'image');
    var path = encodeURIComponent(botId) + '/' + encodeURIComponent(name);
    var res = await fetch(base + '/storage/v1/object/' + bucket + '/' + path, {
      method: 'POST',
      headers: headers({
        'Content-Type': (blob && blob.type) || 'application/octet-stream',
        'x-upsert': 'true'
      }),
      body: blob
    });
    if (!res.ok) throw new Error('[appearance-store] uploadImage ' + res.status + ' ' + (await safeText(res)));
    return base + '/storage/v1/object/public/' + bucket + '/' + path; // public bucket → renderable <img> URL
  }

  return { load: load, save: save, uploadImage: uploadImage };
}

/**
 * Resolve the embed context (botId + token) from the iframe URL or the parent's
 * origin-checked `initialization` postMessage. Mirrors BotScrew's existing widget
 * handshake. Never trusts third-party cookies.
 * @param {{ allowedParentOrigin?:string, timeoutMs?:number }} [o]
 * @returns {Promise<{botId:string, token:string, serverUrl?:string}>}
 */
export function resolveEmbedContext(o) {
  o = o || {};
  return new Promise(function (resolve, reject) {
    // 1) URL params (signed-URL variant)
    var p = new URLSearchParams(location.search);
    if (p.get('botId') && p.get('token')) {
      return resolve({ botId: p.get('botId'), token: p.get('token') });
    }
    // 2) postMessage from the parent admin (origin-checked)
    var done = false;
    function onMsg(e) {
      if (o.allowedParentOrigin && e.origin !== o.allowedParentOrigin) return;
      if (e.data && e.data.type === 'initialization' && e.data.botId) {
        done = true;
        window.removeEventListener('message', onMsg);
        resolve({ botId: String(e.data.botId), token: e.data.token, serverUrl: e.data.serverUrl });
      }
    }
    window.addEventListener('message', onMsg);
    // announce readiness so the parent knows to send init
    try { window.parent.postMessage({ type: 'gsb-appearance-ready' }, o.allowedParentOrigin || '*'); } catch (e) {}
    if (o.timeoutMs) setTimeout(function () {
      if (!done) { window.removeEventListener('message', onMsg); reject(new Error('[appearance-store] embed init timed out')); }
    }, o.timeoutMs);
  });
}

/**
 * Auto-resize the iframe: post the content height to the parent whenever it changes.
 * @param {{ targetOrigin?:string }} [o]
 */
export function bindAutoResize(o) {
  o = o || {};
  var last = 0;
  function post() {
    var h = Math.ceil(document.documentElement.scrollHeight);
    if (h === last) return;
    last = h;
    try { window.parent.postMessage({ type: 'resize', height: h }, o.targetOrigin || '*'); } catch (e) {}
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(post).observe(document.documentElement);
  window.addEventListener('load', post);
  post();
}

/**
 * Walk a BotScrew-shaped config and replace every embedded `data:` URL (base64
 * image from an upload) with an uploaded Storage URL, so the saved JSON blob
 * carries lightweight CDN links instead of megabytes of base64. This lets the
 * dashboard keep base64 in `state` while editing (instant preview, identical to
 * standalone) and only pay the upload at Save.
 *
 * - **Generic:** deep-walks the object, so it catches every image field (logo,
 *   background, custom icon, featured images, webcam posters) — including any
 *   added later — with no per-field wiring.
 * - **Deduped:** identical images (e.g. the logo, which appears as both
 *   `imageUrl` and `popupLogoUrl`) upload once.
 * - **Idempotent:** filenames are content-hashed, so re-saving an unchanged
 *   image overwrites the same object (x-upsert) instead of orphaning a new one.
 * - **Non-destructive:** already-public URLs (external webcams, prior uploads)
 *   are left untouched; works on a deep clone.
 *
 * @param {{ uploadImage:(botId:string, blob:Blob, name?:string)=>Promise<string> }} store
 * @param {string} botId
 * @param {object} config  BotScrew-shaped settings
 * @returns {Promise<object>} the config with data: URLs swapped for public URLs
 */
export async function materializeImages(store, botId, config) {
  var clone = JSON.parse(JSON.stringify(config || {}));
  var jobs = {};            // dataUrl -> Promise<publicUrl> (dedup identical images)
  var pending = [];

  function upload(dataUrl) {
    if (jobs[dataUrl]) return jobs[dataUrl];
    var p = dataUrlToBlob(dataUrl).then(function (blob) {
      var ext = mimeToExt(blob.type);
      return store.uploadImage(botId, blob, 'img-' + hash32(dataUrl) + (ext ? '.' + ext : ''));
    });
    jobs[dataUrl] = p;
    return p;
  }

  (function walk(node, parent, key) {
    if (typeof node === 'string') {
      if (node.slice(0, 5) === 'data:') {
        pending.push(upload(node).then(function (url) { parent[key] = url; }));
      }
    } else if (Array.isArray(node)) {
      node.forEach(function (v, i) { walk(v, node, i); });
    } else if (node && typeof node === 'object') {
      for (var k in node) if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], node, k);
    }
  })(clone, null, null);

  await Promise.all(pending);
  return clone;
}

function dataUrlToBlob(dataUrl) { return fetch(dataUrl).then(function (r) { return r.blob(); }); }
function mimeToExt(mime) {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
            'image/gif': 'gif', 'image/svg+xml': 'svg' })[mime] || '';
}
// FNV-1a 32-bit → short stable hex id, for content-addressed (idempotent) filenames.
function hash32(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

function safeText(res) { try { return res.text(); } catch (e) { return Promise.resolve(''); } }
function sanitize(s) { return String(s).replace(/[^\w.\-]+/g, '_').slice(0, 120); }
