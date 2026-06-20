/* Minimal, XSS-safe inline markdown for partner-authored copy (e.g. the Season Update).
 * Turns [label](url) into a link; everything else is HTML-escaped. Only http(s)/mailto
 * URLs become anchors — javascript:, data:, etc. are rendered as literal text, never hrefs.
 */
export function linkifyMarkdown(text) {
  if (text == null) return '';
  var esc = function (s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
  var out = '';
  var re = /\[([^\]]+)\]\(([^)\s]+)\)/g; // [label](url) — url has no spaces or ')'
  var last = 0, m;
  while ((m = re.exec(text)) !== null) {
    out += esc(text.slice(last, m.index));
    var label = m[1], url = m[2];
    if (/^(https?:|mailto:)/i.test(url)) {
      out += '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
    } else {
      out += esc(m[0]); // unsafe / relative scheme → leave the literal markdown text
    }
    last = re.lastIndex;
  }
  out += esc(text.slice(last));
  return out;
}

/* Autolink for runtime/AI message copy, which uses bare URLs (e.g.
 * "book at jacksonhole.com/lessons") rather than markdown. XSS-safe: escapes
 * everything, then turns URL-ish tokens into anchors. Catches full http(s) URLs,
 * www.*, and bare domain.tld(/path). Protocol-less tokens get https://; only
 * http(s) become anchors. Trailing sentence punctuation is left outside the link.
 */
export function autolink(text) {
  if (text == null) return '';
  var esc = function (s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  // optional scheme · optional www · domain(.sub)*.tld · optional /path
  var re = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s)]*)?)/gi;
  var out = '', last = 0, m;
  while ((m = re.exec(text)) !== null) {
    var raw = m[1];
    var core = raw.replace(/[.,;:!?)]+$/, ''); // trailing punctuation isn't part of the URL
    out += esc(text.slice(last, m.index));
    var href = /^https?:\/\//i.test(core) ? core : 'https://' + core;
    out += '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(core) + '</a>'
         + esc(raw.slice(core.length));
    last = m.index + raw.length;
  }
  out += esc(text.slice(last));
  return out;
}
