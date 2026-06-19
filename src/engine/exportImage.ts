import type { BannerPreset, RenderInput } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";
import { renderBanner, renderBannerSvg, effectiveSeed } from "./renderBanner";
import { makeZip, blobToBytes } from "./zip";

// Export: PNG (raster) + SVG (vector) + batch ZIP. Each renders to a fresh
// offscreen full-resolution surface, so exports are crisp 1500x600 and never
// include the on-screen safe-area overlay.

export interface ExportRecipe {
  preset: BannerPreset;
  title: string;
  subtitle?: string;
  seed: string;
  width: number;
  height: number;
}

export function buildRecipe(input: RenderInput, seedOverride?: string): ExportRecipe {
  return {
    preset: input.preset,
    title: input.content.title,
    subtitle: input.content.subtitle,
    seed: seedOverride ?? effectiveSeed(input),
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "untitled";
}

export function exportFilename(input: RenderInput, ext: "png" | "svg"): string {
  return `nbg_${slug(input.content.title)}_${slug(input.preset.name)}.${ext}`;
}

function renderCanvas(input: RenderInput, seedOverride?: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  renderBanner(ctx, input, seedOverride);
  return canvas;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/png");
  });
}

export async function renderToPng(input: RenderInput): Promise<{ blob: Blob; filename: string }> {
  const blob = await canvasToPng(renderCanvas(input));
  return { blob, filename: exportFilename(input, "png") };
}

export function renderToSvg(input: RenderInput): { blob: Blob; filename: string } {
  const svg = renderBannerSvg(input);
  return {
    blob: new Blob([svg], { type: "image/svg+xml" }),
    filename: exportFilename(input, "svg"),
  };
}

/** Render N seeded variations + a manifest into a single ZIP. */
export async function exportBatch(input: RenderInput, count: number): Promise<{ blob: Blob; filename: string }> {
  const base = effectiveSeed(input);
  const files: { name: string; data: Uint8Array }[] = [];
  const manifest: ExportRecipe[] = [];

  for (let i = 0; i < count; i++) {
    const seed = `${base}#${i}`;
    const png = await canvasToPng(renderCanvas(input, seed));
    files.push({ name: `${slug(input.content.title)}_v${i + 1}.png`, data: await blobToBytes(png) });
    manifest.push(buildRecipe(input, seed));
  }

  const json = JSON.stringify({ batch: manifest }, null, 2);
  files.push({ name: "recipes.json", data: new TextEncoder().encode(json) });

  return {
    blob: makeZip(files),
    filename: `nbg_${slug(input.content.title)}_${count}-variations.zip`,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
