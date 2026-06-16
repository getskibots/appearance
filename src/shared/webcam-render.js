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

function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Remove any rendered media (single OR gallery) and reset the hero to empty.
export function clearWebcamHero(heroEl) {
  if (!heroEl) return;
  stopWebcamCarousel(heroEl);
  const gal = heroEl.querySelector(':scope > .gsb-cam-gallery');
  if (gal) gal.remove();
  heroEl.removeAttribute('data-gallery');
  heroEl._gsbGallerySig = null;
  heroEl.removeAttribute('data-cam-url');
  clearMedia(heroEl);
  const f = heroEl.querySelector('.gsb-webcam-fallback');
  if (f) { f.style.display = ''; f.style.cssText = ''; f.innerHTML = ''; }
}

// Stop a running rotation + clean up its window listeners/timers.
export function stopWebcamCarousel(heroEl) {
  if (!heroEl) return;
  if (heroEl._gsbCamTimer) { clearInterval(heroEl._gsbCamTimer); heroEl._gsbCamTimer = null; }
  const st = heroEl._gsbGalleryState;
  if (st) {
    if (st.pauseTimer) clearTimeout(st.pauseTimer);
    if (st.cleanup) st.cleanup();
    heroEl._gsbGalleryState = null;
  }
}

// Multi-cam hero carousel — slide track, dots, swipe/drag, 6s auto-rotate with a 15s
// manual-pause, and a per-slide caption (title · sub · "Updated just now") + LIVE pill
// and type badge. A URL/label signature avoids rebuilding on unrelated re-renders.
export function renderWebcamCarousel(heroEl, webcams, onLabel) {
  if (!heroEl) return;
  const cams = (webcams || []).filter((c) => c && c.url && String(c.url).trim());
  const sig = cams.map((c) => [c.url, c.kind || '', c.label || '', c.sub || ''].join('|')).join('::');
  if (heroEl._gsbGallerySig === sig && heroEl.querySelector(':scope > .gsb-cam-gallery')) return;
  heroEl._gsbGallerySig = sig;
  stopWebcamCarousel(heroEl);
  const old = heroEl.querySelector(':scope > .gsb-cam-gallery');
  if (old) old.remove();
  if (!cams.length) { clearWebcamHero(heroEl); if (onLabel) onLabel(''); return; }
  heroEl.setAttribute('data-gallery', 'true');
  heroEl.removeAttribute('data-cam-url');

  const gallery = document.createElement('div');
  gallery.className = 'gsb-cam-gallery';
  const track = document.createElement('div');
  track.className = 'gsb-cam-track';
  cams.forEach((cam) => {
    const kind = cam.kind || detectWebcamKind(cam.url);
    const slide = document.createElement('div');
    slide.className = 'gsb-cam-slide';
    slide.innerHTML =
      '<div class="gsb-cam-media"></div>' +
      '<div class="gsb-cam-live">LIVE</div>' +
      '<div class="gsb-cam-typebadge">' + escHtml(webcamKindMeta(kind).label) + '</div>' +
      ((cam.label || cam.sub)
        ? '<div class="gsb-cam-caption"><span class="gsb-cam-caption__title">' + escHtml(cam.label || 'Webcam') +
            (cam.sub ? '<span class="gsb-cam-caption__sub">' + escHtml(cam.sub) + '</span>' : '') +
          '</span><span class="gsb-cam-caption__updated">Updated just now</span></div>'
        : '');
    track.appendChild(slide);
    renderWebcamHero(slide.querySelector('.gsb-cam-media'), cam);
  });
  gallery.appendChild(track);

  let dotsEl = null, prevArrow = null, nextArrow = null;
  if (cams.length > 1) {
    dotsEl = document.createElement('div');
    dotsEl.className = 'gsb-cam-dots';
    cams.forEach((_, idx) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'gsb-cam-dot' + (idx === 0 ? ' is-active' : '');
      d.setAttribute('data-i', String(idx));
      dotsEl.appendChild(d);
    });
    gallery.appendChild(dotsEl);
    prevArrow = document.createElement('button');
    prevArrow.type = 'button';
    prevArrow.className = 'gsb-cam-arrow gsb-cam-arrow--prev';
    prevArrow.setAttribute('aria-label', 'Previous webcam');
    prevArrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
    nextArrow = document.createElement('button');
    nextArrow.type = 'button';
    nextArrow.className = 'gsb-cam-arrow gsb-cam-arrow--next';
    nextArrow.setAttribute('aria-label', 'Next webcam');
    nextArrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    gallery.appendChild(prevArrow);
    gallery.appendChild(nextArrow);
  }
  heroEl.insertBefore(gallery, heroEl.firstChild);
  if (onLabel) onLabel(cams[0].label || '');

  const st = { index: 0, n: cams.length, interacting: false, pauseTimer: null, cleanup: null };
  heroEl._gsbGalleryState = st;
  const setPos = (idx, animate) => {
    track.style.transition = animate ? '' : 'none';
    track.style.transform = 'translateX(' + (-idx * 100) + '%)';
    if (!animate) { void track.offsetHeight; track.style.transition = ''; }
    if (dotsEl) dotsEl.querySelectorAll('.gsb-cam-dot').forEach((d, i) => d.classList.toggle('is-active', i === idx));
    if (onLabel) onLabel(cams[idx].label || '');
  };
  const go = (idx) => { st.index = ((idx % st.n) + st.n) % st.n; setPos(st.index, true); };
  const pauseThenResume = () => {
    st.interacting = true;
    if (st.pauseTimer) clearTimeout(st.pauseTimer);
    st.pauseTimer = setTimeout(() => { st.interacting = false; st.pauseTimer = null; }, 15000);
  };
  setPos(0, false);

  if (st.n > 1) {
    heroEl._gsbCamTimer = setInterval(() => { if (!st.interacting) go(st.index + 1); }, 6000);
    dotsEl.querySelectorAll('.gsb-cam-dot').forEach((d) => {
      d.addEventListener('click', (e) => { e.stopPropagation(); go(parseInt(d.getAttribute('data-i'), 10)); pauseThenResume(); });
    });
    prevArrow.addEventListener('click', (e) => { e.stopPropagation(); go(st.index - 1); pauseThenResume(); });
    nextArrow.addEventListener('click', (e) => { e.stopPropagation(); go(st.index + 1); pauseThenResume(); });
    gallery.addEventListener('mouseenter', () => { st.interacting = true; });
    gallery.addEventListener('mouseleave', () => { if (!st.pauseTimer) st.interacting = false; });
    // Swipe is TOUCH ONLY — desktop users get the hover arrows + dots (mouse-drag felt awkward).
    let startX = null, dx = 0, dragging = false;
    const onStart = (e) => { const p = e.touches[0]; startX = p.clientX; dx = 0; dragging = true; track.style.transition = 'none'; pauseThenResume(); };
    const onMove = (e) => { if (!dragging || startX === null) return; const p = e.touches[0]; dx = p.clientX - startX; track.style.transform = 'translateX(' + (-st.index * 100 + (dx / gallery.offsetWidth) * 100) + '%)'; };
    const onEnd = () => { if (!dragging) return; dragging = false; track.style.transition = ''; const th = gallery.offsetWidth * 0.18; if (dx < -th) go(st.index + 1); else if (dx > th) go(st.index - 1); else go(st.index); startX = null; dx = 0; };
    gallery.addEventListener('touchstart', onStart, { passive: true });
    gallery.addEventListener('touchmove', onMove, { passive: true });
    gallery.addEventListener('touchend', onEnd);
  }
}

export function renderWebcamHero(heroEl, cam) {
  if (!heroEl || !cam) return;
  // If a multi-cam gallery is active on this element, tear it down for the single render.
  const gal = heroEl.querySelector(':scope > .gsb-cam-gallery');
  if (gal) { stopWebcamCarousel(heroEl); gal.remove(); heroEl.removeAttribute('data-gallery'); heroEl._gsbGallerySig = null; heroEl.removeAttribute('data-cam-url'); }
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
