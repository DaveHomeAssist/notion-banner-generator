import type { BannerContent, FontId, LayoutId, Palette, Typography } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, SAFE_AREA, resolveFont, GLYPH_FONT_STACK } from "./types";
import { readableInk, rgba } from "./palettes";
import { measureWidth } from "./fonts";
import type { Primitive } from "./scene";

// Typography + glyph placement, emitted as Scene primitives. Everything is
// anchored inside the safe area so text survives Notion's cover crop. Title
// auto-scales and wraps to <=2 lines. Phase 2 adds tracking, uppercase, and an
// optional legibility shadow.

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

export function layoutPrimitives(
  layout: LayoutId,
  content: BannerContent,
  palette: Palette,
  typography: Typography,
  glyph?: string,
): Primitive[] {
  const ink = readableInk(palette);
  const box = safeBox();
  const out: Primitive[] = [];

  switch (layout) {
    case "left-title-right-glyph":
      out.push(...titleBlock(content, typography, ink, { align: "left", x: box.x, cy: box.cy, maxW: box.w * 0.62 }));
      if (glyph) out.push(...glyphPrim(glyph, box.x + box.w * 0.84, box.cy, palette));
      break;
    case "centered-title":
    case "centered-title-orbit-pattern":
      out.push(...titleBlock(content, typography, ink, { align: "center", x: box.cx, cy: box.cy, maxW: box.w * 0.82 }));
      break;
    case "lower-left-title":
      out.push(...titleBlock(content, typography, ink, { align: "left", x: box.x, cy: box.y + box.h * 0.72, maxW: box.w * 0.7 }));
      break;
    case "split-block":
      out.push({ kind: "rectFill", x: box.x, y: box.cy - 70, w: 10, h: 140, color: palette.secondary });
      out.push(...titleBlock(content, typography, ink, { align: "left", x: box.x + 34, cy: box.cy, maxW: box.w * 0.7 }));
      break;
  }
  return out;
}

interface BlockOpts {
  align: "left" | "center";
  x: number;
  cy: number;
  maxW: number;
}

function titleBlock(content: BannerContent, typography: Typography, ink: string, opts: BlockOpts): Primitive[] {
  const font = resolveFont(typography.titleFont);
  const ls = typography.letterSpacing;
  let title = (content.title || "Untitled").trim();
  if (typography.uppercase) title = title.toUpperCase();
  let subtitle = content.subtitle?.trim();
  if (subtitle && typography.uppercase) subtitle = subtitle.toUpperCase();

  // Auto-scale: shrink until the wrapped title fits 2 lines.
  const fontId = typography.titleFont;
  let size = Math.round(96 * typography.scale);
  let lines: string[] = [];
  for (; size >= 30; size -= 2) {
    lines = wrap(title, opts.maxW, fontId, size, ls);
    if (lines.length <= 2) break;
  }

  const lineH = size * 1.12;
  const subSize = Math.round(size * 0.32);
  const subGap = subtitle ? subSize * 1.8 : 0;
  const totalH = lines.length * lineH + subGap;
  let y = opts.cy - totalH / 2 + size * 0.82;

  const shadow = typography.shadow ? { color: rgba("#000000", 0.45), blur: 18 } : undefined;
  const out: Primitive[] = [];
  for (const line of lines) {
    out.push({
      kind: "text",
      x: opts.x,
      y,
      text: line,
      font,
      size,
      weight: typography.weight,
      color: ink,
      align: opts.align,
      letterSpacing: ls,
      shadow,
    });
    y += lineH;
  }
  if (subtitle) {
    out.push({
      kind: "text",
      x: opts.x,
      y: y + subSize * 0.4,
      text: truncate(subtitle, opts.maxW, fontId, subSize, ls),
      font,
      size: subSize,
      weight: 500,
      color: rgba(ink, 0.72),
      align: opts.align,
      letterSpacing: ls,
      shadow,
    });
  }
  return out;
}

function glyphPrim(glyph: string, x: number, y: number, palette: Palette): Primitive[] {
  return [
    {
      kind: "text",
      x,
      y,
      text: glyph,
      font: GLYPH_FONT_STACK,
      size: 180,
      weight: 400,
      color: rgba(palette.accent, 0.92),
      align: "center",
      letterSpacing: 0,
      shadow: { color: rgba(palette.background, 0.8), blur: 24 },
    },
  ];
}

function wrap(text: string, maxW: number, fontId: FontId, size: number, ls: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (measureWidth(test, fontId, size, ls) > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function truncate(text: string, maxW: number, fontId: FontId, size: number, ls: number): string {
  if (measureWidth(text, fontId, size, ls) <= maxW) return text;
  let t = text;
  while (t.length > 1 && measureWidth(t + "…", fontId, size, ls) > maxW) t = t.slice(0, -1);
  return t + "…";
}
