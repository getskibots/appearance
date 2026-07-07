/* GetSkiBots — dashboard embed integration.
 * =============================================================================
 * When the appearance dashboard is embedded as an iframe in BotScrew's admin, this
 * wires per-bot persistence via the Supabase appearance store, mirroring BotScrew's
 * model (one config per botId). Standalone/demo mode is untouched — this only runs
 * when embed mode is detected, and does nothing destructive until the Supabase creds
 * in embed-config.js are filled.
 *
 * Flow:
 *   1. Detect embed mode (?embed=1, or ?botId=… inside an iframe).
 *   2. Resolve { botId, token } from the URL or the parent's origin-checked
 *      `initialization` postMessage.
 *   3. Auto-resize the iframe (ResizeObserver -> postMessage height).
 *   4. If Supabase is configured: load THIS bot's saved config -> hydrate the
 *      dashboard, and route "Save changes" -> store.save(botId, config).
 *   5. Expose window.__gsbEmbed = { botId, store } so the image-upload paths can
 *      push assets to Storage instead of embedding base64 (future wiring step).
 * =============================================================================
 */
import { createAppearanceStore, resolveEmbedContext, bindAutoResize } from '../shared/appearance-store.js';
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
 *   applyConfig — hydrate the dashboard from a BotScrew-shaped settings object.
 *   getConfig   — produce the BotScrew-shaped settings object from current state.
 *   saveBtn     — the "Save changes" button to also route to the store.
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

  // No backend yet → run inert (handshake + resize only). Nothing breaks pre-API.
  if (!GSB_STORE_CONFIG.supabaseUrl || !GSB_STORE_CONFIG.anonKey) {
    console.warn('[gsb-embed] Supabase not configured (src/dashboard/embed-config.js) — ' +
      'handshake + resize active, remote save/load disabled for bot ' + ctx.botId + '.');
    window.__gsbEmbed = { botId: ctx.botId, store: null };
    return;
  }

  var store = createAppearanceStore({
    supabaseUrl: GSB_STORE_CONFIG.supabaseUrl,
    anonKey: GSB_STORE_CONFIG.anonKey,
    token: ctx.token
  });
  // Exposed for the image-upload paths (dashboard/featured-crop/logo) to push to
  // Storage instead of base64 — wired in a follow-up once the backend is live.
  window.__gsbEmbed = { botId: ctx.botId, store: store };

  // Load this bot's saved appearance and hydrate the dashboard.
  try {
    var saved = await store.load(ctx.botId);
    if (saved && hooks.applyConfig) hooks.applyConfig(saved);
    console.log('[gsb-embed] loaded appearance for bot ' + ctx.botId + (saved ? '' : ' (no saved config yet)'));
  } catch (e) {
    console.error('[gsb-embed] load failed for bot ' + ctx.botId + ':', e.message);
  }

  // Route "Save changes" to the store (additive — the local Save handler still runs;
  // the localStorage write is just a harmless same-origin cache inside the iframe).
  if (hooks.saveBtn && hooks.getConfig) {
    hooks.saveBtn.addEventListener('click', function () {
      var cfg;
      try { cfg = hooks.getConfig(); } catch (e) { console.error('[gsb-embed] getConfig failed:', e.message); return; }
      store.save(ctx.botId, cfg)
        .then(function () { console.log('[gsb-embed] saved appearance for bot ' + ctx.botId); })
        .catch(function (e) { console.error('[gsb-embed] save failed for bot ' + ctx.botId + ':', e.message); });
    });
  }
}
