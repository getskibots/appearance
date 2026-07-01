# GetSkiBots — Appearance Dashboard & Chat Widget

Refactor of a single-file prototype into a maintainable Vite multi-page app that
separates the **embeddable chat widget** from the **admin appearance dashboard**.

## Handoff / docs (start here)

| Doc | For |
|---|---|
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md) | **Read this first** — one-page overview: how it ports, what to integrate, the Appearance-tab inventory, demo-code heads-up |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Engineering start — orientation, run, repo map, integration boundary |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Code + runtime model, config flow, how to extend |
| [`docs/BUILD-STATUS.md`](docs/BUILD-STATUS.md) | What's done vs pending (where the build is) |
| [`docs/SCOPE-MAPPING.md`](docs/SCOPE-MAPPING.md) | Status mapped line-by-line against the scope sheet (epics 1–7) |
| [`docs/PORT-MAP.md`](docs/PORT-MAP.md) | Exactly which files to reuse / port / strip (start here for the port) |
| [`docs/DEMO-CODE.md`](docs/DEMO-CODE.md) | Jackson Hole / demo-only code to strip (don't port) vs. the deliverable |
| [`docs/ANALYTICS.md`](docs/ANALYTICS.md) | Chat-widget GA4 event layer — events fired, BotScrew signals to map, roadmap |
| [`docs/botscrew-widget-settings.md`](docs/botscrew-widget-settings.md) | The BotScrew data contract (authoritative) |
| [`docs/SCRIPT-CHATBOT-CONTRACT.md`](docs/SCRIPT-CHATBOT-CONTRACT.md) | The host-page loader / parent↔iframe contract (Milestone 1 target) |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | How the widget drops into BotScrew's embed — iframe/snippet model, seams, content provenance |
| [`docs/RESORT-DIRECT-FEEDS.md`](docs/RESORT-DIRECT-FEEDS.md) | Resort-feed audit + Resort Direct build plan |

## Apps

- **`index.html`** — the appearance dashboard (admin UI used to configure the
  widget per resort).
- **`preview.html`** — a standalone live preview of the widget on a Jackson Hole
  resort-site mock.
- **`weather.html`** — weather config tab: a vertical stack of source cards — **Open-Meteo**
  (live; drives the 6-cell conditions card, Jackson Hole / Summer demo defaults) + **Direct
  Feed** and **SnoCountry** (parked, "Coming soon" — engines built but dormant). Live readings
  + chat preview.

## Develop

```bash
npm install
npm run dev      # serves index.html (dashboard), preview.html, weather.html
npm run build    # emits all pages to dist/
npm run preview  # serves the production build
```

Live demo (auto-deploys on push to `main`): https://getskibots.github.io/appearance/

## Layout

```
src/
  shared/      design tokens, reset, color utilities, weather adapter, config mapper
  widget/      the embeddable chat widget (framework-agnostic vanilla JS)
  dashboard/   the admin appearance UI
  assets/      extracted static assets (sample logo, etc.)
```

## Provenance

The baseline (first commit) is a pristine import of the production chat prototype.
Every subsequent commit is an incremental, behavior-preserving extraction — see
commit history.
