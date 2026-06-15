# Embed snippets — per-page config via data attributes

How a resort drops GetSkiBots components onto their own pages, and how each page
carries **its own** placeholder + starter chips. Captures the contract for the
BotScrew embed-loader build (scope **7.1** + **3.1**).

> **Status:** the **dashboard + demo prototype is built** in this repo — the
> Appearance → *Embeddable components* card generates a live, copyable snippet from
> the chips you type, and both the dashboard preview and the demo hero render the
> chips live (`applyWidgetConfig` → `.gsb-embed-starters`). **Not built:** the
> production embed **loader** that reads these attributes off a host page and mounts
> the component (Epic 7).

---

## The three drop-in tags

One script tag in the site `<head>` (site-wide), then any of these divs wherever
the resort wants that entry point:

```html
<div data-gsb-search></div>          <!-- hero search bar -->
<div data-gsb-search-button></div>   <!-- standalone magnifying-glass button -->
<!-- the main chat launcher is the existing install script, unchanged -->
```

## Per-page config on `data-gsb-search`

The search bar reads its **placeholder** and **starter chips** from data attributes,
so the *same script* yields *different chips per page* just by changing the div:

| Attribute | Meaning | Format |
|---|---|---|
| `data-gsb-placeholder` | Input placeholder for this page | plain text |
| `data-gsb-starters` | Suggested chips shown beneath the bar (0–4) | **`|`-delimited** list |

**Pipe-delimited** (not JSON) on purpose — no nested-quote escaping, and a marketer
can edit it safely. 0–4 items; omit the attribute (or leave it empty) for a
placeholder-only bar.

### Homepage
```html
<div data-gsb-search
     data-gsb-placeholder="Enter your question"
     data-gsb-starters="Where should beginners ski?|What do lift tickets cost?|Are the lifts open today?"></div>
```

### Lessons page
```html
<div data-gsb-search
     data-gsb-placeholder="Ask about lessons & packages"
     data-gsb-starters="Book adult ski lessons|First-timer packages|Do you have kids' lessons?"></div>
```

Same `<head>` script on both pages — only the div changes. That's the
"drop it in, each page with its own chips" flow.

### Editing chips by hand (no dashboard round-trip)

You don't have to reconfigure in the dashboard for every page. Copy the snippet
once, then **edit the `data-gsb-starters` value directly** — each chip is separated
by a `|` (up to 4). Easiest workflow: paste the snippet into a text file, change the
chips for that page, and paste the result onto the page. The dashboard's generated
snippet is just a convenient starting point.

## Behavior

- Chips render beneath the bar (`.gsb-embed-starters`, brand-pill style, hidden when empty).
- Clicking a chip (or submitting the bar) opens the chat and sends the text as the
  first user message — same path the hero search submit uses.
- Styling (radius / thickness / width) comes from the platform appearance config, not
  per-page — resorts don't hand-style the widget.

## Two configuration models

| Model | How | Trade-off |
|---|---|---|
| **Inline** (this doc) | Resort writes chips in the div's `data-gsb-starters` | Self-contained, dev-owned, fastest; content lives in page HTML |
| **Admin-managed** (future) | Div carries `data-gsb-page="lessons"`; admin sets per-URL chips in the dashboard; loader fetches the right set | Central control / marketing-owned; needs the per-URL admin UI + match logic (not built) |

Recommendation: ship **inline as the primary**; allow an optional `data-gsb-page` key
later for resorts that want the admin to own the content. Inline can always override.

## What the production loader must do (Epic 7)

1. Find every `[data-gsb-search]` on the page.
2. Mount the `.gsb-embed-search` component into it.
3. Read `data-gsb-placeholder` / `data-gsb-starters` (split on `|`, trim, cap at 4) and
   feed them through `applyWidgetConfig({ embedSearch: { placeholder, starters } })`.
4. Wire chip clicks + submit to open the bot chat with the query (`publicIdentifier`).

The rendering half (steps 2–3, chip markup + styling) is already implemented in
`src/widget/apply-config.js` + `src/widget/chat-widget.css`; the loader (steps 1, 4)
is the net-new production work.

See also: [INTEGRATION.md](./INTEGRATION.md) (embed model + seams), [BUILD-STATUS.md](./BUILD-STATUS.md) §3 + §7.
