/* GetSkiBots — Typography font picker (dashboard).
 *
 * A searchable Google Fonts chooser. Opens to a curated "Popular for resorts"
 * shortlist (the 80%); typing searches the full catalog. Each row renders in its
 * own typeface (cheap name-only subset via font-loader.loadPreview), so you see a
 * font before you pick it.
 *
 * Inline-expanding (not a floating popover) on purpose: the accordion card uses
 * overflow:hidden for its rounded corners, which would clip a popover. An inline
 * panel stays in flow, never clips, and reads clearly.
 *
 * createFontPicker({ root, kind, catalog, curated, getValue, onSelect }) → api
 *   root      : container element to render into
 *   kind      : 'body' | 'display' (labels only)
 *   catalog   : [{ f, c, w? }, …] popularity-sorted (google-fonts.json)
 *   curated   : [family, …] the shortlist for this kind
 *   getValue  : () => current family string
 *   onSelect  : (family) => void   (caller updates state + re-renders)
 *   api.sync(): refresh the trigger label/face from getValue() (e.g. after a preset)
 */
import { loadPreview, fontStack } from '../shared/fonts/font-loader.js';

const TAG = { ss: 'Sans', se: 'Serif', di: 'Display', hw: 'Script', mo: 'Mono' };
const MAX_RESULTS = 60;

export function createFontPicker(opts) {
  const { root, kind, catalog, curated, getValue, onSelect } = opts;
  const byName = new Map(catalog.map((e) => [e.f, e]));
  const curatedEntries = curated.map((f) => byName.get(f)).filter(Boolean);

  root.classList.add('fontpick');
  root.setAttribute('data-open', 'false');
  root.innerHTML =
    '<button type="button" class="fontpick__trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="fontpick__current"></span>' +
      '<svg class="fontpick__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
    '</button>' +
    '<div class="fontpick__panel" role="listbox" aria-label="' + kind + ' font">' +
      '<input type="text" class="fontpick__search" placeholder="Search all Google Fonts…" aria-label="Search Google Fonts" />' +
      '<div class="fontpick__hint" data-role="hint">Popular for resorts</div>' +
      '<div class="fontpick__list" data-role="list"></div>' +
      '<div class="fontpick__foot">Fonts load automatically from Google — nothing to install.</div>' +
    '</div>';

  const trigger = root.querySelector('.fontpick__trigger');
  const current = root.querySelector('.fontpick__current');
  const panel = root.querySelector('.fontpick__panel');
  const search = root.querySelector('.fontpick__search');
  const hint = root.querySelector('[data-role="hint"]');
  const list = root.querySelector('[data-role="list"]');

  function rowHTML(e) {
    const checked = e.f === getValue();
    return (
      '<button type="button" class="fontpick__row" role="option" data-family="' + escapeAttr(e.f) + '"' +
      (checked ? ' data-checked="true" aria-selected="true"' : ' aria-selected="false"') + '>' +
        '<span class="fontpick__name" style="font-family:' + cssFamily(e) + '">' + escapeHtml(e.f) + '</span>' +
        '<span class="fontpick__tag">' + (TAG[e.c] || 'Sans') + '</span>' +
        '<svg class="fontpick__check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
      '</button>'
    );
  }

  function renderList(entries) {
    list.innerHTML = entries.map(rowHTML).join('');
    // Load a true-to-font preview face for each visible row.
    entries.forEach((e) => loadPreview(e.f));
  }

  function showCurated() {
    hint.style.display = '';
    hint.textContent = 'Popular for resorts';
    renderList(curatedEntries);
  }

  function runSearch(q) {
    const needle = q.trim().toLowerCase();
    if (!needle) { showCurated(); return; }
    const hits = [];
    for (let i = 0; i < catalog.length && hits.length < MAX_RESULTS; i++) {
      if (catalog[i].f.toLowerCase().includes(needle)) hits.push(catalog[i]);
    }
    hint.style.display = hits.length ? '' : 'none';
    hint.textContent = hits.length >= MAX_RESULTS ? 'Top ' + MAX_RESULTS + ' matches — keep typing to narrow' : hits.length + ' match' + (hits.length === 1 ? '' : 'es');
    list.innerHTML = hits.length ? '' : '<div class="fontpick__empty">No Google Font matches “' + escapeHtml(q) + '”.</div>';
    if (hits.length) renderList(hits);
  }

  function open() {
    if (root.getAttribute('data-open') === 'true') return;
    closeOthers();
    root.setAttribute('data-open', 'true');
    trigger.setAttribute('aria-expanded', 'true');
    search.value = '';
    showCurated();
    setTimeout(() => search.focus(), 0);
  }
  function close() {
    root.setAttribute('data-open', 'false');
    trigger.setAttribute('aria-expanded', 'false');
  }
  function closeOthers() { /* replaced below once registry is set */ }
  function closeOthersReal() {
    OPEN_PICKERS.forEach((p) => { if (p !== api) p.close(); });
  }

  trigger.addEventListener('click', (ev) => {
    ev.stopPropagation();
    root.getAttribute('data-open') === 'true' ? close() : open();
  });
  search.addEventListener('input', (e) => runSearch(e.target.value));
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); trigger.focus(); } });
  list.addEventListener('click', (ev) => {
    const row = ev.target.closest('.fontpick__row');
    if (!row) return;
    onSelect(row.getAttribute('data-family'));
    sync();
    close();
  });

  function cssFamily(e) {
    return fontStack(e.f, e.c) || "'" + e.f + "', sans-serif";
  }
  function sync() {
    const fam = getValue();
    const e = byName.get(fam);
    current.textContent = fam || '—';
    current.style.fontFamily = e ? cssFamily(e) : '';
    if (fam) loadPreview(fam);
  }

  const api = { open, close, sync, root };
  // wire the registry-aware close now that `api` exists
  closeOthers = closeOthersReal;
  OPEN_PICKERS.push(api);
  sync();
  return api;
}

// Registry so opening one picker closes the others, and an outside click closes all.
const OPEN_PICKERS = [];
if (typeof document !== 'undefined') {
  document.addEventListener('click', (ev) => {
    OPEN_PICKERS.forEach((p) => { if (!p.root.contains(ev.target)) p.close(); });
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
