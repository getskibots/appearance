/* GetSkiBots — client-side image optimizer (Canvas, zero deps, no server).
 *
 * Resorts paste 5MB+ phone photos for the featured image. We shrink them IN THE
 * BROWSER before they ever upload: decode → downscale to hero size → re-encode
 * (WebP, JPEG fallback) under a byte budget. What leaves the Appearance tab is
 * already small, so BotScrew's existing upload path needs no changes.
 *
 *   optimizeImage(file, opts?) → { dataUrl, blob, width, height, bytes, mime }
 */

const DEFAULTS = {
  maxW: 1600,             // hero is ~16:9; 1600×900 covers retina
  maxH: 900,
  maxBytes: 250 * 1024,   // hard budget — never ship more than this
  quality: 0.82,
};

export async function optimizeImage(file, opts) {
  const cfg = Object.assign({}, DEFAULTS, opts || {});
  const src = await decode(file);
  const sw = src.width || src.naturalWidth;
  const sh = src.height || src.naturalHeight;

  // Downscale to fit the cap, preserving aspect ratio (never upscale).
  const scale = Math.min(1, cfg.maxW / sw, cfg.maxH / sh);
  let w = Math.max(1, Math.round(sw * scale));
  let h = Math.max(1, Math.round(sh * scale));

  const mime = supportsWebp() ? 'image/webp' : 'image/jpeg';
  let quality = cfg.quality;
  let blob = await encode(src, w, h, mime, quality);

  // Guardrail: ease quality first, then dimensions, until under budget.
  let guard = 0;
  while (blob.size > cfg.maxBytes && guard < 10) {
    if (quality > 0.5) quality = Math.round((quality - 0.1) * 100) / 100;
    else { w = Math.round(w * 0.85); h = Math.round(h * 0.85); }
    blob = await encode(src, w, h, mime, quality);
    guard++;
  }
  if (src.close) src.close();

  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, blob, width: w, height: h, bytes: blob.size, mime };
}

function decode(file) {
  // Respect EXIF orientation so portrait phone photos aren't sideways.
  if (window.createImageBitmap) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () {
      return createImageBitmap(file);
    });
  }
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function encode(src, w, h, mime, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return new Promise(function (resolve) {
    canvas.toBlob(function (b) { resolve(b); }, mime, quality);
  });
}

let _webp;
function supportsWebp() {
  if (_webp === undefined) {
    const c = document.createElement('canvas');
    _webp = !!(c.toDataURL && c.toDataURL('image/webp').indexOf('data:image/webp') === 0);
  }
  return _webp;
}

function blobToDataUrl(blob) {
  return new Promise(function (resolve) {
    const r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.readAsDataURL(blob);
  });
}

export function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}
