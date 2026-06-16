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
