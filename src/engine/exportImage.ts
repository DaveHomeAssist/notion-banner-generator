import type { BannerPreset, RenderInput } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";
import { renderBanner, effectiveSeed } from "./renderBanner";

// PNG export (MVP scope). Renders to a fresh offscreen full-resolution canvas so
// the export is always crisp 1500x600 and never includes the safe-area overlay
// (which lives only on the on-screen preview canvas).

export interface ExportResult {
  blob: Blob;
  filename: string;
  recipe: ExportRecipe;
}

/** The reproducibility record saved alongside an export. */
export interface ExportRecipe {
  preset: BannerPreset;
  title: string;
  subtitle?: string;
  seed: string;
  width: number;
  height: number;
}

export function buildRecipe(input: RenderInput): ExportRecipe {
  return {
    preset: input.preset,
    title: input.content.title,
    subtitle: input.content.subtitle,
    seed: effectiveSeed(input),
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };
}

/** filename convention: nbg_<slug>_<presetslug>.png */
export function exportFilename(input: RenderInput): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "untitled";
  return `nbg_${slug(input.content.title)}_${slug(input.preset.name)}.png`;
}

export async function renderToPng(input: RenderInput): Promise<ExportResult> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  renderBanner(ctx, input);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/png",
    );
  });

  return { blob, filename: exportFilename(input), recipe: buildRecipe(input) };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // give the browser a tick to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
