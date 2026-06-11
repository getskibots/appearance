# Snowfall effect — parked for later integration

Removed from the active dashboard on **2026-06-11** (Brandon's call: pull it out of
the prototype for now, keep it fully recoverable). Everything needed to bring it
back lives in this folder — nothing is lost.

The snowfall effect is a weather overlay (falling flakes/streaks) rendered on the
chat surface, configurable in the Appearance tab (style + intensity + behavior).

## Files here
| File | Was in | What it is |
|---|---|---|
| `snow-engine.js` | `src/dashboard/dashboard.js` | The runtime flake/streak engine (an IIFE) |
| `dashboard-glue.js` | `src/dashboard/dashboard.js` | The scattered glue: DEFAULTS field, `render()` block, handlers, `setOpen`/`buildLivePreviewConfig` lines |
| `widget.css` | `src/widget/chat-widget.css` | The chat-surface overlay styles |
| `dashboard.css` | `src/dashboard/dashboard.css` | The style-card preview animations + `#snowfallControls` dim rules |
| `dashboard-section.html` | `index.html` | The Appearance-tab UI section |

## How to re-integrate
1. **Markup** (`index.html`)
   - Paste `dashboard-section.html` back into the Appearance section (it lived right
     after the Backdrop/Depth-effect field, before the **Choose widget color** field).
   - Add the overlay container back inside the chat panel markup, just before the
     `<!-- HEADER -->`:
     ```html
     <div class="gsb-snowfall" id="gsbSnowfall" aria-hidden="true"></div>
     ```
2. **Widget CSS** — prepend `widget.css` to `src/widget/chat-widget.css` (it was the
   very top block) and re-add "snowfall overlay" to that file's header comment.
3. **Dashboard CSS** — paste `dashboard.css` back into `src/dashboard/dashboard.css`.
4. **Dashboard JS** (`src/dashboard/dashboard.js`) — see `dashboard-glue.js`: paste the
   `SnowEngine` IIFE (`snow-engine.js`) before `// ============= STATE =============`,
   re-add the `DEFAULTS.snowfall` field, the `render()` snowfall block, the handlers,
   the two `SnowEngine.refresh()/clear()` calls in `setOpen`, and the
   `snowfall: state.snowfall` line in `buildLivePreviewConfig()`.
5. **BotScrew mapper** (`src/shared/widget-config.js`) — add `snowfall: state.snowfall,`
   back to `toGsbAppearance()`.
6. **Contract doc** (`docs/botscrew-widget-settings.md`) — re-add the `snowfall` field
   to the `GsbAppearance` TS interface and the unmapped-field table:
   ```ts
   snowfall: {
     enabled: boolean;
     style: 'realistic' | 'crystalline' | 'storm';
     intensity: number;               // 20–200 (flake count)
     showOnMobile: boolean;
     pauseWhenIdle: boolean;
     respectReducedMotion: boolean;   // a11y-locked, always true
   };
   ```

That's the whole feature. Re-integration is purely additive — none of the snowfall
code was entangled with anything else.
