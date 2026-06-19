#!/usr/bin/env -S npx tsx
// Headless banner CLI. Imports ONLY from banner-core (the headless-safe
// surface) and renders an SVG in plain Node — no browser, no canvas. Optionally
// rasterizes to PNG via resvg (also no headless browser). This is the proof that
// the engine's Scene/SVG path runs server-side and is MCP-ready.
//
//   npx tsx cli/banner.ts --title "Quarterly Review" --preset "Radial Burst" --png
//   npx tsx cli/banner.ts --list

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { argv, exit, version } from "node:process";
import {
  defaultPresets,
  coercePreset,
  renderBannerSvg,
  registerFont,
  fontsReady,
  FONT_FILES,
  effectiveSeed,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type BannerPreset,
  type FontId,
  type RenderInput,
} from "../src/core/index";

// Load the bundled TTFs from disk: register for measurement + collect buffers
// for resvg rasterization. Same bytes the browser loads => identical layout.
function loadNodeFonts(): Buffer[] {
  const dir = fileURLToPath(new URL("../src/assets/fonts/", import.meta.url));
  const buffers: Buffer[] = [];
  for (const [id, file] of Object.entries(FONT_FILES)) {
    const buf = readFileSync(dir + file);
    registerFont(id as FontId, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    buffers.push(buf);
  }
  return buffers;
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        out[a.slice(2)] = next;
        i++;
      } else {
        out[a.slice(2)] = true;
      }
    }
  }
  return out;
}

function findPreset(idOrName?: string): BannerPreset {
  if (!idOrName) return defaultPresets[0];
  const q = idOrName.toLowerCase();
  return (
    defaultPresets.find((p) => p.id === idOrName || p.name.toLowerCase() === q) ??
    defaultPresets[0]
  );
}

const args = parseArgs(argv.slice(2));

if (args.list) {
  console.log("Built-in presets:");
  for (const p of defaultPresets) console.log(`  • ${p.name}  (id: ${p.id})`);
  exit(0);
}

const preset = findPreset(args.preset as string | undefined);
if (typeof args.seed === "string") preset.seed = args.seed;
if (typeof args.glyph === "string") preset.glyph = args.glyph;

const input: RenderInput = {
  preset: coercePreset(preset), // exercise the same validation the app uses
  content: {
    title: (args.title as string) ?? "Notion Banner Generator",
    subtitle: (args.subtitle as string) ?? "Rendered headless in Node — no browser",
  },
};

const fontBuffers = loadNodeFonts();

const t0 = performance.now();
const svg = renderBannerSvg(input);
const ms = (performance.now() - t0).toFixed(1);

const base = (args.out as string) ?? "nbg-cli-out";
const svgPath = `${base}.svg`;
writeFileSync(svgPath, svg);

let pngNote = "(skipped — pass --png)";
if (args.png) {
  // resvg-js rasterizes SVG → PNG with no headless browser.
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: CANVAS_WIDTH },
    font: { fontBuffers, loadSystemFonts: true, defaultFontFamily: "Inter" },
  });
  const png = resvg.render().asPng();
  const pngPath = `${base}.png`;
  writeFileSync(pngPath, png);
  pngNote = `${pngPath} (${(png.length / 1024).toFixed(1)} KB)`;
}

console.log(`
✓ Rendered headless in Node ${version} — no browser, no DOM.
  preset        : ${input.preset.name}
  seed          : ${effectiveSeed(input)}
  dimensions    : ${CANVAS_WIDTH} × ${CANVAS_HEIGHT}
  svg           : ${svgPath} (${(svg.length / 1024).toFixed(1)} KB, ${ms} ms)
  png           : ${pngNote}
  text metrics  : ${fontsReady() ? "exact — bundled fonts, identical to the web app" : "heuristic fallback (fonts not loaded)"}
`);
