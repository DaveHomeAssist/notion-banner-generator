# 🖼️ Notion Banner Generator

Local-first applet for generating polished Notion page covers through
**deterministic design rules**, with an optional AI enhancement layer (Phase 3).
Everything renders in your browser — standard compute never sends data anywhere.

- **Output:** 1500 × 600 PNG, Notion-cover ready
- **Runtime:** browser-local, no backend
- **Storage:** local presets + recent exports (localStorage)
- **AI:** optional enhancement layer, never required to generate

**Live:** https://davehomeassist.github.io/notion-banner-generator/

## Status — Phase 1 ✅ + Phase 2 ✅ built

The deterministic engine ships first, exactly as the concept doc's recommended
path: *build hybrid, but ship standard compute first.*

| Capability | State |
|---|---|
| 1500 × 600 live preview, pixel-accurate to export | ✅ P1 |
| **Notion safe-area overlay** (crop guides, on by default) | ✅ P1 |
| 6 built-in presets (gradient, blueprint, topographic, terminal, radial, editorial) | ✅ P1 |
| Seeded, reproducible procedural variation + variation strip | ✅ P1 |
| Layouts, patterns, textures, palette, typography controls | ✅ P1 |
| PNG export + reproducible recipe JSON | ✅ P1 |
| Save/fork presets, recent exports | ✅ P1 |
| **Backend-agnostic Scene** — Canvas + SVG from one source of truth | ✅ P2 |
| 4 more patterns (waves, concentric, halftone, mesh) — 11 total | ✅ P2 |
| Typography polish: letter-spacing, uppercase, legibility shadow, measured fit | ✅ P2 |
| **SVG export** (vector text + feTurbulence noise) | ✅ P2 |
| **Batch variations** → dependency-free ZIP + recipes manifest | ✅ P2 |
| AI provider contract defined, stubbed | ✅ (inactive) |
| AI concept/palette/refiner generation | ⏳ Phase 3 |
| Tauri wrapper, preset packs, page-type recipes | ⏳ Phase 4 |

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
    scene.ts         #   backend-agnostic primitive model (the shared IR)
    patterns.ts      #   11 patterns -> Scene primitives
    textures.ts      #   noise / grain / vignette -> Scene primitives
    layouts.ts       #   safe-area-anchored typography + glyph -> primitives
    measure.ts       #   offscreen text measurement for wrap/fit
    buildScene.ts    #   bg -> pattern -> type -> texture, into one Scene
    backends/
      canvasBackend.ts #  Scene -> 2D canvas (preview + PNG)
      svgBackend.ts    #  Scene -> standalone SVG string (vector export)
    renderBanner.ts  #   façade: buildScene + pick a backend
    exportImage.ts   #   PNG + SVG + batch-ZIP export + recipes
    zip.ts           #   dependency-free STORED zip writer
  data/
    presetSchema.ts  #   coercion/validation for untrusted presets
    defaultPresets.ts#   6 built-ins
    storage.ts       #   localStorage (swappable for Dexie later)
  ai/
    providers.ts     #   provider contract + Phase-3 stub + redaction
  components/        # React UI (BannerCanvas, panels, primitives)
  App.tsx            # orchestrator
```

The engine has **no React dependency**. The key Phase 2 move is the **Scene** —
an ordered list of backend-agnostic primitives (`scene.ts`). The renderer builds
a Scene from `{ preset, content }`; a Canvas backend rasterizes it and an SVG
backend serializes it. One source of truth means Canvas and SVG **cannot visually
drift**, and new export formats are just new backends.

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
