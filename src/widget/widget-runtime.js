/* GetSkiBots — Chat widget runtime (interim umbrella).
   Extracted verbatim from index.html's inline <script> (IIFE #2).
   Exposes window.gsbChatPreview for the dashboard to drive open/close/variant.
   To be decomposed into chat-module / knowledge-base / data / voice modules. */

// Omni-sourced Jackson Hole knowledge (official resort links + curated guidance).
// Snapshot ported from omni/src/data/parent.ts — see src/widget/knowledge/.
import { JH_KNOWLEDGE, topicLink } from './knowledge/jackson-hole.js';
import { fetchOpenMeteo, conditionIcon } from '../shared/weather/open-meteo.js';
import { analytics } from '../shared/analytics.js';
import { autolink } from '../shared/markdown.js';

/* =========================================================================
   PRODUCTION-FIDELITY CHAT MODULE
   Ported from the GSB chat prototype. Includes: data fetching from Jackson
   Hole APIs (snow/lifts/webcams/parking) with cached fallback, AI keyword
   routing for chat responses, Web Speech API integration (mic dictation,
   voice output, full hands-free voice mode), and the column reorganization
   for Full panel layout. Exposed on window.gsbChatPreview for the dashboard
   to drive open/close/variant switching.
   ========================================================================= */
(function() {
  'use strict';

  var $ = function(id) { return document.getElementById(id); };
  var body = document.body;

  /* ── Analytics session ──────────────────────────────────────────────────
     One session spans all three entry points (one runtime instance per page/
     iframe = naturally unified). conversation_started fires ONCE on the first
     user message; containment = !handedOff at session end. */
  analytics.init({}); // console-first; the resort GA id is wired with the GA transport step
  var session = {
    started: false, turnCount: 0, startTime: 0, openTime: 0,
    handedOff: false, entryPoint: null, webcamViewed: false, ended: false
  };
  // Emitted from ONE place so the "when does a conversation end" trigger is
  // swappable in a single spot. Default trigger: page/tab hidden (below).
  function endConversation() {
    if (!session.started || session.ended) return;
    session.ended = true;
    analytics.track('conversation_ended', {
      turn_count: session.turnCount,
      contained: !session.handedOff,
      duration_seconds: Math.round((Date.now() - session.startTime) / 1000)
    });
  }
  // The containment signal. Dormant in the demo (no handoff path); BotScrew/ODIN
  // calls window.gsbChatPreview.handoffToHuman() when routing to a live agent.
  function handoffToHuman() {
    session.handedOff = true;
    analytics.track('handoff_to_human', { turn_number: session.turnCount });
  }
  // Session-end trigger (swappable): once, when the visit truly ends — tab close,
  // navigation, or mobile backgrounding. (More reliable than pagehide on mobile.)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') endConversation();
  });

  // ============= CACHED FALLBACK DATA =============
  // If CORS blocks the live fetch, we fall back to this snapshot
  // (pulled at the time this demo was built).
  var FALLBACK = {
    snow: {
      respTimestamp: "2026-05-01T00:16:00Z",
      lastSnowFallDate: "2026-04-12",
      snow: {
        detail: "April 13th, 2026—The radical, rollercoaster ski season of 2025/26 has come to an end here in Jackson Hole. The Aerial Tram will reopen for summer sightseeing on May 16th, with the gondolas joining in on June 6th. Finally, more family-friendly fun and adrenalized alpine action return on June 13th with the opening of our bike park, ropes course, via ferrata, and so much more.",
        midMountain: { seasonTotalSnow: { value: "244" }, newSnowLast24H: { value: "0" }, totalSnowDepth: { value: "40" } },
        tramSummit: { seasonTotalSnow: { value: "347" }, newSnowLast24H: { value: "0" }, totalSnowDepth: { value: "74" } }
      },
      weather: {
        midMountain: { temperature: { value: "42" }, wind: { value: "4" } },
        tramSummit: { temperature: { value: "34" }, wind: { value: "2" } },
        base: { temperature: { value: "52" } }
      }
    },
    webcams: {
      webcams: [
        { caption: "Cody Bowl", url: "https://cams.jacksonhole.com/webcam/codybowl.jpg", thumbUrl: "https://cams.jacksonhole.com/webcam/thumbnails/codybowl.jpg" },
        { caption: "Tram Station Cam", url: "https://cams.jacksonhole.com/webcam/trambase.jpg", thumbUrl: "https://cams.jacksonhole.com/webcam/thumbnails/trambase.jpg" },
        { caption: "Village Commons", url: "https://cams.jacksonhole.com/webcam/tetonvillagecommons.jpg", thumbUrl: "https://cams.jacksonhole.com/webcam/thumbnails/tetonvillagecommons.jpg" }
      ]
    },
    parking: {
      totalAvailability: 76,
      parking_lots: [
        { name: "Upper Village", occupied_percentage: 27 },
        { name: "Base Village", occupied_percentage: 0 },
        { name: "Mid Village", occupied_percentage: 8 },
        { name: "Ranch Lot", occupied_percentage: 35 },
        { name: "Stilson", occupied_percentage: 40 }
      ]
    },
    trailLift: {
      liftStatus: { totalLifts: 0, openLifts: 0 },
      trailStatus: { totalTrails: 0, openTrails: 0 }
    }
  };

  // ============= DATA FETCHING =============
  var data = {
    snow: null,
    webcams: null,
    parking: null,
    trailLift: null,
    isLive: false  // true if at least one feed loaded fresh
  };

  function setDataStatus(status, label) {
    var el = $('dataStatus');
    if (el) el.setAttribute('data-status', status);
    var elL = $('dataStatusLabel');
    if (elL) elL.textContent = label;
  }

  function tryFetch(url) {
    return fetch(url, { mode: 'cors' })
      .then(function(r) {
        if (!r.ok) throw new Error('Bad status ' + r.status);
        return r.json();
      });
  }

  function fetchAll() {
    setDataStatus('loading', 'Fetching…');

    var endpoints = {
      snow: 'https://www.jacksonhole.com/api/snow.json',
      webcams: 'https://www.jacksonhole.com/api/web-cams.json',
      parking: 'https://www.jacksonhole.com/api/parking.json',
      trailLift: 'https://www.jacksonhole.com/api/trail-lift.json'
    };

    var promises = Object.keys(endpoints).map(function(key) {
      return tryFetch(endpoints[key])
        .then(function(json) {
          data[key] = json;
          return { key: key, ok: true };
        })
        .catch(function(err) {
          // Use fallback snapshot
          data[key] = FALLBACK[key];
          return { key: key, ok: false, err: err.message };
        });
    });

    return Promise.all(promises).then(function(results) {
      var liveCount = results.filter(function(r) { return r.ok; }).length;
      var totalCount = results.length;
      data.isLive = liveCount > 0;

      if (liveCount === totalCount) {
        setDataStatus('live', 'Live · ' + liveCount + '/' + totalCount);
      } else if (liveCount > 0) {
        setDataStatus('live', 'Live · ' + liveCount + '/' + totalCount);
      } else {
        // All blocked (CORS or otherwise) — use cached fallback
        setDataStatus('cached', 'Cached snapshot');
      }
      renderAllData();
    });
  }

  // ============= LIVE WEATHER (Open-Meteo) =============
  // Resolve resort coordinates, then override data.snow.weather with live
  // Open-Meteo readings. Snow stats keep coming from the resort feed/fallback.
  //
  // Coordinate resolution order:
  //   1. window.gsbWeatherConfig  — injected by the host page / BotScrew config
  //   2. localStorage 'gsb-weather-config-v1' — what the Weather dashboard saves
  //   3. Jackson Hole defaults    — so the launcher never renders empty
  var JH_DEFAULT_COORDS = {
    base:   { lat: 43.5875, lng: -110.8279, elevFt: 6311 },
    summit: { lat: 43.5969, lng: -110.8716, elevFt: 10449 }
  };

  function num(v) { var n = parseFloat(v); return Number.isFinite(n) ? n : null; }

  // Normalize the dashboard's flat field shape ({'base-lat':..,'summit-lng':..})
  // OR a structured { base:{lat,lng,elevFt}, summit:{...} } into the structured form.
  function normalizeCoordConfig(cfg) {
    if (!cfg) return null;
    var v = cfg.values || cfg; // dashboard saves { values, savedAt }
    var baseLat = num(v.base && v.base.lat != null ? v.base.lat : v['base-lat']);
    var baseLng = num(v.base && v.base.lng != null ? v.base.lng : v['base-lng']);
    if (baseLat == null || baseLng == null) return null;
    var out = {
      base: {
        lat: baseLat, lng: baseLng,
        elevFt: num(v.base && v.base.elevFt != null ? v.base.elevFt : v['base-elev'])
      }
    };
    var sLat = num(v.summit && v.summit.lat != null ? v.summit.lat : v['summit-lat']);
    var sLng = num(v.summit && v.summit.lng != null ? v.summit.lng : v['summit-lng']);
    if (sLat != null && sLng != null) {
      out.summit = {
        lat: sLat, lng: sLng,
        elevFt: num(v.summit && v.summit.elevFt != null ? v.summit.elevFt : v['summit-elev'])
      };
    }
    return out;
  }

  function resolveWeatherCoords() {
    var fromGlobal = normalizeCoordConfig(window.gsbWeatherConfig);
    if (fromGlobal) return fromGlobal;
    try {
      var raw = localStorage.getItem('gsb-weather-config-v1');
      if (raw) {
        var fromLS = normalizeCoordConfig(JSON.parse(raw));
        if (fromLS) return fromLS;
      }
    } catch (e) { /* storage blocked — fall through to default */ }
    return JH_DEFAULT_COORDS;
  }

  function applyOpenMeteoWeather() {
    var coords = resolveWeatherCoords();
    if (!coords || !coords.base) return Promise.resolve();

    var jobs = [fetchOpenMeteo({ lat: coords.base.lat, lng: coords.base.lng, elevationFt: coords.base.elevFt, name: 'Base' })];
    if (coords.summit) {
      jobs.push(fetchOpenMeteo({ lat: coords.summit.lat, lng: coords.summit.lng, elevationFt: coords.summit.elevFt, name: 'Summit' }));
    }

    return Promise.allSettled(jobs).then(function(results) {
      var baseRes = results[0];
      if (baseRes.status !== 'fulfilled') return; // keep resort-feed/fallback weather

      data.snow = data.snow || {};
      data.snow.weather = data.snow.weather || {};

      var bc = baseRes.value.forecast_current;
      data.snow.weather.base = {
        temperature: { value: String(bc.temp) },
        wind: { value: String(bc.wind_speed) }
      };

      if (coords.summit) {
        var summitRes = results[1];
        if (summitRes && summitRes.status === 'fulfilled') {
          var sc = summitRes.value.forecast_current;
          data.snow.weather.tramSummit = {
            temperature: { value: String(sc.temp) },
            wind: { value: String(sc.wind_speed) }
          };
        }
        // if the summit fetch failed, leave any prior reading in place (best effort)
      } else {
        // Base-only resort — drop any stale summit reading and blank its cells so
        // the conditions card doesn't show a leftover value from another resort.
        delete data.snow.weather.tramSummit;
        ['cellSummitTemp', 'statSummitTemp', 'cellWind'].forEach(function(id) {
          var el = $(id); if (el) el.innerHTML = '<span class="unit">—</span>';
        });
      }

      // Full normalized models, kept for the season-aware conditions card.
      data.weatherModel = {
        base: baseRes.value,
        summit: (coords.summit && results[1] && results[1].status === 'fulfilled') ? results[1].value : null
      };

      setDataStatus('live', 'Live weather · Open-Meteo');
      renderAllData();
    });
  }

  // ============= SEASON-AWARE CONDITIONS CARD =============
  // seasonMode rides in the same config the coords come from (set on the Weather tab).
  function resolveSeasonMode() {
    function read(cfg) { return cfg && cfg.seasonMode; }
    var s = read(window.gsbWeatherConfig);
    if (!s) {
      try { s = read(JSON.parse(localStorage.getItem('gsb-weather-config-v1') || '{}')); }
      catch (e) {}
    }
    // Default to summer when unset (BotScrew default); only an explicit 'winter' opts out.
    return s === 'winter' ? 'winter' : 'summer';
  }

  // The 6 cells per season — same map as the Weather dashboard's preview. Returns
  // [{ k: label, v: valueHTML }]. Retires the old snow-depth/season-total cells.
  function omSeasonCells(mode, baseModel, summitModel) {
    var b = baseModel && baseModel.forecast_current;
    var s = summitModel && summitModel.forecast_current;
    var DASH = '—';
    function temp(t)  { return t != null ? t + '<span class="unit">°F</span>' : DASH; }
    function wind(c)  { return c && c.wind_speed != null ? c.wind_speed + '<span class="unit">mph ' + (c.wind_dir_label || '') + '</span>' : DASH; }
    function cond(c)  {
      if (!(c && c.conditions_label)) return '<span class="cond-label">' + DASH + '</span>';
      return '<span class="cond-icon">' + conditionIcon(c.conditions_id, c.day_period) + '</span>' +
             '<span class="cond-label">' + c.conditions_label + '</span>';
    }
    function snowLvl(c){ return c && c.snow_level != null ? c.snow_level.toLocaleString() + '<span class="unit">ft</span>' : DASH; }
    function uv(c)    { return c && c.uv != null ? String(c.uv) : DASH; }
    function pop(m)   {
      var p = (m && m.forecast_current && m.forecast_current.pop);
      if (p == null && m && m.forecast_hourly) { var h = m.forecast_hourly.filter(function(x){ return x.pop != null; })[0]; p = h && h.pop; }
      return p != null ? Math.round(p * 100) + '<span class="unit">%</span>' : DASH;
    }
    function snowfall(m){ var v = m && m.forecast_snow_summary && m.forecast_snow_summary[0] && m.forecast_snow_summary[0].precip_snow; return v != null ? v + '<span class="unit">in</span>' : DASH; }

    if (mode === 'summer') {
      return [
        { k: 'Temp',       v: temp(b && b.temp) },
        { k: 'Feels Like', v: temp(b && b.apparent_temp) },
        { k: 'Conditions', v: cond(b), cond: true },
        { k: 'Wind',       v: wind(b) },
        { k: 'UV Index',   v: uv(b) },
        { k: 'Precip',     v: pop(baseModel) }
      ];
    }
    var cells = [{ k: 'Base Temp', v: temp(b && b.temp) }];
    if (s) cells.push({ k: 'Summit Temp', v: temp(s && s.temp) });
    cells.push(
      { k: s ? 'Summit Wind' : 'Wind', v: wind(s || b) },
      { k: 'Conditions',  v: cond(b), cond: true },
      { k: 'Snowfall 5d', v: snowfall(baseModel) },
      { k: 'Snow Level',  v: snowLvl(b) }
    );
    return cells;
  }

  // ============= RENDER DATA INTO UI =============
  function fmt(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback || '—';
    return value;
  }

  // Webcam "Updated …" stamp. The hero cam refreshes every 30s, so each successful
  // load resets this to "just now"; if the feed stalls/goes offline the label keeps
  // ticking ("2m ago") off the last good load, per the spec (label stays visible).
  var camUpdatedAt = null;
  function relTime(ms) {
    var s = Math.round((Date.now() - ms) / 1000);
    if (s < 45) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    return Math.round(m / 60) + 'h ago';
  }
  function updateCamStamp() {
    if (camUpdatedAt) safeText('gsbHeroUpdated', 'Updated ' + relTime(camUpdatedAt));
  }

  function renderAllData() {
    if (!data.snow) return;

    var safeSet = function(id, html) {
      var el = $(id);
      if (el) el.innerHTML = html;
    };
    var safeText = function(id, text) {
      var el = $(id);
      if (el) el.textContent = text;
    };

    // Stats strip on the page (only exists in the master demo, not the dashboard)
    var snowSummit = data.snow.snow && data.snow.snow.tramSummit;
    var weather = data.snow.weather || {};
    var parking = data.parking || {};

    if (snowSummit && snowSummit.seasonTotalSnow) {
      safeSet('statSeasonTotal', fmt(snowSummit.seasonTotalSnow.value) + '<span style="font-size:14px;font-weight:400;opacity:0.7">"</span>');
    }
    if (weather.tramSummit && weather.tramSummit.temperature) {
      safeSet('statSummitTemp', fmt(weather.tramSummit.temperature.value) + '<span style="font-size:14px;font-weight:400;opacity:0.7">°F</span>');
    }
    if (typeof parking.totalAvailability === 'number') {
      safeSet('statParking', parking.totalAvailability + '<span style="font-size:14px;font-weight:400;opacity:0.7">%</span>');
    }

    // Launcher temp — base temperature (where the guest actually is, and the only
    // reading guaranteed present since summit coords are optional in the config).
    if (weather.base && weather.base.temperature) {
      safeSet('launcherTemp', fmt(weather.base.temperature.value) + '<span class="gsb-launcher-weather__unit">°F</span>');
    }

    // Conditions card — season-aware grid (Winter/Summer), Open-Meteo driven.
    // Replaces the old fixed cells and retires the leftover snow cells (24h/season/depth).
    var condGrid = document.querySelector('.gsb-conditions-grid');
    if (condGrid) {
      var wm = data.weatherModel || {};
      var cells = omSeasonCells(resolveSeasonMode(), wm.base, wm.summit);
      condGrid.innerHTML = cells.map(function(c) {
        return '<div class="gsb-conditions-cell"><div class="label">' + c.k + '</div>' +
               '<div class="value' + (c.cond ? ' is-cond' : '') + '">' + c.v + '</div></div>';
      }).join('');
    }
    // (Conditions-card source footer removed — no data-source attribution in the
    //  guest-facing card; the Weather tab is where the source is configured.)


    // Season banner — show if there's a detail message indicating off-season.
    // A manual "Recent update" (data-manual-update="true") takes precedence over
    // the live feed, so don't overwrite it here.
    if (data.snow.snow && data.snow.snow.detail) {
      var banner = $('gsbSeasonBanner');
      var manualUpdate = banner && banner.getAttribute('data-manual-update') === 'true';
      var detail = data.snow.snow.detail;
      if (!manualUpdate &&
          (detail.toLowerCase().indexOf('come to an end') !== -1 ||
           detail.toLowerCase().indexOf('reopen for summer') !== -1)) {
        if (banner) banner.style.display = 'block';
        var trimmed = detail.length > 220 ? detail.substring(0, 220) + '…' : detail;
        safeText('gsbSeasonText', trimmed);
      }
    }

    // Webcam — use first available cam. Skip when the Appearance dashboard manages
    // the hero (featured image, 'none', or a manually-set webcam URL).
    var heroSrcAttr = $('gsbHero') && $('gsbHero').getAttribute('data-hero-source');
    var heroManaged = $('gsbHero') && $('gsbHero').getAttribute('data-hero-managed') === 'true';
    if (data.webcams && data.webcams.webcams && data.webcams.webcams.length > 0 &&
        !heroManaged && (!heroSrcAttr || heroSrcAttr === 'webcam')) {
      var cam = data.webcams.webcams[0];
      var heroEl = $('gsbHero');
      if (heroEl) {
        var fallback = heroEl.querySelector('.gsb-webcam-fallback');
        if (fallback) fallback.remove();

        var existingImg = heroEl.querySelector('.gsb-webcam-img');
        if (!existingImg) {
          var img = document.createElement('img');
          img.className = 'gsb-webcam-img';
          img.alt = cam.caption || 'Webcam';
          img.onload = function() { camUpdatedAt = Date.now(); updateCamStamp(); };
          img.onerror = function() {
            if (camUpdatedAt) updateCamStamp();
            else safeText('gsbHeroUpdated', 'Feed offline');
          };
          img.src = cam.url;
          img.dataset.src = cam.url;
          heroEl.insertBefore(img, heroEl.firstChild);

          // Refresh every 30s
          setInterval(function() {
            img.src = img.dataset.src + '?t=' + Date.now();
          }, 30000);
          // Keep the "Updated …" stamp ticking even if the feed stalls between loads
          setInterval(updateCamStamp, 60000);

          // Use the same image for the page hero background (only exists in master demo)
          var siteHeroEl = $('siteHero');
          if (siteHeroEl) {
            siteHeroEl.style.backgroundImage =
              'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.55) 100%), url("' + cam.url + '")';
          }
        }
        safeText('gsbHeroStation', cam.caption || 'Webcam');
      }
    }
  }

  // ============= CHAT INTERACTION =============
  function openChat(entryPoint) {
    // body.modal-open is set by the dashboard's setOpen() — we just (re)assert
    // column placement for the current variant (idempotent).
    applyColumnLayout();
    session.openTime = Date.now();
    if (entryPoint) session.entryPoint = entryPoint;
    analytics.track('widget_opened', { entry_point: entryPoint || session.entryPoint || 'unknown' });
    // webcam_viewed: once per session when the hero is a live cam.
    var heroEl = $('gsbHero');
    if (!session.webcamViewed && heroEl && heroEl.getAttribute('data-hero-source') === 'webcam') {
      session.webcamViewed = true;
      analytics.track('webcam_viewed', {});
    }
  }

  function closeChat() {
    // body.modal-open is unset by the dashboard's setOpen() — we just exit voice mode if active
    if (voice.fullModeActive) closeVoiceMode();
    analytics.track('widget_closed', {
      turn_count: session.turnCount,
      duration_seconds: session.openTime ? Math.round((Date.now() - session.openTime) / 1000) : 0
    });
  }

  function moveContentToLeftColumn() {
    var leftCol = $('gsbLeftColumn');
    var rightCol = $('gsbRightColumn');
    if (!leftCol || !rightCol) return;

    // Look in BOTH columns — elements may already have been moved on a previous open
    function findIn(parent, sel) { return parent.querySelector(sel); }
    var hero = findIn(rightCol, '.gsb-chat-hero') || findIn(leftCol, '.gsb-chat-hero');
    var welcome = findIn(rightCol, '.gsb-welcome') || findIn(leftCol, '.gsb-welcome');
    var seasonBanner = findIn(rightCol, '.gsb-season-banner') || findIn(leftCol, '.gsb-season-banner');
    var conditions = findIn(rightCol, '.gsb-conditions') || findIn(leftCol, '.gsb-conditions');

    // Left column = the visual / weather side: hero, season banner, conditions.
    leftCol.innerHTML = '';
    if (hero) leftCol.appendChild(hero);
    if (seasonBanner) leftCol.appendChild(seasonBanner);
    if (conditions) leftCol.appendChild(conditions);
    // The welcome greeting moves to the RIGHT (conversation) column at the top — it
    // anchors the chat and frees vertical room for the weather card on the left.
    if (welcome) rightCol.insertBefore(welcome, rightCol.firstChild);
  }

  function moveContentToRightColumn() {
    var leftCol = $('gsbLeftColumn');
    var rightCol = $('gsbRightColumn');
    if (!leftCol || !rightCol) return;

    var chips = rightCol.querySelector('.gsb-chips');

    // Look in BOTH columns for the elements
    function findIn(parent, sel) { return parent.querySelector(sel); }
    var hero = findIn(leftCol, '.gsb-chat-hero') || findIn(rightCol, '.gsb-chat-hero');
    var welcome = findIn(leftCol, '.gsb-welcome') || findIn(rightCol, '.gsb-welcome');
    var seasonBanner = findIn(leftCol, '.gsb-season-banner') || findIn(rightCol, '.gsb-season-banner');
    var conditions = findIn(leftCol, '.gsb-conditions') || findIn(rightCol, '.gsb-conditions');

    if (hero && chips) rightCol.insertBefore(hero, chips);
    if (welcome && chips) rightCol.insertBefore(welcome, chips);
    if (seasonBanner && chips) rightCol.insertBefore(seasonBanner, chips);
    if (conditions && chips) rightCol.insertBefore(conditions, chips);
    // Keep the "Suggested questions" intro anchored to its chips (it labels them).
    // The inserts above land content just before chips, which would otherwise strand
    // the intro at the top of the column in full-panel mobile.
    var intro = rightCol.querySelector('.gsb-conversation-intro');
    if (intro && chips) rightCol.insertBefore(intro, chips);

    leftCol.innerHTML = '';
  }

  function setVariant(variant) {
    body.dataset.variant = variant;
    applyColumnLayout();
  }

  // Place hero/welcome/season/conditions in the column the current variant needs
  // (Full = left column, Side/Middle = right). Idempotent and order-independent,
  // so a fresh load / auto-open can't strand content in the wrong column —
  // previously the move only ran if the chat was already open when the variant
  // changed, which left Full panels empty-on-the-left after a refresh.
  function applyColumnLayout() {
    if (!$('gsbLeftColumn') || !$('gsbRightColumn')) return;
    // The full-panel two-column split is a desktop affordance. On mobile the
    // columns collapse to one, so render full like side/middle (single column,
    // natural order: hero → welcome → season → conditions) — otherwise the
    // welcome greeting strands below the season/conditions cards.
    var isMobile = window.matchMedia('(max-width: 899px)').matches;
    if (body.dataset.variant === 'full' && !isMobile) moveContentToLeftColumn();
    else moveContentToRightColumn();
  }

  // Re-flow when crossing the mobile breakpoint so a rotate/resize doesn't
  // strand full panel in the layout it first loaded in.
  var __layoutMQ = window.matchMedia('(max-width: 899px)');
  if (__layoutMQ.addEventListener) __layoutMQ.addEventListener('change', applyColumnLayout);
  else if (__layoutMQ.addListener) __layoutMQ.addListener(applyColumnLayout);

  // ============= MESSAGE HANDLING =============
  // When the chat is opened *with* a query (starter chip or hero search), the
  // panel is mid-expand from the launcher. A smooth scroll races that animation
  // and can leave the question scrolled off below the webcam hero — so the
  // opening exchange (question + typing) SNAPS into view instantly instead.
  // Transform-scale doesn't affect scroll math, so it lands correctly even while
  // the panel is still scaling up. Cleared once the panel has finished expanding.
  var conversationOpening = false;
  // Find the element that actually scrolls the message list (differs per panel
  // variant) and pin it to the bottom. Uses scrollTop — which, unlike
  // scrollIntoView/getBoundingClientRect, is NOT distorted by the panel's
  // open-animation transform — so the conversation lands correctly mid-expand.
  function snapConversationToBottom() {
    var el = $('gsbMessages');
    while (el && el !== document.body) {
      var oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        el.scrollTop = el.scrollHeight;
        return;
      }
      el = el.parentElement;
    }
  }
  function scrollMsgIntoView(msg) {
    // Opening with a query: snap instantly (transform-safe) so the question +
    // typing are what the user lands on as the panel expands.
    if (conversationOpening) { snapConversationToBottom(); return; }
    // 'block: end' keeps the new bubble at the bottom of the visible area
    // (closest to the composer) — the natural reading position. scrollIntoView
    // on the element is reliable across all three variants once the panel is at
    // rest (no transform in flight).
    requestAnimationFrame(function() {
      msg.scrollIntoView({ block: 'end', behavior: 'smooth' });
    });
  }

  function appendMessage(text, role) {
    var msg = document.createElement('div');
    msg.className = 'gsb-msg gsb-msg--' + role;
    // Linkify so booking/ticket/lesson URLs in replies are clickable (and tracked
    // via outbound_click). XSS-safe: autolink() escapes everything it doesn't anchor.
    msg.innerHTML = autolink(text);
    $('gsbMessages').appendChild(msg);
    body.classList.add('gsb-conversation-started');
    scrollMsgIntoView(msg);
  }

  // ============= JACKSON HOLE KNOWLEDGE BASE =============
  // Pattern-matched responses with live data injection where available.
  // Patterns are checked in priority order — most specific first.
  // Live data refs: data.snow, data.trailLift, data.parking, data.webcams.
  // NOTE: baseAiResponse holds the original hardcoded answers. generateAiResponse
  // (below the function) wraps it to layer in omni's knowledge — official resort
  // links and the pricing guardrail — so both the chat and voice paths benefit.
  function baseAiResponse(userQuery) {
    var q = userQuery.toLowerCase().trim();

    // Helper: extract live data safely
    function liveSnow24() {
      var v = data.snow && data.snow.snow && data.snow.snow.midMountain && data.snow.snow.midMountain.newSnowLast24H;
      return v && v.value;
    }
    function liveDepth() {
      var v = data.snow && data.snow.snow && data.snow.snow.tramSummit && data.snow.snow.tramSummit.totalSnowDepth;
      return v && v.value;
    }
    function liveSeasonTotal() {
      var v = data.snow && data.snow.snow && data.snow.snow.tramSummit && data.snow.snow.tramSummit.seasonTotalSnow;
      return v && v.value;
    }
    function liveBaseTemp() {
      var v = data.snow && data.snow.weather && data.snow.weather.base && data.snow.weather.base.temperature;
      return v && v.value;
    }
    function liveSummitTemp() {
      var v = data.snow && data.snow.weather && data.snow.weather.tramSummit && data.snow.weather.tramSummit.temperature;
      return v && v.value;
    }

    // ============= GREETINGS & SMALL TALK =============
    if (/^(hi|hey|hello|yo|sup|howdy|hola|hiya)\b/.test(q)) {
      return "Hi there! Welcome to Jackson Hole. I can help with snow, lift status, trails, dining, lodging, lessons, tickets, and just about anything else about the mountain. What are you curious about?";
    }
    if (/^(thanks|thank you|ty|appreciate)/.test(q)) {
      return "You bet — happy to help. Anything else you'd like to know about your visit?";
    }
    if (/^(bye|goodbye|see ya|cya|later)/.test(q)) {
      return "Have an incredible time on the mountain. The Big One is calling.";
    }
    if (/who are you|what are you|are you (a |an )?(bot|ai|human|person)/.test(q)) {
      return "I'm the Jackson Hole digital concierge — your AI guide to the mountain, powered by Get Ski Bots. I can answer questions about conditions, terrain, dining, lodging, lessons, and more. What can I help you with?";
    }
    if (/help|what can you do|capabilities/.test(q)) {
      return "I can help with snow conditions, lift and trail status, terrain recommendations, dining (Couloir, Piste, Headwall, etc.), lodging (Caldera House, Snake River Lodge), lessons through the Mountain Sports School, tickets and passes, parking, webcams, summer activities, and getting around the resort. What's on your mind?";
    }

    // ============= SNOW & POWDER =============
    if (/snow|powder|fresh|pow|new snow|snowfall|recent snow|how much snow/.test(q)) {
      var snow24 = liveSnow24();
      var depth = liveDepth();
      var seasonTotal = liveSeasonTotal();
      var msg = "Latest snow report: ";
      if (snow24 !== undefined) msg += snow24 + '" in the last 24 hours. ';
      if (depth !== undefined) msg += "Tram summit base is " + depth + '". ';
      if (seasonTotal !== undefined) msg += "Season total at the summit: " + seasonTotal + '". ';
      msg += "JHMR averages 459 inches a season — among the snowiest big mountains in North America.";
      return msg;
    }

    // ============= LIFT STATUS =============
    if (/\blift|lifts|tram|gondola|chairlift|bridger|sublette|thunder|teton|casper\b/.test(q)) {
      var tl = data.trailLift;
      if (tl && tl.liftStatus && tl.liftStatus.totalLifts === 0) {
        return "Lifts are currently closed — the 2025/26 ski season ended April 12th. The Aerial Tram reopens for summer sightseeing on May 16th, with the gondolas joining June 6th. Bike park, ropes course, and via ferrata return June 13th.";
      }
      var liftMsg = "";
      if (tl && tl.liftStatus) {
        liftMsg = tl.liftStatus.openLifts + " of " + tl.liftStatus.totalLifts + " lifts open right now. ";
      }
      // Specific lift info
      if (q.indexOf('tram') !== -1) {
        return liftMsg + "The Aerial Tram (Big Red) runs from Teton Village to the summit of Rendezvous Mountain — 4,139 vertical feet in 12 minutes. It's the iconic JH ride. Capacity 100 per car, line can be 30+ minutes on powder days.";
      }
      if (q.indexOf('bridger') !== -1) {
        return liftMsg + "The Bridger Gondola runs from the base to mid-mountain (Casper Restaurant area). It's the workhorse — 8-passenger cabins, runs even in high winds when other lifts close.";
      }
      if (q.indexOf('sublette') !== -1) {
        return liftMsg + "Sublette Quad accesses upper-mountain expert terrain — Cheyenne Bowl, Headwall, Tensleep Bowl. Powder day favorite.";
      }
      return liftMsg + "Key lifts: Aerial Tram (Big Red), Bridger Gondola, Sublette, Thunder, Teton, Apres Vous, Casper, Marmot, Eagle's Rest. The Tram and Bridger are your two main mountain access points.";
    }

    // ============= TRAILS / TERRAIN / RUNS =============
    if (/\b(trail|trails|run|runs|terrain|ski runs|where to ski|piste|slope)\b/.test(q)) {
      return "JHMR has 2,500 skiable acres and 116 named trails across 4,139 vertical feet. Terrain breaks down: 10% beginner, 40% intermediate, 50% expert. Famous runs include Rendezvous Bowl, Corbet's Couloir, Casper Bowl, Toilet Bowl, Headwall, and Tensleep Bowl. For groomers, try Sundance, Werner, or Apres Vous. What level skier are you?";
    }
    if (/corbet|corbet's/.test(q)) {
      return "Corbet's Couloir is JHMR's signature line — a 20-foot mandatory air drop into a steep narrow chute off Rendezvous Bowl. It's been called \"America's scariest ski run.\" Access via Tram, then traverse skier's left from Rendezvous Bowl. Most people side-slip past it, but the bold drop in.";
    }
    if (/rendezvous bowl|rendezvous mountain/.test(q)) {
      return "Rendezvous Bowl is the iconic top-of-mountain bowl, accessed via the Aerial Tram. 360-degree views of the Tetons, Snake River Valley, and Yellowstone country. Open powder bowl, perfect for first run of the day on a fresh snow morning.";
    }
    if (/beginner|first time|first-time|never skied|easy run|green run|ski school|learning|kids ski/.test(q)) {
      return "JHMR isn't traditionally beginner-friendly — only 10% of terrain is green. But Apres Vous Mountain on the south side is the dedicated beginner zone with gentle pitches, the Eagle's Rest carpet, and Werner. Best to book Mountain Sports School lessons (group $230, private $850) — instructors will set you on the right runs. Snow King Resort in town is actually easier for true beginners.";
    }
    if (/expert|double black|hardest|steepest|gnarly|hairy|extreme|backcountry|sidecountry|out of bounds/.test(q)) {
      return "JHMR is the big-mountain home of expert terrain. Hobacks (steep tree skiing), Cody Bowl (cliff bands), Granite Canyon, Casper Bowl, Tensleep, Cheyenne Bowl. The sidecountry through gates 1-9 accesses untracked but you need beacon, shovel, probe, and partners. Avalanche danger is real — check JHAvalanche.org and consider hiring a guide your first day.";
    }
    if (/hobacks|hoback/.test(q)) {
      return "The Hobacks are a 1,500-foot continuous tree-skiing zone on the south side of the mountain — long fall-line runs through aspens and spruce. Best after fresh snow. Access via Sublette to traverse, then drop in. Locals' favorite.";
    }

    // ============= PARKING =============
    if (/parking|park|where to park|lot/.test(q)) {
      var p = data.parking;
      if (p) {
        var msg = "Parking right now: overall " + p.totalAvailability + "% available across all lots. ";
        if (p.parking_lots) {
          var openLots = p.parking_lots.filter(function(lot) { return lot.occupied_percentage < 90; });
          if (openLots.length > 0) {
            msg += "Best bet: " + openLots[0].name + " at " + (100 - openLots[0].occupied_percentage) + "% open. ";
          }
        }
        msg += "Pro tip: arrive before 9am or use the START bus from town to skip parking entirely.";
        return msg;
      }
      return "Parking is at Teton Village — Ranch Lot, Stilson Lot (free shuttle), and various paid lots near the base. Powder days fill by 8:30am. The free START bus from Jackson runs every 30 min and drops you at the Tram base.";
    }

    // ============= SEASON & DATES =============
    if (/summer|spring|opening day|closing day|season dates|when does|when is|when do|reopen/.test(q)) {
      return "2025/26 ski season just ended April 12th. Summer ops: Aerial Tram reopens May 16th for sightseeing. Gondolas open June 6th. Bike Park, Aerial Adventure Course, ropes course, and via ferrata all open June 13th. Adults $37, juniors $37, daily 10am-6pm. Next ski season opens late November 2026.";
    }
    if (/season pass|epic pass|ikon pass|mountain collective|pass/.test(q)) {
      return "JHMR is on the Mountain Collective and Ikon Base Plus passes (7 days). Full Ikon Pass gets you 5 days. Standalone JHMR season pass runs ~$2,400 adult. Day tickets dynamic-priced — typically $230-340 in advance, more at the window. Buy early online for best rates.";
    }

    // ============= WEATHER =============
    if (/\b(weather|temp|temperature|cold|warm|wind|forecast|conditions)\b/.test(q)) {
      var bt = liveBaseTemp();
      var st = liveSummitTemp();
      var msg = "Current temperatures: ";
      if (bt !== undefined) msg += "Base " + bt + "°F. ";
      if (st !== undefined) msg += "Tram summit " + st + "°F. ";
      msg += "Forecast typically updates 5am, noon, and 5pm. Layer for 30+ degree swings between base and summit, and pack goggles + buff — the Tram is windy.";
      return msg;
    }

    // ============= WEBCAMS =============
    if (/\b(webcam|camera|cam|live view|live feed|see the mountain)\b/.test(q)) {
      var cams = data.webcams && data.webcams.webcams;
      if (cams && cams.length > 0) {
        var camNames = cams.slice(0, 4).map(function(c) { return c.caption; }).join(', ');
        return "We have " + cams.length + " live webcams across the resort: " + camNames + ", and more. The Cody Bowl cam at the top of this chat refreshes every 30 seconds. The Tram Dock and Village Commons cams are great for checking lift line length and weather.";
      }
      return "JHMR has 8 live webcams: Cody Bowl, Tram Dock, Village Commons, Bridger Center, Headwall, Casper, Apres Vous, and the Town of Jackson. All visible at jacksonhole.com/webcams.";
    }

    // ============= DINING =============
    if (/\b(restaurant|food|eat|eating|dining|dinner|lunch|breakfast|hungry|where to eat|coffee|drinks?|bar)\b/.test(q)) {
      return "On-mountain: Couloir (top of the Tram, fine dining with Teton views) — book ahead. Piste Mountain Bistro (mid-mountain, casual upscale). Headwall Deli (sandwiches at top of Bridger). Casper Restaurant (cafeteria + sit-down, mid-mountain). At the base: Spur (steakhouse), Handle Bar (gastropub), Ascent Lounge. In town: Snake River Brewing, Persephone Bakery, The Bistro, Bin22.";
    }
    if (/couloir restaurant|couloir/.test(q)) {
      return "Couloir is JHMR's flagship fine dining — perched at 9,095 ft at the top of the Aerial Tram. Sweeping Teton views, contemporary American cuisine, full bar. Open for lunch during ski season and dinner select nights. Reservations strongly recommended: 307-739-2675 or jacksonhole.com.";
    }
    if (/piste/.test(q)) {
      return "Piste Mountain Bistro is mid-mountain (top of Bridger Gondola, 8,000 ft). Casual upscale lunch — burgers, salads, pastas, wood-fired flatbreads. Sun-deck seating with views. Walk-in friendly but reservations help on busy days.";
    }
    if (/spur|spur restaurant/.test(q)) {
      return "Spur is the steakhouse at Teton Mountain Lodge in Teton Village — slope-side. Locally sourced beef, elk, fish. Great for after a powder day. Reservations recommended: 307-732-6932.";
    }

    // ============= LODGING =============
    if (/\b(hotel|lodging|stay|where to stay|accommodation|sleep|room|airbnb|condo)\b/.test(q)) {
      return "At Teton Village (slopeside): Caldera House (luxury, ski-in/ski-out), Hotel Terra (eco-luxury), Snake River Lodge & Spa, Four Seasons Resort, Teton Mountain Lodge, The Lodge at Jackson Hole. In town (10 mi away, free shuttle): The Wort Hotel (historic), Snow King Resort, Anvil Hotel. Vacation rentals via JHResortLodging.com or VRBO are popular for groups.";
    }
    if (/caldera house|caldera/.test(q)) {
      return "Caldera House is the boutique luxury option at Teton Village — 8 suites, slope-side. Restaurant-quality breakfast included, ski concierge, full bar. Suites run $1,500-3,500/night peak season. Often booked a year ahead.";
    }
    if (/four seasons/.test(q)) {
      return "Four Seasons Resort Jackson Hole is at Teton Village, ski-in/ski-out at the gondola. 124 rooms + suites. Westbank Grill, Ascent Lounge, full spa. Reliably ~$1,200-2,500/night peak. Service-forward, family-friendly.";
    }

    // ============= LESSONS / SCHOOL =============
    if (/\b(lesson|lessons|instructor|instruction|ski school|snowboard school|teach|learn|lessons?)\b/.test(q)) {
      return "Mountain Sports School at JHMR offers group and private lessons for ski and snowboard, ages 3+. Group lessons run ~$230/day, privates from $850. Specialty programs: Mountain Adventure (advanced terrain coaching), women's clinics, big-mountain camps. Book at jacksonhole.com/lessons or call 307-739-2779. Best to book 1-2 weeks ahead in peak season.";
    }
    if (/kids|children|family|toddler|child care|childcare|daycare/.test(q)) {
      return "Family-friendly resources: Mountain Sports School Kids Ranch (ages 3-13, full-day programs $230). Cody House Daycare for non-skiing kids (ages 6 mos - 6 yrs). Family-friendly runs on Apres Vous side. The Aerial Tram allows kids 4+ when accompanied. Avoid Corbet's with the kids.";
    }

    // ============= TICKETS / PRICING =============
    if (/\b(ticket|tickets|price|pricing|cost|how much|day pass|lift ticket)\b/.test(q)) {
      return "Day tickets are dynamic-priced. Typically $230-340 adult in advance, $40-50 more at the window. Multi-day discounts available. Locals get value with the JHMR season pass (~$2,400) or partner passes (Mountain Collective, Ikon). Kids 5 and under ski free. Buy at jacksonhole.com or the Bridger Center.";
    }

    // ============= GETTING THERE / TRANSPORT =============
    if (/airport|jac|fly|flight|jackson hole airport/.test(q)) {
      return "Jackson Hole Airport (JAC) is 12 miles from Teton Village — the only commercial airport inside a U.S. national park (Grand Teton). Direct flights from major hubs: Denver, Salt Lake, Chicago, Dallas, Atlanta, Newark, LAX, SFO, Seattle (seasonal). Cab/Uber to Teton Village ~$50-70. Resort shuttles from major hotels.";
    }
    if (/town shuttle|start bus|bus|transport|getting around|how to get/.test(q)) {
      return "The START Bus runs free between the Town of Jackson and Teton Village every 30 min, 6am-11pm. Stops at major hotels and the JHMR base. The Stilson Lot (south of Teton Village) has a free 5-min shuttle to the Tram base. Driving from town: 25-30 min. Powder days, expect parking full by 8:30am.";
    }
    if (/airport shuttle|hotel shuttle|how to get to teton village|town to mountain/.test(q)) {
      return "From JAC airport: Alltrans Mountain Shuttle, Jackson Hole Shuttle, or Cowboy Shuttle. Many hotels offer their own. Uber/Lyft work but limited supply on busy days. Rental cars at airport. Once at Teton Village, you don't really need a car — START Bus + walking covers everything.";
    }

    // ============= HOURS =============
    if (/\b(hours|when (do|does)|operating hours|open at|closes? at|time)\b/.test(q)) {
      return "Lift hours during ski season: 9am-4pm daily, with Bridger Gondola opening at 8:30am. Aerial Tram first run typically 9am, last down 3:30pm. Mountain Sports School: 9am-3pm. Restaurants vary — Couloir reopens for limited summer ops. Customer service: 7am-7pm at 307-733-2292.";
    }

    // ============= APRÈS / NIGHTLIFE =============
    if (/apres|après|nightlife|drinks after|happy hour|cocktail|nightclub/.test(q)) {
      return "Best après spots: Mangy Moose (legendary, slope-side, live music nightly), Handle Bar at Four Seasons (craft cocktails), Ascent Lounge, Couloir (sunset cocktails at the top of the Tram). In town: Million Dollar Cowboy Bar (saddles for barstools, dance floor), Silver Dollar Bar at the Wort, Snake River Brewing.";
    }
    if (/mangy moose/.test(q)) {
      return "The Mangy Moose Saloon is the iconic JH après bar — slope-side at Teton Village since 1967. Live music most nights, decent food, beer-fueled chaos. Stuffed moose head over the bar. The deck is the place to be at 4pm on a powder day.";
    }

    // ============= GENERAL JH FACTS / STATS =============
    if (/vertical|vertical drop|how big|size|acres|stats|elevation/.test(q)) {
      return "JHMR stats: 4,139 vertical feet (the most of any U.S. resort). 2,500 skiable acres. 116 named trails. Base elevation 6,311 ft, Tram summit 10,450 ft. Average snowfall 459 inches/year. The mountain is famous for steep skiing, deep snow, and zero pretense.";
    }
    if (/grand teton|teton range|tetons|park|national park|yellowstone/.test(q)) {
      return "Jackson Hole sits at the foot of the Grand Tetons. Grand Teton National Park is a 20-min drive north — drive Teton Park Road or Moose-Wilson Road for jaw-dropping views. Yellowstone is 1 hour further north, gateway through the South Entrance. Many guests do a day trip to Yellowstone — but plan for a full day.";
    }
    if (/wildlife|moose|elk|bear|bison|wolf|wolves/.test(q)) {
      return "Wildlife is abundant year-round. Common: elk, moose, mule deer, bison (winter range). Less common but possible: wolves, grizzly + black bear (most hibernating in winter), trumpeter swans, bald eagles. The National Elk Refuge in Jackson hosts ~7,500 elk in winter — sleigh rides available.";
    }

    // ============= EVENTS / CONCERTS =============
    if (/event|concert|music|festival|happening|things to do|nightlife/.test(q)) {
      return "JHMR hosts concerts at the Mangy Moose, summer music at Snake River Lodge, and the Jackson Hole Rendezvous Festival (mid-March). Town events: Old West Days (Memorial weekend), Fall Arts Festival (Sept). For ski-season events: Pole-Pedal-Paddle (April), Town Downhill, Reggae Festival.";
    }

    // ============= PHOTO SPOTS =============
    if (/photo|instagram|pictures?|view|sunset|sunrise|scenic|spot|where to take|best view/.test(q)) {
      return "Best photo spots: Top of the Aerial Tram (Tetons + Snake River Valley), Corbet's Cabin (sunset cocktail with epic light), Cody Peak (hike from the Tram), Grand Teton viewpoints on Moose-Wilson Road, Mormon Row barns at sunrise, Schwabacher's Landing (Tetons reflected in the river). The classic Ansel Adams shot is from Snake River Overlook.";
    }

    // ============= GENERIC FALLBACK =============
    return "I can help with snow conditions, lift status, trails, dining, lodging, lessons, tickets, parking, transport, and pretty much anything else about Jackson Hole. Try asking about Corbet's Couloir, Couloir restaurant, Aerial Tram, Mountain Sports School, or the Hobacks. What would you like to know?";
  }

  // Layer omni's curated knowledge on top of the base answer: an official resort
  // link for the matched topic, plus the pricing guardrail (omni 'critical' note:
  // never quote rates — direct guests to the phone line). Additive, so the
  // original answers are preserved. Messages render as plain text (textContent),
  // so we append inline sentences rather than rely on line breaks.
  function enrichWithKnowledge(query, base) {
    if (!base) return base;
    var q = (query || '').toLowerCase();
    var extras = [];

    // Pricing guardrail — ticket / pass / pricing intents.
    if (/\b(price|pricing|cost|how much|rate|rates)\b/.test(q) ||
        /\b(tickets?|day pass|lift ticket)\b/.test(q) ||
        /\bseason ?pass(es)?\b/.test(q)) {
      extras.push('Pricing varies by date of visit — the best rates are online in advance; for current pricing call ' + JH_KNOWLEDGE.contactPhone + '.');
    }

    // Official resort link for the matched topic (omni knowledgeGroups).
    var link = topicLink(q);
    if (link && base.indexOf(link.url) === -1) {
      extras.push('Official ' + link.label + ': ' + link.url);
    }

    if (!extras.length) return base;
    return base + ' ' + extras.join(' ');
  }

  // Wrap the base responder so every path (chat + voice) gets the omni knowledge.
  function generateAiResponse(userQuery) {
    return enrichWithKnowledge(userQuery, baseAiResponse(userQuery));
  }

  function handleUserMessage(text) {
    if (!text || !text.trim()) return null;
    var userText = text.trim();
    // Analytics: first user message starts the conversation (once per session).
    if (!session.started) {
      session.started = true;
      session.startTime = Date.now();
      analytics.track('conversation_started', { entry_point: session.entryPoint || 'unknown' });
    }
    session.turnCount += 1;
    analytics.track('message_sent', { turn_number: session.turnCount });
    appendMessage(userText, 'user');

    var aiResponse = generateAiResponse(userText);

    // Show "typing" indicator with realistic timing — calibrated to message
    // length so longer responses get longer "thinking" time, just like a real
    // human typing. Also gives the chat a natural rhythm instead of instant
    // robotic replies.
    showTypingIndicator();
    var charsPerSecond = 60; // realistic typing speed
    var minDelay = 800;
    var maxDelay = 3000;
    var calculatedDelay = Math.max(minDelay, Math.min(maxDelay,
      (aiResponse.length / charsPerSecond) * 1000
    ));

    setTimeout(function() {
      // Fade the indicator out first, then ease the answer in — a gentle hand-off
      // instead of yanking the dots and popping the full answer in instantly.
      hideTypingIndicator(function() {
        appendMessage(aiResponse, 'ai');
        if (voice.outputEnabled && !voice.fullModeActive) {
          speak(aiResponse);
        }
      });
    }, calculatedDelay);

    return aiResponse;
  }

  function showTypingIndicator() {
    var existing = document.getElementById('gsbTypingIndicator');
    if (existing) return; // already showing
    var msg = document.createElement('div');
    msg.className = 'gsb-msg gsb-msg--ai gsb-typing-indicator';
    msg.id = 'gsbTypingIndicator';
    // Style comes from Appearance (Behavior → Typing indicator): dots | orb | label.
    var tStyle = document.body.getAttribute('data-typing-indicator') || 'dots';
    if (tStyle === 'orb') {
      msg.innerHTML = '<span class="gsb-typing-orb"></span>';
    } else if (tStyle === 'label') {
      var who = document.body.getAttribute('data-typing-label') || 'AI Concierge';
      msg.innerHTML = '<span class="gsb-typing-name"></span>'
                    + '<span class="gsb-typing-ellipsis"><span>.</span><span>.</span><span>.</span></span>';
      msg.querySelector('.gsb-typing-name').textContent = who + ' is typing';
    } else {
      msg.innerHTML = '<span class="gsb-typing-dot"></span>'
                    + '<span class="gsb-typing-dot"></span>'
                    + '<span class="gsb-typing-dot"></span>';
    }
    $('gsbMessages').appendChild(msg);
    body.classList.add('gsb-conversation-started');
    // Auto-scroll the typing indicator into view so the user immediately
    // sees the AI is composing — sells the realism of "someone is typing".
    scrollMsgIntoView(msg);
  }

  function hideTypingIndicator(onDone) {
    var ti = document.getElementById('gsbTypingIndicator');
    if (!ti) { if (onDone) onDone(); return; }
    // Fade out (~150ms), then remove and continue — gives the dots-→-answer beat.
    ti.classList.add('gsb-typing-out');
    setTimeout(function() {
      if (ti.parentNode) ti.parentNode.removeChild(ti);
      if (onDone) onDone();
    }, 160);
  }

  // ============= VOICE: SPEECH RECOGNITION + SYNTHESIS =============
  var voice = {
    sttSupported: false,
    ttsSupported: false,
    recognition: null,
    isListening: false,
    outputEnabled: false,
    fullModeActive: false,
    fullModeOrbState: 'idle',  // 'idle' | 'listening' | 'thinking' | 'speaking'
    interimTranscript: '',
    finalTranscript: ''
  };

  function detectVoiceSupport() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    voice.sttSupported = !!SR;
    voice.ttsSupported = 'speechSynthesis' in window;

    if (!voice.sttSupported) {
      // Hide mic + voice mode trigger if STT not supported
      $('gsbComposerMic').setAttribute('data-supported', 'false');
      $('gsbVoiceModeBtn').setAttribute('data-supported', 'false');
    }
    // (The read-aloud / voice-output toggle was removed from the header UI, so
    //  there's no element to hide when TTS is unsupported.)

    // If neither, show a toast on first chat open
    if (!voice.sttSupported && !voice.ttsSupported) {
      voice._showUnsupportedToastOnOpen = true;
    }
  }

  function showVoiceToast(message, durationMs) {
    var toast = $('gsbVoiceToast');
    toast.textContent = message;
    toast.setAttribute('data-show', 'true');
    setTimeout(function() {
      toast.removeAttribute('data-show');
    }, durationMs || 3000);
  }

  function initRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    var recog = new SR();
    recog.continuous = false;       // single utterance mode for composer
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.maxAlternatives = 1;

    return recog;
  }

  // ===== Composer mic (single-shot dictation) =====
  function startComposerListening() {
    if (!voice.sttSupported || voice.isListening) return;

    if (!voice.recognition) voice.recognition = initRecognition();
    var recog = voice.recognition;

    voice.isListening = true;
    voice.interimTranscript = '';
    voice.finalTranscript = '';

    $('gsbComposerMic').setAttribute('data-listening', 'true');
    $('gsbComposerRow').setAttribute('data-listening', 'true');

    var input = $('gsbComposerInput');
    var originalPlaceholder = input.placeholder;
    input.placeholder = 'Listening…';
    input.value = '';

    recog.onresult = function(event) {
      var interim = '';
      var final = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      voice.finalTranscript = (voice.finalTranscript + ' ' + final).trim();
      voice.interimTranscript = interim;
      input.value = (voice.finalTranscript + ' ' + interim).trim();
    };

    recog.onerror = function(e) {
      input.placeholder = originalPlaceholder;
      stopComposerListening();
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        showVoiceToast('Microphone permission was denied. Enable it in your browser settings to use voice input.', 4500);
      } else if (e.error === 'no-speech') {
        showVoiceToast("I didn't catch that. Tap the mic and try again.", 2500);
      }
    };

    recog.onend = function() {
      input.placeholder = originalPlaceholder;
      stopComposerListening();
      // Auto-submit if we have a meaningful transcript
      var finalText = (voice.finalTranscript + ' ' + voice.interimTranscript).trim();
      if (finalText.length > 1) {
        input.value = '';
        handleUserMessage(finalText);
      }
    };

    try {
      recog.start();
    } catch (e) {
      // Catch "already started" errors
      stopComposerListening();
    }
  }

  function stopComposerListening() {
    voice.isListening = false;
    $('gsbComposerMic').setAttribute('data-listening', 'false');
    $('gsbComposerRow').setAttribute('data-listening', 'false');
    if (voice.recognition) {
      try { voice.recognition.stop(); } catch (e) { /* ignore */ }
    }
  }

  function toggleComposerListening() {
    if (voice.isListening) {
      stopComposerListening();
    } else {
      startComposerListening();
    }
  }

  // ===== Speech synthesis (TTS) =====
  function speak(text, opts) {
    if (!voice.ttsSupported || !text) return;
    opts = opts || {};

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts.rate || 1.05;
    utterance.pitch = opts.pitch || 1.0;
    utterance.volume = 1.0;

    // Try to pick a natural-sounding voice if available
    var voices = window.speechSynthesis.getVoices();
    if (voices && voices.length) {
      // Prefer en-US, prefer named voices that tend to sound better
      var preferred = voices.filter(function(v) {
        return /en[-_]US/i.test(v.lang) && (
          /samantha|alex|google|nat|allison|ava/i.test(v.name)
        );
      });
      if (preferred.length) {
        utterance.voice = preferred[0];
      } else {
        // Any en-US voice
        var enUS = voices.filter(function(v) { return /en[-_]US/i.test(v.lang); });
        if (enUS.length) utterance.voice = enUS[0];
      }
    }

    utterance.onstart = function() {
      if (voice.fullModeActive) {
        setOrbState('speaking');
        setTranscript(text, 'ai');
      }
      if (opts.onstart) opts.onstart();
    };
    utterance.onend = function() {
      if (voice.fullModeActive) {
        setOrbState('listening');
        // Auto-restart listening so it's a continuous voice loop
        setTimeout(function() {
          if (voice.fullModeActive) startVoiceModeListening();
        }, 250);
      }
      if (opts.onend) opts.onend();
    };
    utterance.onerror = function() {
      if (voice.fullModeActive) setOrbState('idle');
    };

    window.speechSynthesis.speak(utterance);
  }

  function toggleVoiceOutput() {
    if (!voice.ttsSupported) {
      showVoiceToast('Voice output is not supported in this browser.', 3000);
      return;
    }
    voice.outputEnabled = !voice.outputEnabled;

    if (!voice.outputEnabled) {
      window.speechSynthesis.cancel();  // stop any in-progress speech
    } else {
      // Brief audio confirmation that voice output is now on
      speak('Voice output on.', { rate: 1.15 });
    }
  }

  // ===== Full voice mode (hands-free) =====
  function setOrbState(state) {
    voice.fullModeOrbState = state;
    $('gsbVoiceOrb').setAttribute('data-state', state);
    $('gsbVoiceStatus').setAttribute('data-state', state);
    // Overlay carries the state so CSS can show the Begin button only while idle.
    $('gsbVoiceModeOverlay').setAttribute('data-state', state);

    // Guest-facing copy is invitation-voiced, not machine-state ("Listening" reads
    // as surveillance). "Go ahead…" = your turn. The main button toggles talk/pause;
    // the separate End button always exits.
    var labels = {
      idle: 'Ready when you are',
      listening: 'Go ahead…',
      thinking: 'Thinking',
      speaking: 'Speaking'
    };
    $('gsbVoiceStatus').textContent = labels[state] || 'Ready when you are';
    // Primary button shows only while idle (CSS); once begun, End is the only
    // control — Close stops a reply by default, so there's no Pause or Skip.
    $('gsbVoiceMainBtnLabel').textContent = 'Begin Voice Chat';
  }

  function setTranscript(text, kind) {
    var el = $('gsbVoiceTranscript');
    el.textContent = text || '';
    el.className = 'gsb-voice-mode__transcript';
    if (kind === 'ai') el.classList.add('gsb-voice-mode__transcript--ai');
    else if (kind === 'user') el.classList.add('gsb-voice-mode__transcript--user');
  }

  function pushHistorySnippet(text, role) {
    var historyEl = $('gsbVoiceHistory');
    var item = document.createElement('div');
    item.className = 'gsb-voice-mode__history-item';
    var label = role === 'user' ? 'You said' : 'AI';
    item.textContent = label + ' · ' + text.substring(0, 80) + (text.length > 80 ? '…' : '');
    historyEl.appendChild(item);
    // Keep only last 2 items
    while (historyEl.children.length > 2) {
      historyEl.removeChild(historyEl.firstChild);
    }
  }

  function openVoiceMode() {
    if (!voice.sttSupported) {
      showVoiceToast('Hands-free voice mode requires speech recognition, which this browser does not support.', 4000);
      return;
    }
    analytics.track('voice_mode_used', {});
    voice.fullModeActive = true;
    voice.begun = false;
    $('gsbVoiceModeOverlay').setAttribute('data-open', 'true');
    // Gentle overlay: the voice UI lays over the EXISTING chat (webcam hero,
    // conditions, live thread all stay visible behind a soft veil). The control
    // panel takes the composer's spot; the thread is padded so new turns clear it.
    document.body.setAttribute('data-voice-active', 'true');
    setOrbState('idle');
    setTranscript('');
    if ($('gsbVoiceHistory')) $('gsbVoiceHistory').innerHTML = '';
    requestAnimationFrame(snapConversationToBottom);
    // Don't auto-start — "Begin Voice Chat" is the clear start.
  }

  function closeVoiceMode() {
    voice.fullModeActive = false;
    voice.begun = false;
    $('gsbVoiceModeOverlay').setAttribute('data-open', 'false');
    document.body.removeAttribute('data-voice-active');
    if (voice.recognition) {
      try { voice.recognition.stop(); } catch (e) { /* ignore */ }
    }
    if (voice.ttsSupported) window.speechSynthesis.cancel();
    setOrbState('idle');
  }

  // Stream an AI reply into the voice thread word-by-word, so answers visibly
  // arrive as a realtime conversation would. Falls back to the full text if voice
  // is exited mid-stream.
  function streamAiMessage(text, onDone) {
    var msg = document.createElement('div');
    msg.className = 'gsb-msg gsb-msg--ai';
    $('gsbMessages').appendChild(msg);
    body.classList.add('gsb-conversation-started');
    var words = (text || '').split(/\s+/);
    var i = 0;
    (function tick() {
      i++;
      msg.textContent = words.slice(0, i).join(' ');
      snapConversationToBottom();
      if (i < words.length && voice.fullModeActive) {
        setTimeout(tick, 45);
      } else {
        msg.textContent = text;
        snapConversationToBottom();
        if (onDone) onDone();
      }
    })();
    return msg;
  }

  function startVoiceModeListening() {
    if (!voice.fullModeActive) return;
    if (!voice.recognition) voice.recognition = initRecognition();
    var recog = voice.recognition;

    setOrbState('listening');
    setTranscript('');
    voice.interimTranscript = '';
    voice.finalTranscript = '';

    recog.onresult = function(event) {
      var interim = '';
      var final = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      voice.finalTranscript = (voice.finalTranscript + ' ' + final).trim();
      voice.interimTranscript = interim;
      var combined = (voice.finalTranscript + ' ' + interim).trim();
      setTranscript(combined, 'user');
    };

    recog.onerror = function(e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        showVoiceToast('Microphone permission was denied.', 3500);
        closeVoiceMode();
      } else if (e.error === 'no-speech') {
        // Restart listening after a brief pause
        setTimeout(function() {
          if (voice.fullModeActive && voice.fullModeOrbState !== 'speaking') {
            startVoiceModeListening();
          }
        }, 600);
      }
    };

    recog.onend = function() {
      if (!voice.fullModeActive) return;
      var finalText = (voice.finalTranscript + ' ' + voice.interimTranscript).trim();
      if (finalText.length > 1) {
        // Commit what the guest said as a bubble, then stream the AI reply.
        setOrbState('thinking');
        setTranscript('');
        setTimeout(function() {
          if (!voice.fullModeActive) return;
          appendMessage(finalText, 'user');
          var aiResponse = generateAiResponse(finalText);
          setTimeout(function() {
            if (!voice.fullModeActive) return;
            setOrbState('speaking');
            streamAiMessage(aiResponse);   // word-by-word reveal in the thread
            speak(aiResponse);             // TTS; its onend restarts listening
          }, 250);
        }, 400);
      } else {
        // No meaningful input — keep listening (continuous until End).
        setTimeout(function() { if (voice.fullModeActive) startVoiceModeListening(); }, 300);
      }
    };

    try {
      recog.start();
    } catch (e) {
      // Already running
    }
  }

  function handleVoiceMainBtn() {
    // The primary button is only visible while idle (see CSS) — it begins the
    // conversation. Once begun, the loop is continuous and End is the only control.
    if (voice.fullModeOrbState === 'idle') {
      voice.begun = true;
      startVoiceModeListening();
    }
  }

  // ============= EVENT WIRING =============
  // gsbLauncher binding removed — dashboard's previewLauncher drives openChat via window.gsbChatPreview API
  $('gsbChatClose').addEventListener('click', closeChat);
  $('gsbBackdrop').addEventListener('click', closeChat);

  // Variant pills binding removed — dashboard's Panel layout radio cards drive setVariant via window.gsbChatPreview API

  // ChatGPT-style action swap: Voice Mode shows when the input is empty, Send (↗)
  // once there's text. Driven by data-has-text on the composer row (see CSS).
  function syncComposerActions() {
    var inp = $('gsbComposerInput');
    var row = $('gsbComposerRow');
    if (inp && row) row.setAttribute('data-has-text', inp.value.trim() ? 'true' : 'false');
  }

  // Composer
  var composerInputEl = $('gsbComposerInput');
  if (composerInputEl) {
    composerInputEl.addEventListener('input', syncComposerActions);
    composerInputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserMessage(e.target.value);
        e.target.value = '';
        syncComposerActions();
      }
    });

    // ============= MOBILE KEYBOARD DETECTION =============
    // On phones, the soft keyboard rises and consumes ~40% of the viewport.
    // We detect this and set data-keyboard-up on body so CSS can collapse
    // non-essential chrome (hero shrinks, conditions/welcome/chips hide on
    // mobile only) to keep the conversation visible above the keyboard.
    //
    // iOS Safari needs both signals: focus/blur events alone aren't reliable
    // (focus fires before viewport actually resizes), and visualViewport
    // alone doesn't fire on the FIRST keyboard-open in some iOS versions.
    function setKeyboardUp(up) {
      if (up) document.body.setAttribute('data-keyboard-up', '');
      else document.body.removeAttribute('data-keyboard-up');
    }
    composerInputEl.addEventListener('focus', function() { setKeyboardUp(true); });
    composerInputEl.addEventListener('blur', function() { setKeyboardUp(false); });
    if (window.visualViewport) {
      var initialHeight = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', function() {
        var heightShrink = initialHeight - window.visualViewport.height;
        // 150px threshold filters out address-bar hide/show (~80px) and
        // catches genuine keyboard appearance (~300px+ on most phones).
        if (heightShrink > 150) setKeyboardUp(true);
        else setKeyboardUp(false);
      });
    }
  }
  $('gsbComposerSend').addEventListener('click', function() {
    var input = $('gsbComposerInput');
    handleUserMessage(input.value);
    input.value = '';
    syncComposerActions();
  });
  syncComposerActions();

  // Chip clicks
  document.querySelectorAll('.gsb-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      analytics.track('starter_clicked', { starter_text: chip.dataset.q || '' });
      handleUserMessage(chip.dataset.q);
    });
  });

  // Outbound-link clicks (conversion signal). Delegated so it catches links the AI
  // renders in replies AND the welcome / Season Update / featured / webcam links —
  // now, and in production where BotScrew renders the message links. Only fires for
  // links on a chat surface; destination is hostname+path (query/hash stripped).
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var ctx;
    if (a.closest('.gsb-msg')) ctx = 'message';
    else if (a.closest('.gsb-welcome-greeting')) ctx = 'welcome';
    else if (a.closest('.gsb-season-banner')) ctx = 'season_banner';
    else if (a.closest('#gsbHero')) {
      var hero = $('gsbHero');
      ctx = (hero && hero.getAttribute('data-hero-source') === 'webcam') ? 'webcam' : 'featured';
    } else return; // not a chat-surface link
    var href = a.getAttribute('href') || '';
    var dest = href;
    try { var u = new URL(href, location.href); dest = u.hostname + u.pathname; } catch (err) {}
    analytics.track('outbound_click', { destination: dest, context: ctx });
  });

  // Voice events
  $('gsbComposerMic').addEventListener('click', toggleComposerListening);
  $('gsbVoiceModeBtn').addEventListener('click', openVoiceMode);
  if ($('gsbVoiceModeExit')) $('gsbVoiceModeExit').addEventListener('click', closeVoiceMode);
  $('gsbVoiceMainBtn').addEventListener('click', handleVoiceMainBtn);
  if ($('gsbVoiceEndBtn')) $('gsbVoiceEndBtn').addEventListener('click', closeVoiceMode);

  // Escape key closes chat / voice mode
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (voice.fullModeActive) {
        closeVoiceMode();
      } else if (body.classList.contains('modal-open')) {
        closeChat();
      }
    }
  });

  // Pre-load voices for TTS (some browsers populate them async)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();  // prime cache
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = function() {
        window.speechSynthesis.getVoices();
      };
    }
  }

  // ============= INIT =============
  detectVoiceSupport();
  fetchAll().then(applyOpenMeteoWeather);


  // ============= PUBLIC API =============
  // Exposed for the dashboard's setOpen/render/layout-card handlers to call into.
  window.gsbChatPreview = {
    openChat: openChat,
    closeChat: closeChat,
    setVariant: setVariant,
    // Containment signal — host/ODIN calls this when routing to a live agent.
    handoffToHuman: handoffToHuman,
    refreshData: function() { return fetchAll().then(applyOpenMeteoWeather); },
    handleQuery: function(q) { handleUserMessage(q); },
    // Open-with-query: post the question + typing indicator and snap them into
    // view instantly as the panel expands from the launcher (used by the hero
    // search bar + starter chips). Avoids the "chat opens on the webcam hero,
    // then jumps to your question" feeling — the conversation is what you land on.
    startWithQuery: function(q) {
      if (!q || !q.trim()) return;
      conversationOpening = true;
      handleUserMessage(q);
      // Snap during the expand and once more after it settles, then release so
      // later messages resume smooth-scrolling.
      requestAnimationFrame(snapConversationToBottom);
      setTimeout(function() { snapConversationToBottom(); conversationOpening = false; }, 550);
    }
  };

})();

