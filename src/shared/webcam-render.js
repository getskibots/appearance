/* GetSkiBots — render a webcam into the chat hero by whatever means works.
 *
 * One entry point, renderWebcamHero(heroEl, cam), picks the right element for the
 * cam's kind so partners just paste a URL and it renders:
 *   <img>            still / mjpeg / snapshot
 *   <iframe>         youtube · vimeo · roundshot · panomax · feratel · windy · …
 *   <video>+hls.js   .m3u8 (hls.js loaded on demand; native in Safari)
 *   <video>          .mp4
 *   poster + Open ↗  dash / un-embeddable
 *   notice           rtsp / rtmp (un-playable in-browser)
 *
 * Shared by the dashboard preview and (later) the embedded widget.
 */
import { detectWebcamKind, webcamRender, embedUrl, webcamKindMeta } from './webcam.js';

const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1';
let hlsPromise = null;
function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsPromise) return hlsPromise;
  hlsPromise = new Promise(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = HLS_CDN;
    s.onload = function () { resolve(window.Hls); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return hlsPromise;
}

const MEDIA_SEL = ['.gsb-webcam-img', '.gsb-webcam-iframe', '.gsb-webcam-video', '.gsb-webcam-popout'];
function clearMedia(heroEl) {
  MEDIA_SEL.forEach(function (sel) { const el = heroEl.querySelector(sel); if (el) el.remove(); });
}
function hideFallback(heroEl) { const f = heroEl.querySelector('.gsb-webcam-fallback'); if (f) f.style.display = 'none'; }

function showFallback(heroEl, cam, kind, blocked) {
  clearMedia(heroEl);
  let f = heroEl.querySelector('.gsb-webcam-fallback');
  if (!f) { f = document.createElement('div'); f.className = 'gsb-webcam-fallback'; heroEl.insertBefore(f, heroEl.firstChild); }
  f.style.display = '';
  f.style.cssText = cam.poster
    ? "background-image:linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.6)),url('" + cam.poster + "');background-size:cover;background-position:center;"
    : '';
  const meta = webcamKindMeta(kind);
  f.innerHTML = '<span class="gsb-webcam-fallback__kind">' + meta.label + '</span>' +
    (blocked
      ? '<span class="gsb-webcam-fallback__note">Live video isn’t supported in-browser yet</span>'
      : '<a class="gsb-webcam-fallback__open" href="' + (cam.url || '#') + '" target="_blank" rel="noopener">Open live cam ↗</a>');
}

function makeVideo() {
  const v = document.createElement('video');
  v.className = 'gsb-webcam-video';
  v.autoplay = true; v.muted = true; v.loop = true; v.controls = false;
  v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  return v;
}
// Small pop-out link — a safety net so embeds that get blocked by a provider's
// framing policy are still reachable.
function addPopout(heroEl, url) {
  const a = document.createElement('a');
  a.className = 'gsb-webcam-popout';
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  a.setAttribute('aria-label', 'Open live cam in a new tab');
  a.textContent = '↗';
  heroEl.appendChild(a);
}

// Remove any rendered media and reset the hero to an empty state.
export function clearWebcamHero(heroEl) {
  if (!heroEl) return;
  stopWebcamCarousel(heroEl);
  heroEl.removeAttribute('data-cam-url');
  clearMedia(heroEl);
  const f = heroEl.querySelector('.gsb-webcam-fallback');
  if (f) { f.style.display = ''; f.style.cssText = ''; f.innerHTML = ''; }
}

// Stop a running multi-cam rotation (call before rendering a single image / clearing).
export function stopWebcamCarousel(heroEl) {
  if (heroEl && heroEl._gsbCamTimer) { clearInterval(heroEl._gsbCamTimer); heroEl._gsbCamTimer = null; }
}

// Rotating multi-cam hero: shows webcams[0]; with 2+, auto-advances every 6s. Reuses
// the single-cam renderer (auto-detect + per-kind render) for each slide.
export function renderWebcamCarousel(heroEl, webcams, onLabel) {
  if (!heroEl) return;
  stopWebcamCarousel(heroEl);
  const cams = (webcams || []).filter((c) => c && c.url && String(c.url).trim());
  if (!cams.length) { clearWebcamHero(heroEl); if (onLabel) onLabel(''); return; }
  let i = 0;
  const show = (idx) => { renderWebcamHero(heroEl, cams[idx]); if (onLabel) onLabel(cams[idx].label || ''); };
  show(0);
  if (cams.length > 1) {
    heroEl._gsbCamTimer = setInterval(() => { i = (i + 1) % cams.length; show(i); }, 6000);
  }
}

export function renderWebcamHero(heroEl, cam) {
  if (!heroEl || !cam) return;
  const url = (cam.url || '').trim();
  if (!url) return; // blank → leave the live-conditions feed to populate
  // Already showing this exact cam → no-op (prevents iframe reloads / image flash when
  // the hero re-renders on unrelated config edits, and on each carousel re-apply).
  if (heroEl.getAttribute('data-cam-url') === url) return;
  heroEl.setAttribute('data-cam-url', url);
  const kind = cam.kind || detectWebcamKind(url);
  const mode = webcamRender(kind);

  if (mode === 'image' || mode === 'attempt') {
    clearMedia(heroEl); hideFallback(heroEl);
    const img = document.createElement('img');
    img.className = 'gsb-webcam-img'; img.alt = '';
    if (mode === 'attempt') img.onerror = function () { showFallback(heroEl, cam, kind, false); };
    img.src = url;
    heroEl.insertBefore(img, heroEl.firstChild);
  } else if (mode === 'iframe') {
    const src = embedUrl(url, kind);
    if (!src) { showFallback(heroEl, cam, kind, false); return; }
    clearMedia(heroEl); hideFallback(heroEl);
    const ifr = document.createElement('iframe');
    ifr.className = 'gsb-webcam-iframe';
    ifr.src = src;
    ifr.setAttribute('frameborder', '0');
    ifr.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
    ifr.setAttribute('allowfullscreen', '');
    ifr.loading = 'lazy';
    heroEl.insertBefore(ifr, heroEl.firstChild);
    addPopout(heroEl, url);
  } else if (mode === 'video') {
    clearMedia(heroEl); hideFallback(heroEl);
    const v = makeVideo(); v.src = url;
    heroEl.insertBefore(v, heroEl.firstChild);
  } else if (mode === 'hls') {
    clearMedia(heroEl); hideFallback(heroEl);
    const v = makeVideo();
    heroEl.insertBefore(v, heroEl.firstChild);
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url; // Safari plays HLS natively
    } else {
      loadHls().then(function (Hls) {
        if (Hls && Hls.isSupported()) { const h = new Hls(); h.loadSource(url); h.attachMedia(v); }
        else { showFallback(heroEl, cam, kind, false); }
      }).catch(function () { showFallback(heroEl, cam, kind, false); });
    }
  } else if (mode === 'blocked') {
    showFallback(heroEl, cam, kind, true);
  } else {
    showFallback(heroEl, cam, kind, false);
  }
}
