/* BotScrew widget API client — exact endpoints reverse-engineered from the live
 * admin bundle (see docs/botscrew-widget-settings.md).
 *
 * MUST run inside BotScrew's authenticated app: every call uses
 * `credentials: "include"` (their session cookie). `baseUrl` is the per-bot API
 * base the bundle injects at runtime (the minified `Zt`). It cannot be exercised
 * from our public demo (no cookie, cross-origin) — this is the code BotScrew wires
 * into the AppearanceTab's `onChange` / `onUploadLogo`.
 */

function asJson(res) {
  if (!res.ok) throw new Error('BotScrew API ' + res.status + ' ' + res.statusText);
  return res.json();
}

/**
 * @param {{ baseUrl: string, botId: string }} cfg
 * @returns API bound to one bot.
 */
export function createBotscrewApi({ baseUrl, botId }) {
  const widgetUrl = baseUrl + '/bot/' + botId + '/widget';
  return {
    /** GET the current widgetSettings. */
    loadWidgetSettings() {
      return fetch(widgetUrl, { credentials: 'include' }).then(asJson);
    },
    /** GET BotScrew's default per-language translations (placeholders, etc.). */
    loadDefaultTranslations() {
      return fetch(widgetUrl + '/default-translations', { credentials: 'include' }).then(asJson);
    },
    /** PATCH the whole widgetSettings object (BotScrew saves the full object). */
    saveWidgetSettings(settings) {
      return fetch(widgetUrl, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }).then(asJson);
    },
    /** POST a logo file (multipart `file`); shared by widget + popup logo. <=2MB. */
    uploadWidgetLogo(file) {
      const fd = new FormData();
      fd.append('file', file);
      return fetch(baseUrl + '/file/widgetLogo', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      }).then(asJson);
    },
  };
}

/** Debounce — BotScrew PATCHes on blur/enter; use this to coalesce live edits. */
export function debounce(fn, ms = 500) {
  let t;
  return function () {
    const args = arguments;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(null, args); }, ms);
  };
}
