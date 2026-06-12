/* GetSkiBots — Google Fonts dynamic loader (shared).
 *
 * The typography picker lets a resort choose ANY Google Font, so we load fonts on
 * demand instead of shipping a fixed set. Used by the dashboard preview now and,
 * later, by the embedded widget loader (it loads whatever family names are saved).
 *
 * Two load modes — the second is what keeps the picker light:
 *   loadFont(family, weights)  → full glyph set, for fonts actually rendered in
 *                                the chat. css2 endpoint, sensible weights.
 *   loadPreview(family)        → a tiny subset (just the glyphs needed to render
 *                                the family's own name + "Aa"), for picker rows.
 *                                Uses the v1 endpoint's `text=` optimization, so
 *                                each preview face is ~2–5KB, not the whole font.
 *
 * Both are idempotent (each family+mode injects at most one <link>).
 */

const CSS2 = 'https://fonts.googleapis.com/css2';
const CSS1 = 'https://fonts.googleapis.com/css';
const DEFAULT_WEIGHTS = [400, 600, 700];
const injected = new Set();

function famParam(family) {
  return family.trim().replace(/\s+/g, '+');
}
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
function inject(id, href) {
  if (injected.has(id) || document.getElementById(id)) { injected.add(id); return; }
  injected.add(id);
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** A CSS font-family stack for `family`, with a generic fallback from the catalog
 *  category code (ss/se/di/hw/mo). Returns null for an empty family. */
export function fontStack(family, category) {
  if (!family) return null;
  const generic =
    category === 'se' ? 'Georgia, serif'
    : category === 'mo' ? 'monospace'
    : category === 'hw' ? 'cursive'
    : category === 'di' ? 'sans-serif'
    : '-apple-system, BlinkMacSystemFont, sans-serif';
  return "'" + family + "', " + generic;
}

/** Load the full face(s). `weights` (from the catalog's `w`) defaults to
 *  [400,600,700]; we request only weights the font has, so a single-weight font
 *  (e.g. Bebas Neue → [400]) can't 400 the whole stylesheet. */
export function loadFont(family, weights) {
  if (!family) return;
  const ws = (weights && weights.length ? weights : DEFAULT_WEIGHTS).slice().sort((a, b) => a - b);
  const href = CSS2 + '?family=' + famParam(family) + ':wght@' + ws.join(';') + '&display=swap';
  inject('gf-full-' + slug(family), href);
}

/** Load a name-only subset for a picker row (cheap, true-to-font preview). */
export function loadPreview(family) {
  if (!family) return;
  const text = encodeURIComponent('Aa ' + family);
  const href = CSS1 + '?family=' + famParam(family) + '&text=' + text + '&display=swap';
  inject('gf-prev-' + slug(family), href);
}
