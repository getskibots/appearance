# GetSkiBots Appearance — Overview & Handoff (read this first)

A simple front door to the repo. The deeper docs are listed at the bottom — but
you can get oriented from this one page.

---

## A note to the BotScrew team

We built this prototype to **slot into your existing widget**, not replace it. We did
our best to map every setting to your current `widgetSettings` shape and admin model
**as we understand them**, and to align with the framework BotScrew already has in place.
Where we've misread something, please treat our config contract as a well-intentioned
**starting point** — tell us and we'll adjust.

The division of labor we're proposing:

> **You keep** the loader, iframe, launcher, greeting popup, socket, flows, and APIs.
> **We provide** the new in-iframe widget UI, the Appearance dashboard, the config
> mapper, and the `gsbAppearance` extension.

---

## How it's built (and why it ports to React cleanly)

The prototype is intentionally **framework-agnostic vanilla JS** (Vite, no framework) —
so it isn't locked to anything and ports anywhere, including your React stack. The two
pieces you integrate are **pure and small**:

- **`applyWidgetConfig(config)`** ([`src/widget/apply-config.js`](../src/widget/apply-config.js)) — one function that turns a plain config object into the fully-styled widget (CSS variables + data-attributes). No framework, no state.
- **The config mapper** ([`src/shared/widget-config.js`](../src/shared/widget-config.js)) — plain data transforms (`to/fromBotscrewWidgetSettings`).

Dropping these into a React component is **wrapping them, not rewriting them.**

---

## The 3 things to integrate (how to import the key info)

1. **The config** — one JSON object in your `widgetSettings` shape: your **native fields**
   1:1, plus an opaque **`gsbAppearance`** block for everything new. Persist it per bot via
   your API (`GET/PATCH`). The mapper already emits/consumes this exact shape.
   → contract: [`botscrew-widget-settings.md`](./botscrew-widget-settings.md)
2. **The render** — feed that config to `applyWidgetConfig()`. The *same* function themes
   the demo and the real embed — **only the config source changes.**
3. **The host** — drop our UI into the iframe your existing **`script-chatbot.js`** already
   creates. Milestone 1 is an **iframe app-swap, not a loader rewrite.**
   → contract: [`SCRIPT-CHATBOT-CONTRACT.md`](./SCRIPT-CHATBOT-CONTRACT.md)

---

## What's in the Appearance tab (full inventory)

Eight collapsible cards:

1. **Identity & branding** — widget logo (upload/remove), brand color, chat-header color,
   logo max-height; widget name, welcome message (supports markdown links), recent-update
   banner (write-it-myself **or** connect a flow), input placeholder.
2. **Webcams & featured image** — hero source (Webcam / Featured image / None);
   **webcams (up to 3)** — URL or upload, auto-detected type with a change-override,
   title + subtitle, drag-reorder; **featured images (up to 3)** — URL or upload with
   crop/reposition, caption, optional tap-through link, drag-reorder; demo-page background
   (internal tool).
3. **Launcher** — style (Simple bubble / Status pill / Slide-in pill / Upload your own);
   status-pill features (live-agent indicator, weather readout, CTA) + CTA text;
   custom-icon size & effects; auto-hide-on-scroll; corner radius; launcher size;
   placement (corner + edge spacing).
4. **Animations & effects** — open animation (scale/slide/fade); typing indicator
   (dots/orb/label); message-bubble style (classic/elevated/squared); depth effect
   (none/shadow/glow/radiate + intensity); snowfall (realistic/crystalline/storm,
   intensity, show-on-mobile, pause-when-idle).
5. **Typography** — display font, body font (curated pairings), text size.
6. **Panel layout** — Side Panel / Full Panel; distance-from-edge (side only);
   blurred background.
7. **Behavior** — voice chat, sound notifications, pop-up message preview,
   ask-for-rating, disable text input.
8. **Embeddable components** — hero search bar (radius, thickness, width, placeholder,
   starter chips) and standalone search button (size, shape, background, icon weight,
   label), each with a copy-paste install snippet; demo-page background (internal).

*A line-by-line mapping of these against the agreed scope sheet is in
[`SCOPE-MAPPING.md`](./SCOPE-MAPPING.md); build status is in [`BUILD-STATUS.md`](./BUILD-STATUS.md).*

---

## Heads-up: Jackson Hole / demo-only code

The repo runs standalone by hardwiring a **Jackson Hole** demo (the knowledge base, the
keyword "AI" answers, baked feeds/coords/logo, demo seed copy). **None of that should be
ported** — it's all listed, with its production replacement, in
[`DEMO-CODE.md`](./DEMO-CODE.md). Rule of thumb: *if it renders a configured widget, keep
it; if it answers questions or carries Jackson Hole data, strip it.*

---

## Where to go deeper

| If you want… | Read |
|---|---|
| **Exactly which files to reuse / port / strip** | [`PORT-MAP.md`](./PORT-MAP.md) |
| What's built vs. pending | [`BUILD-STATUS.md`](./BUILD-STATUS.md) · [`SCOPE-MAPPING.md`](./SCOPE-MAPPING.md) |
| The data contract (Oleksa) | [`botscrew-widget-settings.md`](./botscrew-widget-settings.md) |
| The iframe / host-page contract | [`SCRIPT-CHATBOT-CONTRACT.md`](./SCRIPT-CHATBOT-CONTRACT.md) · [`INTEGRATION.md`](./INTEGRATION.md) |
| Code & runtime model | [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`HANDOFF.md`](./HANDOFF.md) |
| What to strip (demo code) | [`DEMO-CODE.md`](./DEMO-CODE.md) |
| Resort-owned weather feeds | [`RESORT-DIRECT-FEEDS.md`](./RESORT-DIRECT-FEEDS.md) |
