# Default featured-hero images

These files back the **default Featured-image hero** on the demo (the example link).
They are referenced by the baked defaults in `src/dashboard/dashboard.js` and
`preview.html` as relative paths (`featured/<name>`), which Vite serves from here at
`/appearance/featured/<name>` on GitHub Pages and `/featured/<name>` locally.

Current files:

| File | Shown as | Caption |
|------|----------|---------|
| `summer.webp` | first slide | "Welcome to Teton Village" |
| `winter.webp` | second slide | "Aerial Tram" |

Notes:
- Anything in `public/` is copied verbatim into the build — it is **not** resized or
  compressed by the bundler. Export at roughly **1600×900 (16:9)** so the hero loads fast.
  (The in-dashboard *Upload* flow optimizes uploads; these baked defaults do not.)
- If you rename or add files here, update the `featuredImages` paths in
  `src/dashboard/dashboard.js` and `preview.html` to match.
- Captions/order can be changed in the Appearance editor; these are just the starting point.
- Replace freely — partners normally swap in their own promo images.
