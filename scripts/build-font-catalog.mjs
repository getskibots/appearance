/* Build the Typography picker's font catalog from Google Fonts' public metadata.
 *
 *   node scripts/build-font-catalog.mjs
 *
 * Emits src/shared/fonts/google-fonts.json — a lean list the dashboard ships and
 * searches. Each entry: { f: family, c: category code, w?: weights }.
 *   - Latin-subset families only (relevant for English resort chats).
 *   - Sorted by Google popularity (most popular first → best default ordering).
 *   - c: ss=Sans Serif · se=Serif · di=Display · hw=Handwriting · mo=Monospace.
 *   - w: present subset of [400,600,700], ONLY when it isn't the full set (so most
 *     entries stay {f,c}). The loader defaults to [400,600,700] when w is absent;
 *     when present it requests exactly those (covers single-weight fonts like
 *     Bebas Neue → w:[400], so a 700 request can't 400 the whole stylesheet).
 *
 * No API key, no runtime dependency — the JSON is committed and served statically.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SRC = 'https://fonts.google.com/metadata/fonts';
const OUT = 'src/shared/fonts/google-fonts.json';
const CAT = { 'Sans Serif': 'ss', 'Serif': 'se', 'Display': 'di', 'Handwriting': 'hw', 'Monospace': 'mo' };

const res = await fetch(SRC);
if (!res.ok) throw new Error(`Google Fonts metadata returned ${res.status}`);
const data = await res.json();

const families = (data.familyMetadataList || [])
  .filter((x) => (x.subsets || []).includes('latin'))
  .sort((a, b) => (a.popularity || 99999) - (b.popularity || 99999));

const out = families.map((x) => {
  const keys = Object.keys(x.fonts || {});
  const present = [400, 600, 700].filter((w) => keys.includes(String(w)));
  const entry = { f: x.family, c: CAT[x.category] || 'ss' };
  if (present.length !== 3) {
    // Guarantee at least one weight: prefer the [400,600,700] subset, else the
    // lightest available numeric weight (some display fonts ship a single weight).
    let w = present;
    if (!w.length) {
      const nums = keys.map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
      w = nums.length ? [nums[0]] : [400];
    }
    entry.w = w;
  }
  return entry;
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`wrote ${out.length} families → ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
