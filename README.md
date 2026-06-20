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
| **`banner-core` headless boundary** + Node CLI (`npm run banner`) | ✅ R |
| **Deterministic text measurement** — byte-identical in browser + Node | ✅ R |
| Bundled OFL fonts (Inter, JetBrains Mono, Lora) — no system-font drift | ✅ R |
| Golden contract tests (`npm test`) | ✅ R |
| **Stdio MCP server** — 5 tools over banner-core (`npm run mcp`) | ✅ R |
| **AI provider adapters** (Ollama / LM Studio / OpenAI-compatible / DaveLLM Router) | ✅ P3A |
| **Freeform `create_recipe`** — context → recipe intent → coerced recipe (optional, graceful fallback) | ✅ P3A |
| **Web AI panel** — provider config + "describe page → generate" in the app (lazy-loaded; zod in a separate chunk) | ✅ P3B |
| AI palette/refiner suggestions + image-prompt builder | ⏳ Phase 3C |
| Tauri wrapper, preset packs, page-type recipes | ⏳ Phase 4 |

> **R = reliability layer** (MCP-readiness). Before exposing the renderer to AI
> agents, the core was made *boringly trustworthy*: a headless `banner-core`
> boundary, and **the same recipe renders identically in the browser and in
> Node**. Text is measured from bundled font bytes via a tiny dependency-free TTF
> reader (`fontMetrics.ts`), so wrapping/scaling is a pure function of the inputs
> — proven byte-identical across environments (`scripts/determinism.ts`). This
> also fixed a latent bug: the app never bundled a webfont, so the canvas was
> silently rendering in a fallback face.

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
  core/index.ts      # banner-core: the headless-safe public surface (import boundary)
  engine/            # deterministic, framework-free render core
    types.ts         #   canonical schema + safe-area + font registry
    rng.ts           #   seeded PRNG (same seed => same pixels)
    palettes.ts      #   color math, readable-ink contrast
    scene.ts         #   backend-agnostic primitive model (the shared IR)
    patterns.ts      #   11 patterns -> Scene primitives
    textures.ts      #   noise / grain / vignette -> Scene primitives
    layouts.ts       #   safe-area-anchored typography + glyph -> primitives
    fontMetrics.ts   #   dependency-free TTF reader (per-glyph advances)
    fonts.ts         #   env-agnostic registerFont + measureWidth + fontsReady
    buildScene.ts    #   bg -> pattern -> type -> texture, into one Scene
    backends/
      canvasBackend.ts #  Scene -> 2D canvas (preview + PNG)
      svgBackend.ts    #  Scene -> standalone SVG string (vector export)
    renderBanner.ts  #   façade: buildScene + pick a backend
    exportImage.ts   #   PNG + SVG + batch-ZIP export + recipes
    zip.ts           #   dependency-free STORED zip writer
  data/              # presetSchema (coercion), defaultPresets, storage
  ai/providers.ts    # provider contract + Phase-3 stub + redaction
  web/fonts.ts       # browser-only font loader (fetch buffers + FontFace)
  components/        # React UI (BannerCanvas, panels, primitives)
  assets/fonts/      # bundled OFL TTFs (Inter, JetBrains Mono, Lora)
  App.tsx            # orchestrator
cli/banner.ts        # headless CLI (imports only banner-core; SVG + resvg PNG)
tests/fixtures.test.ts  # golden contract tests (npm test)
scripts/determinism.ts  # proves measureWidth is identical browser vs Node
```

The engine has **no React dependency**, and `core/index.ts` exports only the
**headless-safe** surface (schema, Scene, SVG render, presets, measurement) — the
canvas/DOM bits are deliberately excluded, so the CLI/MCP can't accidentally pull
in browser code.

Two invariants make the output trustworthy:
1. **One source of truth (Scene).** The renderer builds a Scene of primitives;
   Canvas and SVG backends both consume it, so they can't visually drift.
2. **Pure measurement.** Text width comes from bundled font bytes
   (`fontMetrics.ts`), not the platform's `measureText` — so wrapping is
   identical in every browser and in Node. The same recipe is the same banner
   everywhere.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  (typechecked)
npm run preview
npm test           # golden contract fixtures
```

### Headless CLI (no browser)

`banner-core` renders without a DOM — this is what an MCP server will wrap.

```bash
npm run banner -- --list
npm run banner -- --title "Quarterly Review" --preset "Radial Burst" --png
# -> nbg-cli-out.svg + nbg-cli-out.png, "text metrics: exact"
```

### Verify visuals / determinism

```bash
npm run preview &                          # or: npx vite
node scripts/screenshot.mjs http://localhost:4173/notion-banner-generator/
npx tsx scripts/determinism.ts             # measureWidth: Node == browser
```

## Fonts

Bundled OFL fonts live in `src/assets/fonts/` (Inter, JetBrains Mono, Lora; see
`OFL.txt`). The same TTF bytes drive measurement, browser canvas rendering, and
Node/resvg rendering — which is what makes layout deterministic across
environments.

## MCP server

A stdio [MCP](https://modelcontextprotocol.io) server (`mcp/server.ts`) exposes
the generator as AI-callable tools — a thin wrapper over `banner-core`, so a
banner rendered by an agent is identical to one from the web app or CLI.

```bash
npm run mcp          # speak MCP over stdio
npm run mcp:smoke    # spawn the server + drive a real client through all 5 tools
```

| Tool | Purpose |
|---|---|
| `list_presets` | List built-in styles (call first to choose a `presetId`) |
| `create_recipe` | Turn title/subtitle/preset/seed/overrides into a validated recipe |
| `validate_recipe` | Coerce an arbitrary recipe to render-ready; reports what changed |
| `render_svg` | Vector SVG (returned inline + written to the sandbox) |
| `render_png` | 1500×600 PNG via resvg; returns a `file://` resource link |

Intended agent flow: **list_presets → create_recipe → (validate_recipe) →
render_svg / render_png**. Guardrails: stdout is reserved for the protocol (logs
go to stderr); exports are written only to a sandboxed dir (`NBG_EXPORTS_DIR`,
default `./exports`) — model-supplied paths are never honored; title/subtitle
are length-capped and all preset values are coerced.

Register it with an MCP client (e.g. Claude Desktop / Code):

```json
{
  "mcpServers": {
    "notion-banner": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/notion-banner-generator"
    }
  }
}
```

## AI providers (Phase 3 — optional)

AI is an **enhancement, never a dependency**. The app, CLI, and MCP server all
work with no provider configured. In the **web app**, the right-panel *AI
(optional)* section lets you pick a provider, paste page context, and "Generate"
— the AI layer (and zod) is **lazy-loaded** as a separate chunk, so it costs
nothing until used, and unreachable providers degrade to the deterministic
fallback. Via MCP, `create_recipe` takes the same freeform `context`. Crucially, the model only
emits a **recipe intent** (loose, all-optional fields) — that intent is mapped
onto a preset and run through the same `coercePreset` validation as everything
else, so **final rendering stays deterministic and valid no matter what the model
returns**. No image generation; no model-controlled file paths; PII/secrets are
redacted before any call.

The MCP server reads provider config from the environment:

| Var | Meaning |
|---|---|
| `NBG_AI_PROVIDER` | `ollama` \| `lmstudio` \| `openai-compatible` \| `davellm-router` (unset = AI off) |
| `NBG_AI_BASE_URL` | endpoint base (per-provider default otherwise) |
| `NBG_AI_MODEL` | model name |
| `NBG_AI_API_KEY` | Bearer token (held in memory only; for authenticated endpoints) |
| `NBG_AI_TIMEOUT_MS` | generation timeout (default 20000) |

Examples:

```bash
# Ollama (default http://localhost:11434)
NBG_AI_PROVIDER=ollama NBG_AI_MODEL=llama3 npm run mcp

# LM Studio (default http://localhost:1234/v1)
NBG_AI_PROVIDER=lmstudio NBG_AI_MODEL=local-model npm run mcp

# DaveLLM Router / any OpenAI-compatible endpoint (default http://localhost:8000/v1)
NBG_AI_PROVIDER=davellm-router NBG_AI_MODEL=router npm run mcp
NBG_AI_PROVIDER=openai-compatible NBG_AI_BASE_URL=http://host:port/v1 NBG_AI_API_KEY=… npm run mcp
```

Behaviour of `create_recipe`:
- **Explicit mode** (`title` + optional fields) — unchanged, fully deterministic.
- **Freeform mode** (`context`) — if a provider is configured and reachable, the
  recipe is AI-derived (`source: "ai"`); otherwise a **deterministic fallback**
  recipe is returned (`source: "fallback"`) with a `notes` array explaining why.
  Any provider error degrades to the same fallback — it never crashes.

## Deploy

Built for GitHub Pages project hosting. `vite.config.ts` sets
`base: /notion-banner-generator/` for production; override with `VITE_BASE`.

## Reproducibility

A banner is fully defined by `(preset + seed)`. The exported **recipe JSON**
captures the preset, seed, and dimensions, so any banner can be regenerated
byte-for-byte later. Editing the title/subtitle never reshuffles the art —
only the seed does.
