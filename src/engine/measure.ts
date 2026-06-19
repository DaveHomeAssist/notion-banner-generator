// Text measurement. Layout needs to wrap/fit before any backend renders, so we
// measure against a shared offscreen 2D context. letterSpacing is added
// manually (per-gap) so the math is backend-independent and matches both the
// Canvas and SVG output.

let ctx: CanvasRenderingContext2D | null | undefined;

function measureCtx(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    const c =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(8, 8)
        : document.createElement("canvas");
    ctx = (c.getContext("2d") as CanvasRenderingContext2D | null) ?? null;
  } catch {
    ctx = null;
  }
  return ctx;
}

export function measureWidth(
  text: string,
  font: string,
  size: number,
  weight: number,
  letterSpacingEm: number,
): number {
  const c = measureCtx();
  const tracking = letterSpacingEm * size * Math.max(0, text.length - 1);
  if (!c) {
    // Fallback heuristic if no canvas is available (e.g. SSR): ~0.55em/char.
    return text.length * size * 0.55 + tracking;
  }
  c.font = `${weight} ${size}px ${font}`;
  return c.measureText(text).width + tracking;
}
