# GetSkiBots — Appearance Dashboard & Chat Widget

Refactor of a single-file prototype into a maintainable Vite multi-page app that
separates the **embeddable chat widget** from the **admin appearance dashboard**.

## Handoff / docs (start here)

| Doc | For |
|---|---|
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | **Start here** — orientation, run, repo map, integration boundary |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Code + runtime model, config flow, how to extend |
| [`docs/BUILD-STATUS.md`](docs/BUILD-STATUS.md) | What's done vs pending (where the build is) |
| [`docs/botscrew-widget-settings.md`](docs/botscrew-widget-settings.md) | The BotScrew data contract (authoritative) |
| [`docs/RESORT-DIRECT-FEEDS.md`](docs/RESORT-DIRECT-FEEDS.md) | Resort-feed audit + Resort Direct build plan |

## Apps

- **`index.html`** — the appearance dashboard (admin UI used to configure the
  widget per resort).
- **`preview.html`** — a standalone live preview of the widget on a Jackson Hole
  resort-site mock.
- **`weather.html`** — weather config tab: **Open-Meteo** (active) + **Resort Direct**
  (coming soon), as a two-card accordion. Source-aware save, live readings + chat preview.

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

The baseline (first commit) is a pristine import of the production prototype from
sharable.link. Every subsequent commit is an incremental, behavior-preserving
extraction — see commit history.
