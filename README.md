# 🖼️ Notion Banner Generator

Local-first applet for generating polished Notion page covers through
**deterministic design rules**, with an optional AI enhancement layer (Phase 3).
Everything renders in your browser — standard compute never sends data anywhere.

- **Output:** 1500 × 600 PNG, Notion-cover ready
- **Runtime:** browser-local, no backend
- **Storage:** local presets + recent exports (localStorage)
- **AI:** optional enhancement layer, never required to generate

## Status — Phase 1 (Local compute MVP) ✅ built

The deterministic engine ships first, exactly as the concept doc's recommended
path: *build hybrid, but ship standard compute first.*

| Capability | State |
|---|---|
| 1500 × 600 live preview, pixel-accurate to export | ✅ |
| **Notion safe-area overlay** (crop guides, on by default) | ✅ |
| 6 built-in presets (gradient, blueprint, topographic, terminal, radial, editorial) | ✅ |
| Seeded, reproducible procedural variation + variation strip | ✅ |
| Layouts, patterns, textures, palette, typography controls | ✅ |
| PNG export + reproducible recipe JSON | ✅ |
| Save/fork presets, recent exports | ✅ |
| AI provider contract defined, stubbed | ✅ (inactive) |
| AI concept/palette/refiner generation | ⏳ Phase 3 |
| SVG export, batch variations, Tauri wrapper | ⏳ Phase 2 / 4 |

## Design decisions (vs. the concept doc)

Three decisions the concept doc left open were resolved before scaffolding:

1. **Render engine → Canvas API.** Simplest crisp-PNG path; SVG/Satori deferred
   until typography quality demands it.
2. **Safe-area overlay → moved into the MVP.** Notion crops covers; designing at
   full 1500 × 600 without the crop guide produces broken-looking banners. The
   overlay is a DOM layer over the preview, so it is never exported.
3. **`texture` is a first-class preset field.** The concept's AI output emitted
   `texture` but the preset type didn't have it — schema drift. Fixed: the AI
   layer's output maps 1:1 onto `BannerPreset`.

Plus: a **bundled font registry** (`FONT_REGISTRY`) so AI/imported font values
are validated, not silently substituted; and a defined **AI provider interface**
(`src/ai/providers.ts`) so the DaveLLM Router is one implementation, not a
special case.

## Architecture

```
src/
  engine/            # deterministic, framework-free render core
    types.ts         #   canonical schema + safe-area + font registry
    rng.ts           #   seeded PRNG (same seed => same pixels)
    palettes.ts      #   color math, readable-ink contrast
    patterns.ts      #   grid / dots / topographic / radial / orbital / diagonal
    textures.ts      #   noise / grain / vignette finishing pass
    layouts.ts       #   safe-area-anchored typography + glyph placement
    renderBanner.ts  #   bg -> pattern -> type -> texture pipeline
    exportImage.ts   #   offscreen PNG render + recipe + download
  data/
    presetSchema.ts  #   coercion/validation for untrusted presets
    defaultPresets.ts#   6 built-ins
    storage.ts       #   localStorage (swappable for Dexie later)
  ai/
    providers.ts     #   provider contract + Phase-3 stub + redaction
  components/        # React UI (BannerCanvas, panels, primitives)
  App.tsx            # orchestrator
```

The engine has **no React dependency** — it takes a canvas context and a
`{ preset, content }` input, so it can later run in a worker, Node, or a CLI.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  (typechecked)
npm run preview
```

### Verify visuals

```bash
npm run preview &                          # or: npx vite
node scripts/screenshot.mjs http://localhost:4173/notion-banner-generator/
# -> verify-app.png, verify-banner.png
```

## Deploy

Built for GitHub Pages project hosting. `vite.config.ts` sets
`base: /notion-banner-generator/` for production; override with `VITE_BASE`.

## Reproducibility

A banner is fully defined by `(preset + seed)`. The exported **recipe JSON**
captures the preset, seed, and dimensions, so any banner can be regenerated
byte-for-byte later. Editing the title/subtitle never reshuffles the art —
only the seed does.
