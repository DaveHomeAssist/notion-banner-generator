// Golden contract smoke tests. These lock the visual/output invariants so future
// patterns, typography tweaks, AI refiners, or MCP tools can't quietly break a
// banner. Run with: npm test   (npx tsx tests/fixtures.test.ts)
import assert from "node:assert/strict";
import { Resvg } from "@resvg/resvg-js";
import {
  buildScene,
  renderBannerSvg,
  defaultPresets,
  paletteSchemes,
  buildImagePrompt,
  type RenderInput,
  type Primitive,
} from "../src/core/index";
import { luminance } from "../src/engine/palettes";
import { makeZip } from "../src/engine/zip";
import { loadNodeFonts } from "../node/fonts";

// Deterministic measurement needs the bundled fonts registered; paths feed resvg.
const fontFiles = loadNodeFonts();

const editorial = defaultPresets.find((p) => p.id === "builtin-editorial")!; // light bg, no glyph
const blueprint = defaultPresets.find((p) => p.id === "builtin-system-blueprint")!; // has glyph
const noGlyph = { ...editorial, glyph: undefined };

const titleLines = (input: RenderInput): Extract<Primitive, { kind: "text" }>[] =>
  buildScene(input).filter((p): p is Extract<Primitive, { kind: "text" }> => p.kind === "text");

let passed = 0;
let failed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name} — ${(e as Error).message}`);
  }
}

console.log("Golden render fixtures:\n");

await check("short title renders a single line", () => {
  assert.equal(titleLines({ preset: noGlyph, content: { title: "Hi" } }).length, 1);
});

await check("long title wraps and caps at 2 lines", () => {
  const lines = titleLines({
    preset: noGlyph,
    content: { title: "An Extremely Long Banner Title That Has To Wrap Onto Lines" },
  });
  assert.equal(lines.length, 2);
});

await check("light background uses dark ink (contrast)", () => {
  const [t] = titleLines({ preset: noGlyph, content: { title: "Hi" } });
  assert.ok(luminance(t.color) < 0.4, `ink too light: ${t.color}`);
});

await check("glyph preset places the glyph", () => {
  const prims = titleLines({ preset: blueprint, content: { title: "Hi" } });
  assert.ok(prims.some((p) => p.text === blueprint.glyph), "glyph primitive missing");
});

await check("SVG export is vector with real <text>", () => {
  const svg = renderBannerSvg({ preset: editorial, content: { title: "Hello" } });
  assert.ok(svg.startsWith("<svg") && svg.includes("</svg>"), "not an svg doc");
  assert.ok(svg.includes("<text"), "no <text> element");
});

await check("PNG rasterization has a valid PNG header", () => {
  const svg = renderBannerSvg({ preset: editorial, content: { title: "Hello" } });
  const png = new Resvg(svg, {
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Inter" },
  })
    .render()
    .asPng();
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

await check("ZIP writer emits a valid PK header", async () => {
  const zip = makeZip([{ name: "recipes.json", data: new TextEncoder().encode("{}") }]);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 2)], [0x50, 0x4b]);
});

await check("paletteSchemes yields several valid, distinct palettes", () => {
  const schemes = paletteSchemes(editorial.palette);
  assert.ok(schemes.length >= 6, `only ${schemes.length} schemes`);
  const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  for (const s of schemes) {
    for (const c of Object.values(s.palette)) assert.match(c, HEX, `bad color in ${s.name}: ${c}`);
  }
  assert.equal(schemes[0].name, "Original");
  assert.deepEqual(schemes[0].palette, editorial.palette); // Original is the base
  // at least one scheme actually differs from the base
  assert.ok(schemes.slice(1).some((s) => JSON.stringify(s.palette) !== JSON.stringify(editorial.palette)));
});

await check("buildImagePrompt describes the recipe (no text, palette, theme)", () => {
  const prompt = buildImagePrompt(blueprint, { title: "Systems Lab" });
  assert.match(prompt, /no text/i);
  assert.ok(prompt.includes(blueprint.palette.background));
  assert.ok(prompt.includes("Systems Lab"));
});

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
