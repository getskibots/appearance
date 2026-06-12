/* GetSkiBots — Webcam URL classification (shared).
 *
 * Ski resorts deliver webcams a dozen different ways. This module tags any URL
 * with a `kind` so the payload can capture every cam now and render more of them
 * over time — adding a renderer later never changes the stored shape.
 *
 * Principle: LOAD-AS-IMAGE-FIRST, then classify. Anything that loads in an <img>
 * (a .jpg, an extension-less snapshot endpoint, OR an MJPEG stream) renders live
 * in v1 for free; only when that can't work do we fall back / defer.
 *
 *   detectWebcamKind(url) → kind
 *   webcamRender(kind)    → 'image' | 'attempt' | 'embed' | 'blocked'
 *   webcamKindMeta(kind)  → { label, status, note }   (dashboard badge)
 *   webcamPoster(url,kind)→ best-effort still/thumbnail (e.g. YouTube)
 */

// Host substring → kind. Checked before extensions so providers win.
const HOST_KINDS = [
  [/youtube\.com|youtu\.be/, 'youtube'],
  [/vimeo\.com/, 'vimeo'],
  [/roundshot/, 'roundshot'],
  [/panomax/, 'panomax'],
  [/feratel/, 'feratel'],
  [/bergfex/, 'bergfex'],
  [/earthcam/, 'earthcam'],
  [/hdontap/, 'hdontap'],
  [/windy\.com/, 'windy'],
  [/brownrice/, 'brownrice'],
];

export function detectWebcamKind(url) {
  if (!url || !url.trim()) return 'image';
  const u = url.trim();
  const lower = u.toLowerCase();
  // Raw streams a browser can't play at all.
  if (/^rtsp:/.test(lower)) return 'rtsp';
  if (/^rtmps?:/.test(lower)) return 'rtmp';
  let host = '';
  try { host = new URL(u).hostname.toLowerCase(); } catch (e) { host = lower; }
  for (let i = 0; i < HOST_KINDS.length; i++) {
    if (HOST_KINDS[i][0].test(host)) return HOST_KINDS[i][1];
  }
  // Stream containers.
  if (/\.m3u8(\?|#|$)/.test(lower)) return 'hls';
  if (/\.mpd(\?|#|$)/.test(lower)) return 'dash';
  if (/\.mp4(\?|#|$)/.test(lower)) return 'mp4';
  // Renderable-in-<img> kinds.
  if (/mjpe?g/.test(lower)) return 'mjpeg';
  if (/\.(jpe?g|png|webp|gif)(\?|#|$)/.test(lower)) return 'image';
  // No signal — could be an extension-less snapshot endpoint; we'll attempt it.
  return 'unknown';
}

// How the widget should treat a kind.
export function webcamRender(kind) {
  if (kind === 'image' || kind === 'mjpeg') return 'image';   // renders in <img>
  if (kind === 'unknown') return 'attempt';                   // try <img>, fall back on error
  if (kind === 'rtsp' || kind === 'rtmp') return 'blocked';   // browser can't play it
  return 'embed';                                             // captured, deferred renderer
}

const KIND_LABEL = {
  image: 'Still image', mjpeg: 'MJPEG stream', unknown: 'Unrecognized URL',
  hls: 'HLS stream', dash: 'DASH stream', mp4: 'MP4 video',
  youtube: 'YouTube live', vimeo: 'Vimeo', roundshot: 'Roundshot 360°',
  panomax: 'Panomax 360°', feratel: 'Feratel', bergfex: 'bergfex',
  earthcam: 'EarthCam', hdontap: 'HDOnTap', windy: 'Windy.com', brownrice: 'Embedded cam',
  rtsp: 'RTSP stream', rtmp: 'RTMP stream',
};

// Dashboard badge: a label + a status the UI colors + an honest note.
export function webcamKindMeta(kind) {
  const render = webcamRender(kind);
  const label = KIND_LABEL[kind] || 'Webcam';
  if (render === 'image') return { label, status: 'live', note: 'Renders live in the chat.' };
  if (render === 'attempt') return { label, status: 'try', note: 'We’ll try to render it as an image; if it can’t, the cam still opens in a new tab.' };
  if (render === 'blocked') return { label, status: 'blocked', note: 'Browsers can’t play this stream — transcode it to HLS to render. The URL is saved.' };
  return { label, status: 'later', note: 'Captured — live rendering arrives in a later release. The URL is saved and guests can open it.' };
}

// Best-effort poster so even un-rendered cams show something.
export function webcamPoster(url, kind) {
  if (kind === 'youtube') {
    const id = youTubeId(url);
    if (id) return 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
  }
  return '';
}

function youTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.indexOf('youtu.be') !== -1) return u.pathname.slice(1);
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(embed|live|shorts)\/([\w-]+)/);
    if (m) return m[2];
  } catch (e) { /* ignore */ }
  return '';
}
