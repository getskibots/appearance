# GetSkiBots — Appearance Dashboard & Chat Widget

Refactor of a single-file prototype into a maintainable Vite multi-page app that
separates the **embeddable chat widget** from the **admin appearance dashboard**.

## Apps

- **`index.html`** — the appearance dashboard (admin UI BotScrew uses to configure
  the widget per resort).
- **`preview.html`** — a standalone live preview of the widget on a Jackson Hole
  resort-site mock.

Both pages share the same widget core under `src/widget`.

## Develop

```bash
npm install
npm run dev      # serves /index.html (dashboard) and /preview.html (preview)
```

- Dashboard: http://localhost:5173/index.html
- Preview:   http://localhost:5173/preview.html

```bash
npm run build    # emits both pages to dist/
npm run preview  # serves the production build
```

## Layout

```
src/
  shared/      design tokens, reset, color utilities (used by both apps)
  widget/      the embeddable chat widget (framework-agnostic vanilla JS)
  dashboard/   the admin appearance UI
  assets/      extracted static assets (sample logo, etc.)
```

## Provenance

The baseline (first commit) is a pristine import of the production prototype from
sharable.link. Every subsequent commit is an incremental, behavior-preserving
extraction — see commit history.
