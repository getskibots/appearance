/* GetSkiBots — dashboard embed integration.
 * =============================================================================
 * When the appearance dashboard is embedded as an iframe in BotScrew's admin,
 * this wires per-bot persistence through omni-odin's /api/appearance service,
 * mirroring BotScrew's model (one config per botId). Standalone/demo mode is
 * untouched — this only runs in embed mode, and does nothing until the
 * `apiBase` in embed-config.js is filled.
 *
 * Flow:
 *   1. Detect embed mode (?embed=1, or ?botId=… inside an iframe).
 *   2. Resolve { botId, token, publicIdentifier } from the URL or the parent's
 *      origin-checked `initialization` postMessage.
 *   3. Auto-resize the iframe (ResizeObserver -> postMessage height).
 *   4. If the service is configured: load THIS bot's saved config -> hydrate the
 *      dashboard, and route "Save changes" -> PUT /api/appearance.
 *   5. On Save, base64 images are (optionally) pushed to Supabase Storage first
 *      so the saved config carries CDN URLs, not megabytes of base64.
 *
 * Config transport = appearance-api.js (the /api/appearance client).
 * Image Storage + the embed handshake helpers = appearance-store.js.
 * =============================================================================
 */
import { resolveEmbedContext, bindAutoResize, createAppearanceStore, materializeImages } from '../shared/appearance-store.js';
import { createAppearanceApi } from './appearance-api.js';
import { GSB_STORE_CONFIG } from './embed-config.js';

/** True when running as the embedded config dashboard (not the standalone demo). */
export function isEmbedMode() {
  var p = new URLSearchParams(location.search);
  if (p.get('embed') === '1') return true;
  // A botId param while framed also counts (BotScrew may pass it via signed URL).
  try { return !!p.get('botId') && window.self !== window.top; } catch (e) { return true; }
}

/**
 * Initialise embed mode.
 * @param {{ applyConfig:(botscrewSettings:object)=>void, getConfig:()=>object, saveBtn?:HTMLElement }} hooks
 */
export async function initEmbed(hooks) {
  var parentOrigin = GSB_STORE_CONFIG.allowedParentOrigin || undefined;

  var ctx;
  try {
    ctx = await resolveEmbedContext({ allowedParentOrigin: parentOrigin, timeoutMs: 8000 });
  } catch (e) {
    console.warn('[gsb-embed] no embed context (' + e.message + ') — skipping remote persistence.');
    return;
  }

  // Keep the parent admin sized to our content regardless of backend state.
  bindAutoResize({ targetOrigin: parentOrigin });

  // No service yet → run inert (handshake + resize only). Nothing breaks pre-API.
  var apiBase = GSB_STORE_CONFIG.apiBase;
  if (!apiBase) {
    console.warn('[gsb-embed] apiBase not configured (src/dashboard/embed-config.js) — ' +
      'handshake + resize active, remote save/load disabled for bot ' + ctx.botId + '.');
    window.__gsbEmbed = { botId: ctx.botId, publicIdentifier: ctx.publicIdentifier, api: null };
    return;
  }

  // Prod: the per-bot token arrives via the handshake (ctx.token). Dev: the
  // shared secret in embed-config. Handshake token wins.
  var token = ctx.token || GSB_STORE_CONFIG.embedToken || '';
  var api = createAppearanceApi({ apiBase: apiBase, token: token });

  // Optional image store (Supabase Storage) — pushes base64 images out of the
  // config on Save. If unconfigured, images stay inline and the config still saves.
  var imageStore = null;
  if (GSB_STORE_CONFIG.supabaseUrl && GSB_STORE_CONFIG.anonKey) {
    imageStore = createAppearanceStore({
      supabaseUrl: GSB_STORE_CONFIG.supabaseUrl,
      anonKey: GSB_STORE_CONFIG.anonKey,
      token: token,
    });
  }

  window.__gsbEmbed = { botId: ctx.botId, publicIdentifier: ctx.publicIdentifier, api: api, imageStore: imageStore };

  // Load this bot's saved appearance and hydrate the dashboard.
  try {
    var loaded = await api.load(ctx.botId);
    if (loaded && loaded.config && hooks.applyConfig) hooks.applyConfig(loaded.config);
    console.log('[gsb-embed] loaded appearance for bot ' + ctx.botId + (loaded && loaded.config ? '' : ' (no saved config yet)'));
  } catch (e) {
    console.error('[gsb-embed] load failed for bot ' + ctx.botId + ':', e.message);
  }

  // Route "Save changes": (optional) push images to Storage → PUT the config.
  if (hooks.saveBtn && hooks.getConfig) {
    hooks.saveBtn.addEventListener('click', function () {
      var cfg;
      try { cfg = hooks.getConfig(); } catch (e) { console.error('[gsb-embed] getConfig failed:', e.message); return; }
      var prep = imageStore ? materializeImages(imageStore, ctx.botId, cfg) : Promise.resolve(cfg);
      prep
        .then(function (rewritten) { return api.save(ctx.botId, rewritten, ctx.publicIdentifier); })
        .then(function () { console.log('[gsb-embed] saved appearance for bot ' + ctx.botId); })
        .catch(function (e) { console.error('[gsb-embed] save failed for bot ' + ctx.botId + ':', e.message); });
    });
  }
}
