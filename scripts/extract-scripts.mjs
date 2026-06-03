/**
 * One-shot, auditable extractor for index.html's inline <script>.
 *
 * The script is two independent top-level IIFEs that talk to each other only
 * through guarded `window.gsbChatPreview` / `window.__gsbSlideCycle` bridges:
 *
 *   IIFE #1  → src/dashboard/dashboard.js      (admin UI: color utils, SnowEngine,
 *                                               DEFAULTS, state, render, control
 *                                               bindings, uploads, sync)
 *   IIFE #2  → src/widget/widget-runtime.js    (chat runtime: JH data fetch,
 *                                               chat open/variant, knowledge base,
 *                                               voice) — interim umbrella, to be
 *                                               decomposed into chat-module.js /
 *                                               knowledge-base.js / data.js /
 *                                               voice.js / snowfall.js next.
 *
 * Pure byte-slicing (no code rewriting). Loaded as two ordered
 * <script type="module"> tags — same execution order as the originals, so the
 * window bridge and its load-order guards behave identically. ES-module scope
 * does not break the bridge because `window` is still the global object.
 *
 * Run once from the repo root:  node scripts/extract-scripts.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const htmlPath = resolve(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

const open = html.indexOf('<script>\n');
const innerStart = open + '<script>'.length;
const close = html.indexOf('</script>', innerStart);
if (open === -1 || close === -1) throw new Error('no <script> block found');
const innerJs = html.slice(innerStart, close);

// Split at the start of the "PRODUCTION-FIDELITY CHAT MODULE" banner that
// introduces IIFE #2 (everything before it is IIFE #1 + its trailing blank).
const bannerIdx = innerJs.indexOf('PRODUCTION-FIDELITY CHAT MODULE');
if (bannerIdx === -1) throw new Error('widget banner marker not found');
const widgetStart = innerJs.lastIndexOf('/*', bannerIdx);
if (widgetStart === -1) throw new Error('widget banner open not found');

const dashboardJs = innerJs.slice(0, widgetStart);
const widgetJs = innerJs.slice(widgetStart);
if (dashboardJs + widgetJs !== innerJs) throw new Error('CONSERVATION FAILED');

const dashHeader =
`/* GetSkiBots — Dashboard (admin appearance UI) logic.
   Extracted verbatim from index.html's inline <script> (IIFE #1).
   Drives the chat preview via the window.gsbChatPreview bridge defined by the
   widget runtime. To be decomposed into color-utils / snowfall / sync modules. */
`;
const widgetHeader =
`/* GetSkiBots — Chat widget runtime (interim umbrella).
   Extracted verbatim from index.html's inline <script> (IIFE #2).
   Exposes window.gsbChatPreview for the dashboard to drive open/close/variant.
   To be decomposed into chat-module / knowledge-base / data / voice modules. */
`;

function write(rel, content) {
  const p = resolve(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return content.length;
}
const a = write('src/dashboard/dashboard.js', dashHeader + dashboardJs);
const b = write('src/widget/widget-runtime.js', widgetHeader + widgetJs);

const head = html.slice(0, open);
const tail = html.slice(close + '</script>'.length);
const tags =
`<!-- App logic, extracted from the original inline <script> (two IIFEs).
     Module scripts execute in order after parse; the window.gsbChatPreview
     bridge between them is preserved. See scripts/extract-scripts.mjs. -->
<script type="module" src="/src/dashboard/dashboard.js"></script>
<script type="module" src="/src/widget/widget-runtime.js"></script>`;
writeFileSync(htmlPath, head + tags + tail);

console.log('CONSERVATION: PASS');
console.log('  inline <script>        : ' + innerJs.length + ' bytes');
console.log('  dashboard.js (IIFE #1) : ' + a + ' bytes');
console.log('  widget-runtime.js (#2) : ' + b + ' bytes');
console.log('index.html: inline <script> replaced with 2 module <script>s');
