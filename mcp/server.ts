// Stdio MCP server over banner-core. Exposes the deterministic banner generator
// as AI-callable tools. It is a THIN wrapper: all logic lives in banner-core,
// which is headless and reproducible, so identical inputs yield identical
// banners here, in the CLI, and in the web app.
//
//   npm run mcp           # speak MCP over stdio
//
// Tools: list_presets -> create_recipe -> validate_recipe -> render_svg / render_png
//
// IMPORTANT: stdout is the MCP protocol channel — never write to it. All
// diagnostics go to stderr.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "node:process";
import {
  defaultPresets,
  coercePreset,
  renderBannerSvg,
  effectiveSeed,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type BannerPreset,
  type RenderInput,
} from "../src/core/index";
import { loadNodeFonts } from "../node/fonts";

// Deterministic measurement + resvg fonts (registered + file paths for resvg).
const fontFiles = loadNodeFonts();

// Sandboxed export directory — model-supplied paths are NEVER honored.
const EXPORTS_DIR = resolve(env.NBG_EXPORTS_DIR ?? "exports");
mkdirSync(EXPORTS_DIR, { recursive: true });

const MAX_TITLE = 200;
const MAX_SUBTITLE = 300;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "untitled";
}

function presetSummary(p: BannerPreset) {
  return {
    id: p.id,
    name: p.name,
    mode: p.mode,
    layout: p.layout,
    pattern: p.pattern,
    texture: p.texture,
    font: p.typography.titleFont,
    palette: p.palette,
    glyph: p.glyph,
  };
}

// Shared input shape for recipe-building / rendering tools.
const recipeFields = {
  title: z.string().min(1).max(MAX_TITLE).describe("Banner title text."),
  subtitle: z.string().max(MAX_SUBTITLE).optional().describe("Optional subtitle."),
  presetId: z.string().optional().describe("Built-in preset id (see list_presets). Defaults to the first preset."),
  seed: z.string().max(120).optional().describe("Deterministic seed; same seed + preset => same banner."),
  glyph: z.string().max(8).optional().describe("Optional emoji/symbol glyph."),
  preset: z.record(z.string(), z.unknown()).optional().describe("A full preset object (e.g. from create_recipe). Overrides presetId."),
  overrides: z.record(z.string(), z.unknown()).optional().describe("Partial preset overrides: palette, typography, layout, pattern, texture, glyph."),
};
type RecipeArgs = {
  title: string;
  subtitle?: string;
  presetId?: string;
  seed?: string;
  glyph?: string;
  preset?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
};

/** Build a validated RenderInput from loose args, a full preset, or overrides. */
function buildInput(a: RecipeArgs): RenderInput {
  let preset: BannerPreset;
  if (a.preset) {
    preset = coercePreset(a.preset);
  } else {
    const base = defaultPresets.find((p) => p.id === a.presetId) ?? defaultPresets[0];
    const m = structuredClone(base) as Record<string, unknown> & BannerPreset;
    const o = (a.overrides ?? {}) as Record<string, unknown>;
    if (o.palette && typeof o.palette === "object") m.palette = { ...m.palette, ...(o.palette as object) };
    if (o.typography && typeof o.typography === "object") m.typography = { ...m.typography, ...(o.typography as object) };
    for (const k of ["layout", "pattern", "texture", "glyph", "mode", "name"] as const) {
      if (o[k] !== undefined) (m as Record<string, unknown>)[k] = o[k];
    }
    preset = coercePreset(m, base.name);
  }
  if (a.seed) preset.seed = a.seed;
  if (a.glyph !== undefined) preset.glyph = a.glyph;
  return { preset, content: { title: a.title, subtitle: a.subtitle } };
}

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

const server = new McpServer({ name: "notion-banner-generator", version: "0.1.0" });

server.registerTool(
  "list_presets",
  {
    title: "List banner presets",
    description: "List the built-in deterministic banner styles. Call this first to pick a presetId for create_recipe / render_*.",
    inputSchema: {},
  },
  async () => text({ presets: defaultPresets.map(presetSummary) }),
);

server.registerTool(
  "create_recipe",
  {
    title: "Create a banner recipe",
    description:
      "Turn structured inputs (title, optional subtitle/preset/seed/glyph/overrides) into a validated, reproducible banner recipe. The recipe fully defines the banner; pass it to render_svg/render_png.",
    inputSchema: recipeFields,
  },
  async (a) => {
    const input = buildInput(a as RecipeArgs);
    return text({ preset: input.preset, content: input.content, seed: effectiveSeed(input) });
  },
);

server.registerTool(
  "validate_recipe",
  {
    title: "Validate / coerce a banner recipe",
    description:
      "Coerce an arbitrary recipe (or preset) into a valid, render-ready recipe. Invalid colors/fonts/enums fall back to safe defaults rather than failing. Returns the cleaned recipe and notes on what changed.",
    inputSchema: {
      recipe: z.record(z.string(), z.unknown()).describe("A recipe { preset, content } or a bare preset object."),
    },
  },
  async (a) => {
    const r = (a.recipe ?? {}) as Record<string, unknown>;
    const rawPreset = (r.preset ?? r) as Record<string, unknown>;
    const rawContent = (r.content ?? {}) as Record<string, unknown>;
    const preset = coercePreset(rawPreset);
    const title = typeof rawContent.title === "string" && rawContent.title.trim()
      ? rawContent.title.trim().slice(0, MAX_TITLE)
      : "Untitled";
    const notes: string[] = [];
    if (!rawPreset || typeof rawPreset !== "object") notes.push("no preset supplied — used defaults");
    if (rawPreset.layout && rawPreset.layout !== preset.layout) notes.push(`layout '${String(rawPreset.layout)}' invalid -> '${preset.layout}'`);
    if (rawPreset.pattern && rawPreset.pattern !== preset.pattern) notes.push(`pattern '${String(rawPreset.pattern)}' invalid -> '${preset.pattern}'`);
    const rawFont = (rawPreset.typography as Record<string, unknown> | undefined)?.titleFont;
    if (rawFont && rawFont !== preset.typography.titleFont) notes.push(`font '${String(rawFont)}' not bundled -> '${preset.typography.titleFont}'`);
    if (!rawContent.title) notes.push("no content.title — used 'Untitled'");
    return text({ valid: true, recipe: { preset, content: { title } }, notes });
  },
);

server.registerTool(
  "render_svg",
  {
    title: "Render banner as SVG",
    description:
      "Render a recipe to a vector SVG (real <text>, no rasterization). Returns the SVG inline and writes it to the sandboxed exports dir. Fastest output; ideal for further editing.",
    inputSchema: recipeFields,
  },
  async (a) => {
    const input = buildInput(a as RecipeArgs);
    const svg = renderBannerSvg(input);
    const file = `nbg_${slug(input.content.title)}_${slug(input.preset.name)}.svg`;
    const path = resolve(EXPORTS_DIR, file);
    writeFileSync(path, svg);
    return {
      content: [
        { type: "text" as const, text: svg },
        { type: "resource_link" as const, uri: `file://${path}`, name: file, mimeType: "image/svg+xml" },
      ],
    };
  },
);

server.registerTool(
  "render_png",
  {
    title: "Render banner as PNG",
    description:
      "Render a recipe to a 1500x600 PNG (rasterized via resvg, no browser). Writes to the sandboxed exports dir and returns a resource link plus metadata.",
    inputSchema: recipeFields,
  },
  async (a) => {
    const input = buildInput(a as RecipeArgs);
    const svg = renderBannerSvg(input);
    const { Resvg } = await import("@resvg/resvg-js");
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: CANVAS_WIDTH },
      font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Inter" },
    })
      .render()
      .asPng();
    const file = `nbg_${slug(input.content.title)}_${slug(input.preset.name)}.png`;
    const path = resolve(EXPORTS_DIR, file);
    writeFileSync(path, png);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { path, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, seed: effectiveSeed(input), bytes: png.length },
            null,
            2,
          ),
        },
        { type: "resource_link" as const, uri: `file://${path}`, name: file, mimeType: "image/png" },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[notion-banner-generator] MCP server ready on stdio · exports -> ${EXPORTS_DIR}`);
