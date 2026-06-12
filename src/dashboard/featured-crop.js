/* GetSkiBots — featured-image crop & reposition (16:9).
 *
 * Turns the card's live preview into a crop surface: drag the image to reposition,
 * a slider to zoom. The visible 16:9 region bakes into an optimized image via the
 * Canvas optimizer (resize + compress), so the partner frames it AND it ships small.
 *
 *   startFeaturedCrop({ previewEl, sliderEl, file, onBake }) → { destroy, rebake }
 *     onBake(result, originalBytes) fires (debounced) with the optimized crop.
 */
import { decodeImage, optimizeCrop } from '../shared/image-compress.js';

const OUT = { w: 1600, h: 900 }; // 16:9 output frame

export async function startFeaturedCrop(opts) {
  const previewEl = opts.previewEl;
  const sliderEl = opts.sliderEl;
  const file = opts.file;
  const onBake = opts.onBake;

  const src = await decodeImage(file);
  const iw = src.width || src.naturalWidth;
  const ih = src.height || src.naturalHeight;

  // Fresh layer (clear any rendered media first).
  previewEl.querySelectorAll('.gsb-webcam-img,.gsb-webcam-iframe,.gsb-webcam-video,.gsb-webcam-popout,.crop-layer').forEach(function (e) { e.remove(); });
  const layer = document.createElement('img');
  layer.className = 'crop-layer';
  layer.draggable = false;
  layer.src = URL.createObjectURL(file);
  layer.style.width = iw + 'px';
  layer.style.height = ih + 'px';
  previewEl.insertBefore(layer, previewEl.firstChild);
  previewEl.setAttribute('data-empty', 'false');
  previewEl.classList.add('is-cropping');
  const controls = sliderEl ? sliderEl.parentElement : null;
  if (controls) controls.style.display = '';

  let zoom = 1, tx = 0, ty = 0;
  function pv() { const r = previewEl.getBoundingClientRect(); return { w: r.width, h: r.height }; }
  function baseScale() { const p = pv(); return p.w && p.h ? Math.max(p.w / iw, p.h / ih) : 1; }
  function scale() { return baseScale() * zoom; }
  function clampOffsets() {
    const p = pv(), s = scale();
    tx = Math.min(0, Math.max(p.w - iw * s, tx));
    ty = Math.min(0, Math.max(p.h - ih * s, ty));
  }
  function center() { const p = pv(), s = scale(); tx = (p.w - iw * s) / 2; ty = (p.h - ih * s) / 2; }
  function apply() { layer.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale() + ')'; }

  center(); apply();

  // Drag to reposition.
  let dragging = false, lx = 0, ly = 0;
  function onDown(e) { dragging = true; lx = e.clientX; ly = e.clientY; try { previewEl.setPointerCapture(e.pointerId); } catch (x) {} }
  function onMove(e) { if (!dragging) return; tx += e.clientX - lx; ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; clampOffsets(); apply(); }
  function onUp() { if (!dragging) return; dragging = false; bakeSoon(); }
  previewEl.addEventListener('pointerdown', onDown);
  previewEl.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  // Zoom (keeps the preview centre stable).
  function onZoom() {
    const p = pv(), sOld = scale();
    const cx = (p.w / 2 - tx) / sOld, cy = (p.h / 2 - ty) / sOld;
    zoom = parseFloat(sliderEl.value) || 1;
    const sNew = scale();
    tx = p.w / 2 - cx * sNew; ty = p.h / 2 - cy * sNew;
    clampOffsets(); apply();
  }
  if (sliderEl) {
    sliderEl.min = '1'; sliderEl.max = '3'; sliderEl.step = '0.01'; sliderEl.value = '1';
    sliderEl.addEventListener('input', onZoom);
    sliderEl.addEventListener('change', bakeSoon);
  }

  // Bake the visible 16:9 region into an optimized image (debounced).
  let timer = null;
  function bakeSoon() { clearTimeout(timer); timer = setTimeout(bake, 130); }
  async function bake() {
    const p = pv();
    if (!p.w) return;
    const k = OUT.w / p.w, s = scale();
    const spec = { outW: OUT.w, outH: OUT.h, dx: tx * k, dy: ty * k, dw: iw * s * k, dh: ih * s * k };
    const result = await optimizeCrop(src, spec);
    if (onBake) onBake(result, file.size);
  }
  await bake(); // initial frame

  function destroy() {
    clearTimeout(timer);
    previewEl.removeEventListener('pointerdown', onDown);
    previewEl.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (sliderEl) { sliderEl.removeEventListener('input', onZoom); sliderEl.removeEventListener('change', bakeSoon); }
    previewEl.classList.remove('is-cropping');
    const l = previewEl.querySelector('.crop-layer'); if (l) l.remove();
    if (controls) controls.style.display = 'none';
    if (src.close) src.close();
  }

  return { destroy: destroy, rebake: bakeSoon };
}
