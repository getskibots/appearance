/* GetSkiBots — bulletproof logo processing (client-side).
 *
 * Validate ANY file a partner uploads, then hand back a small, valid, transparent
 * logo — or a clear reason why not. Runs entirely in the browser; BotScrew's upload
 * path just receives a clean ≤budget file, nothing to implement on their side.
 *
 *   processLogo(file) → {
 *     ok, dataUrl?, type?, mime?, width?, height?, bytes?, originalBytes?,
 *     warnings?: string[], error?, message?
 *   }
 *
 * Pipeline: sniff real format (magic bytes) → reject unsupported with a specific
 * message → decode-verify (catch corrupt) → optimize keeping alpha (WebP/PNG, never
 * JPEG) under a budget → transparency + sizing warnings.
 */
import { optimizeImage, decodeImage } from './image-compress.js';

const LOGO_OPTS = { maxW: 1024, maxH: 1024, maxBytes: 400 * 1024, preserveAlpha: true };

// Sniff the REAL type from the first bytes — never trust the extension or accept=.
export async function sniffImageType(file) {
  if (file.type === 'image/svg+xml') return 'svg';
  let bytes;
  try { bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer()); }
  catch (e) { return 'unknown'; }
  const hex = Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  const ascii = String.fromCharCode.apply(null, bytes);

  if (hex.indexOf('89504e47') === 0) return 'png';
  if (hex.indexOf('ffd8ff') === 0) return 'jpeg';
  if (hex.indexOf('47494638') === 0) return 'gif';
  if (hex.indexOf('52494646') === 0 && hex.substr(16, 8) === '57454250') return 'webp'; // RIFF…WEBP
  if (hex.indexOf('25504446') === 0) return 'pdf';                                       // %PDF
  if (hex.indexOf('424d') === 0) return 'bmp';                                           // BM
  if (hex.indexOf('49492a00') === 0 || hex.indexOf('4d4d002a') === 0) return 'tiff';
  // ISO-BMFF (HEIC / AVIF): bytes 4–7 = 'ftyp', brand at 8–11.
  if (ascii.substr(4, 4) === 'ftyp') {
    const brand = ascii.substr(8, 4);
    if (brand === 'avif' || brand === 'avis') return 'avif';
    return 'heic'; // heic/heix/hevc/mif1/heif/… — the iPhone default
  }
  const head = ascii.trim().toLowerCase();
  if (head.indexOf('<svg') === 0 || head.indexOf('<?xml') === 0) return 'svg';
  return 'unknown';
}

const REJECT = {
  heic: 'iPhone HEIC images aren’t supported by browsers. Re-export the logo as PNG or SVG.',
  pdf:  'That’s a PDF, not an image. Upload a PNG or SVG.',
  tiff: 'TIFF isn’t supported by browsers. Export the logo as PNG or SVG.',
};

export async function processLogo(file) {
  if (!file || !file.size) return { ok: false, error: 'empty', message: 'That file is empty. Pick a PNG or SVG logo.' };

  const type = await sniffImageType(file);
  if (REJECT[type]) return { ok: false, error: type, message: REJECT[type] };

  // SVG: ideal vector logo — pass through (sanitize is a later step).
  if (type === 'svg') {
    const dataUrl = await fileToDataUrl(file);
    return { ok: true, dataUrl: dataUrl, type: 'svg', mime: 'image/svg+xml', bytes: file.size, originalBytes: file.size, width: null, height: null, warnings: [] };
  }

  // Raster: decode-verify so a corrupt/unsupported file can't become a broken logo.
  let bitmap;
  try { bitmap = await decodeImage(file); }
  catch (e) { return { ok: false, error: 'decode', message: 'Couldn’t read this image — it may be corrupt or an unsupported format. Try a PNG or SVG.' }; }
  const w = bitmap.width || bitmap.naturalWidth || 0;
  const h = bitmap.height || bitmap.naturalHeight || 0;

  const warnings = [];
  if (w && w < 240) warnings.push('Logo is narrower than 240px — it may look soft on retina screens.');
  if (!hasAlpha(bitmap, w, h, type)) warnings.push('No transparent background — this will show a solid box on colored headers. PNG or SVG with transparency sits cleaner.');
  if (w && h && (h / w) > 1.1) warnings.push('This looks like a vertical/tall logo — consider bumping Logo max-height to 60–80px so it isn’t tiny.');
  if (bitmap.close) bitmap.close();

  // Optimize, preserving transparency, under the budget (stays well below BotScrew's 2MB).
  let out;
  try { out = await optimizeImage(file, LOGO_OPTS); }
  catch (e) {
    const dataUrl = await fileToDataUrl(file);
    return { ok: true, dataUrl: dataUrl, type: type, mime: file.type, bytes: file.size, originalBytes: file.size, width: w, height: h, warnings: warnings.concat(['Couldn’t optimize — using the original file.']) };
  }
  return {
    ok: true, dataUrl: out.dataUrl, type: type, mime: out.mime,
    width: out.width, height: out.height, bytes: out.bytes, originalBytes: file.size, warnings: warnings,
  };
}

// Cheap transparency probe — JPEG/BMP never have alpha; others get sampled small.
function hasAlpha(bitmap, w, h, type) {
  if (type === 'jpeg' || type === 'bmp') return false;
  try {
    const s = 48;
    const c = document.createElement('canvas'); c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(bitmap, 0, 0, s, s);
    const data = ctx.getImageData(0, 0, s, s).data;
    for (let i = 3; i < data.length; i += 4) { if (data[i] < 250) return true; }
    return false;
  } catch (e) { return true; } // tainted/unknown → don't nag
}

function fileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
