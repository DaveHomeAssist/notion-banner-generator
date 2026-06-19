import type { FontId } from "./types";
import { DEFAULT_FONT } from "./types";
import { parseFontMetrics, type FontMetrics } from "./fontMetrics";

// Environment-agnostic font store + text measurement. The engine never loads
// files itself (no fs, no fetch) — a web loader and a Node loader each fetch the
// TTF bytes for their environment and call registerFont(). Because both call
// sites register the SAME font bytes and measurement is pure metric math
// (fontMetrics.ts), wrapping/scaling is byte-identical across browser and Node.

/** Logical font -> bundled TTF filename (under src/assets/fonts/). */
export const FONT_FILES: Record<FontId, string> = {
  Inter: "Inter.ttf",
  "JetBrains Mono": "JetBrainsMono.ttf",
  Lora: "Lora.ttf",
};

const store = new Map<FontId, FontMetrics>();

export function registerFont(id: FontId, data: ArrayBuffer): void {
  store.set(id, parseFontMetrics(data));
}

export function hasFont(id: FontId): boolean {
  return store.has(id);
}

/** True once every registry font is loaded — measurement is then exact. */
export function fontsReady(): boolean {
  return (Object.keys(FONT_FILES) as FontId[]).every((id) => store.has(id));
}

/**
 * Width of `text` at `sizePx` for `fontId`, including em letter-spacing.
 * Uses real glyph advances when the font is registered; otherwise a width
 * heuristic so the app still renders (slightly off) before fonts finish loading.
 */
export function measureWidth(
  text: string,
  fontId: FontId,
  sizePx: number,
  letterSpacingEm: number,
): number {
  const tracking = letterSpacingEm * sizePx * Math.max(0, [...text].length - 1);
  const metrics = store.get(fontId) ?? store.get(DEFAULT_FONT);
  if (metrics) return metrics.stringWidth(text, sizePx) + tracking;
  return [...text].length * sizePx * 0.55 + tracking; // pre-load fallback
}
