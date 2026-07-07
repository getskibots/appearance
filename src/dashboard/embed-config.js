/* GetSkiBots — embed/store configuration.
 *
 * Fill these in when the Supabase project + BotScrew iframe handshake are ready.
 * SAFE TO COMMIT: `supabaseUrl` and `anonKey` are *publishable* by design — RLS is
 * what protects the data (see the bot_appearance policies in appearance-store.js).
 * Do NOT put the Supabase service-role key or any secret here.
 *
 * While these are empty, embed mode still runs (auto-resize + botId handshake) but
 * performs NO remote persistence — so nothing breaks before the backend exists.
 */
export var GSB_STORE_CONFIG = {
  supabaseUrl: '',            // e.g. 'https://xxxxxxxx.supabase.co'  ← fill when API is live
  anonKey: '',                // Supabase anon/public key            ← fill when API is live
  allowedParentOrigin: 'https://bots.getskitickets.com' // BotScrew admin origin (postMessage guard)
};
