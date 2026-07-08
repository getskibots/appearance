/* GetSkiBots — embed/store configuration.
 *
 * Fill these when the omni-odin appearance service + BotScrew iframe handshake
 * are ready. While `apiBase` is empty, embed mode still runs (auto-resize +
 * botId handshake) but performs NO remote persistence — nothing breaks before
 * the backend exists.
 *
 * SAFE TO COMMIT: `apiBase`, `allowedParentOrigin`, `supabaseUrl`, and `anonKey`
 * are all publishable. Do NOT put the Supabase service-role key or the
 * APPEARANCE_EMBED_SECRET here — the secret lives only in the endpoint's server
 * env; the browser gets a short-lived per-bot token via the parent handshake.
 */
export var GSB_STORE_CONFIG = {
  // omni-odin origin that hosts /api/appearance (config load/save).
  apiBase: '',                 // e.g. 'https://omni-odin.vercel.app'  ← fill at go-live
  // Embed token for the authed PUT. Prod: a per-bot JWT arrives via the parent
  // postMessage handshake (ctx.token) and takes precedence over this. Dev: set
  // this to the endpoint's APPEARANCE_EMBED_SECRET to test writes locally.
  embedToken: '',
  allowedParentOrigin: 'https://bots.getskitickets.com', // BotScrew admin origin (postMessage guard)

  // OPTIONAL — direct Supabase Storage for image uploads, so base64 images are
  // pushed out of the config on Save. Until this is set (or an image endpoint
  // lands), images stay inline in the config and it still saves fine.
  supabaseUrl: '',             // e.g. 'https://onvwopfsfhxayjkcveyz.supabase.co'
  anonKey: '',                 // Supabase anon/public key (publishable)
};
