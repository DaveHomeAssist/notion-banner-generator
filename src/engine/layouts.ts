import type { BannerContent, LayoutId, Palette, Typography } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, SAFE_AREA, resolveFont } from "./types";
import { readableInk, rgba } from "./palettes";

// Typography + glyph placement. Everything is anchored inside the safe area so
// text survives Notion's cover crop. Title auto-scales and wraps to <=2 lines.

type Ctx = CanvasRenderingContext2D;
const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

interface SafeBox {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export function safeBox(): SafeBox {
  const x = W * SAFE_AREA.leftRatio;
  const y = H * SAFE_AREA.topRatio;
  const w = W * (SAFE_AREA.rightRatio - SAFE_AREA.leftRatio);
  const h = H * (SAFE_AREA.bottomRatio - SAFE_AREA.topRatio);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

export function drawLayout(
  ctx: Ctx,
  layout: LayoutId,
  content: BannerContent,
  palette: Palette,
  typography: Typography,
  glyph?: string,
): void {
  const ink = readableInk(palette);
  const box = safeBox();

  switch (layout) {
    case "left-title-right-glyph":
      drawTitleBlock(ctx, content, typography, ink, palette, {
        align: "left",
        x: box.x,
        cy: box.cy,
        maxW: box.w * 0.62,
      });
      if (glyph) drawGlyph(ctx, glyph, box.x + box.w * 0.84, box.cy, palette);
      break;

    case "centered-title":
    case "centered-title-orbit-pattern":
      drawTitleBlock(ctx, content, typography, ink, palette, {
        align: "center",
        x: box.cx,
        cy: box.cy,
        maxW: box.w * 0.82,
      });
      break;

    case "lower-left-title":
      drawTitleBlock(ctx, content, typography, ink, palette, {
        align: "left",
        x: box.x,
        cy: box.y + box.h * 0.72,
        maxW: box.w * 0.7,
      });
      break;

    case "split-block":
      // accent bar on the left edge of the safe area
      ctx.save();
      ctx.fillStyle = palette.secondary;
      ctx.fillRect(box.x, box.cy - 70, 10, 140);
      ctx.restore();
      drawTitleBlock(ctx, content, typography, ink, palette, {
        align: "left",
        x: box.x + 34,
        cy: box.cy,
        maxW: box.w * 0.7,
      });
      break;
  }
}

interface BlockOpts {
  align: "left" | "center";
  x: number;
  cy: number;
  maxW: number;
}

function drawTitleBlock(
  ctx: Ctx,
  content: BannerContent,
  typography: Typography,
  ink: string,
  palette: Palette,
  opts: BlockOpts,
): void {
  const font = resolveFont(typography.titleFont);
  const title = (content.title || "Untitled").trim();
  const subtitle = content.subtitle?.trim();

  // Auto-scale: start large, shrink until the (wrapped) title fits 2 lines.
  let size = Math.round(96 * typography.scale);
  let lines: string[] = [];
  for (; size >= 30; size -= 2) {
    ctx.font = `${typography.weight} ${size}px ${font}`;
    lines = wrap(ctx, title, opts.maxW);
    if (lines.length <= 2) break;
  }

  const lineH = size * 1.12;
  const subSize = Math.round(size * 0.32);
  const subGap = subtitle ? subSize * 1.8 : 0;
  const totalH = lines.length * lineH + subGap;
  let y = opts.cy - totalH / 2 + size * 0.82;

  ctx.save();
  ctx.textAlign = opts.align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;
  ctx.font = `${typography.weight} ${size}px ${font}`;
  for (const line of lines) {
    ctx.fillText(line, opts.x, y);
    y += lineH;
  }
  if (subtitle) {
    ctx.font = `500 ${subSize}px ${font}`;
    ctx.fillStyle = rgba(ink, 0.72);
    ctx.fillText(truncate(ctx, subtitle, opts.maxW), opts.x, y + subSize * 0.4);
  }
  ctx.restore();

  void palette;
}

function drawGlyph(
  ctx: Ctx,
  glyph: string,
  x: number,
  y: number,
  palette: Palette,
): void {
  ctx.save();
  ctx.font = `400 180px ${resolveFont("System")}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // soft halo so emoji/glyph sits on busy patterns
  ctx.shadowColor = rgba(palette.background, 0.8);
  ctx.shadowBlur = 24;
  ctx.fillText(glyph, x, y);
  ctx.restore();
}

function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function truncate(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) {
    t = t.slice(0, -1);
  }
  return t + "…";
}
