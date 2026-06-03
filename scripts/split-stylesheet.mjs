/**
 * One-shot, auditable splitter for the dashboard's inline <style> block.
 *
 * The original index.html carries ~4,700 lines of CSS inline. This script cuts
 * that block into two files BY EXACT BYTE SLICING (no CSS parsing, no rule
 * rewriting) so the extraction is provably lossless:
 *
 *   src/widget/chat-widget.css   the embeddable chat widget (.gsb-* launcher,
 *                                chat surface, voice mode, snowfall overlay)
 *   src/dashboard/dashboard.css  everything else (admin chrome, form controls,
 *                                preview-canvas/android preview-context,
 *                                .gsb-embed-* search/button feature)
 *
 * The widget CSS is two contiguous spans in the source:
 *   W_A: the real ".gsb-snowfall" overlay block
 *   W_B: "CHAT WIDGET (rendered inside preview canvas)" → just before the
 *        "GREETING POPUP" stub (launcher + chat surface + voice + slide-in pill)
 *
 * index.html's inline <style> is replaced by two <link>s (loaded after the
 * already-extracted tokens.css + reset.css). Cross-concern cascade order is
 * irrelevant because the dashboard (plain classes) and widget (.gsb-*) never
 * style the same element; within each file, original rule order is preserved.
 *
 * Run once from the repo root:  node scripts/split-stylesheet.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const htmlPath = resolve(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

// --- locate the inline <style> block -------------------------------------
// Match the real opening tag (`<style>` on its own line) — NOT the literal
// "<style>" that appears inside the tokens/reset comment a few lines above.
const styleOpen = html.indexOf('<style>\n');
const innerStart = styleOpen + '<style>'.length;
const styleClose = html.indexOf('</style>', innerStart);
if (styleOpen === -1 || styleClose === -1) throw new Error('no <style> block found');
const cssBody = html.slice(innerStart, styleClose);

// --- find split points ----------------------------------------------------
// Banner markers: split at the start of the "/* ===" banner that introduces
// the region, so the explanatory banner travels with its section.
function bannerStart(marker) {
  const i = cssBody.indexOf(marker);
  if (i === -1) throw new Error('marker not found: ' + marker);
  const b = cssBody.lastIndexOf('/*', i);
  if (b === -1) throw new Error('banner open not found for: ' + marker);
  return b;
}
const waStart = bannerStart('SNOWFALL OVERLAY — applied to the chat surface');
// D2 begins at the first bare ".toggle-row {" (not ".toggle-row--locked").
const toggleAt = cssBody.indexOf('\n.toggle-row {');
if (toggleAt === -1) throw new Error('.toggle-row { not found');
const toggleStart = toggleAt + 1; // keep the newline with W_A's tail
const wbStart = bannerStart('CHAT WIDGET (rendered inside preview canvas)');
const d3Start = bannerStart('GREETING POPUP (existing — preserved)');

// sanity: expected source order
const order = [waStart, toggleStart, wbStart, d3Start];
for (let i = 1; i < order.length; i++) {
  if (order[i] <= order[i - 1]) throw new Error('split points out of order: ' + order.join(','));
}

// --- carve the five contiguous slices ------------------------------------
const D1  = cssBody.slice(0, waStart);
const W_A = cssBody.slice(waStart, toggleStart);
const D2  = cssBody.slice(toggleStart, wbStart);
const W_B = cssBody.slice(wbStart, d3Start);
const D3  = cssBody.slice(d3Start);

// conservation: the five slices must reconstruct the original byte-for-byte
const rebuilt = D1 + W_A + D2 + W_B + D3;
if (rebuilt !== cssBody) throw new Error('CONSERVATION FAILED — slices do not reconstruct the original');

// --- compose output files -------------------------------------------------
const dashHeader =
`/* GetSkiBots — Dashboard (admin appearance UI) styles.
   Extracted verbatim from the original single-file index.html <style>.
   The embeddable chat widget's own styles live in src/widget/chat-widget.css. */
`;
const widgetHeader =
`/* GetSkiBots — Chat widget (embeddable) styles.
   Extracted verbatim from the original single-file index.html <style>.
   Covers the launcher, chat surface, voice mode, and the snowfall overlay.
   Loaded by the dashboard preview and (later) shippable as a standalone bundle. */
`;
const dashboardCss = dashHeader + D1 + D2 + D3;
const widgetCss = widgetHeader + W_A + W_B;

function write(rel, content) {
  const p = resolve(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return content.length;
}
const dashLen = write('src/dashboard/dashboard.css', dashboardCss);
const widgetLen = write('src/widget/chat-widget.css', widgetCss);

// --- rewrite index.html: inline <style> → two <link>s --------------------
const head = html.slice(0, styleOpen);
const tail = html.slice(styleClose + '</style>'.length);
const links =
`<!-- Dashboard chrome + chat-widget styles, extracted from the original inline <style>.
     Loaded after tokens.css/reset.css; cascade order preserved. See scripts/split-stylesheet.mjs. -->
<link rel="stylesheet" href="/src/dashboard/dashboard.css" />
<link rel="stylesheet" href="/src/widget/chat-widget.css" />`;
writeFileSync(htmlPath, head + links + tail);

// --- report ---------------------------------------------------------------
console.log('CONSERVATION: PASS (slices reconstruct original CSS exactly)');
console.log('  original inline CSS : ' + cssBody.length + ' bytes');
console.log('  dashboard.css       : ' + dashLen + ' bytes  (D1+D2+D3)');
console.log('  chat-widget.css     : ' + widgetLen + ' bytes  (W_A+W_B)');
console.log('  widget span W_A     : ' + W_A.length + ' bytes (snowfall overlay)');
console.log('  widget span W_B     : ' + W_B.length + ' bytes (launcher/chat/voice/slidein)');
console.log('index.html: inline <style> replaced with 2 <link>s');
