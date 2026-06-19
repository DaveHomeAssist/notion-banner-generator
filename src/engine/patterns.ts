import type { Palette, PatternId } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";
import { rgba } from "./palettes";
import type { Rng } from "./rng";

// Procedural pattern layer. Every function draws onto the already-painted
// background using palette colors at low alpha so patterns read as texture, not
// foreground. All randomness flows through the seeded Rng for reproducibility.

type Ctx = CanvasRenderingContext2D;
const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

export function drawPattern(
  ctx: Ctx,
  pattern: PatternId,
  palette: Palette,
  rng: Rng,
): void {
  switch (pattern) {
    case "none":
      return;
    case "grid":
      return grid(ctx, palette);
    case "dots":
      return dots(ctx, palette);
    case "topographic":
      return topographic(ctx, palette, rng);
    case "radial-burst":
      return radialBurst(ctx, palette, rng);
    case "orbital-grid":
      return orbitalGrid(ctx, palette, rng);
    case "diagonal-rule":
      return diagonalRule(ctx, palette);
  }
}

function grid(ctx: Ctx, palette: Palette): void {
  const step = 50;
  ctx.save();
  ctx.strokeStyle = rgba(palette.primary, 0.12);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < W; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = step; y < H; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function dots(ctx: Ctx, palette: Palette): void {
  const step = 44;
  ctx.save();
  ctx.fillStyle = rgba(palette.primary, 0.16);
  for (let y = step; y < H; y += step) {
    for (let x = step; x < W; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function topographic(ctx: Ctx, palette: Palette, rng: Rng): void {
  // Stacked, horizontally-offset sine contours -> contour-map feel.
  ctx.save();
  ctx.lineWidth = 1.5;
  const lines = 9;
  for (let i = 0; i < lines; i++) {
    const baseY = (H / (lines + 1)) * (i + 1);
    const amp = rng.range(12, 34);
    const freq = rng.range(0.004, 0.009);
    const phase = rng.range(0, Math.PI * 2);
    ctx.strokeStyle = rgba(palette.primary, 0.1 + (i % 2) * 0.05);
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = baseY + Math.sin(x * freq + phase) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function radialBurst(ctx: Ctx, palette: Palette, rng: Rng): void {
  const cx = rng.range(W * 0.55, W * 0.8);
  const cy = rng.range(H * 0.3, H * 0.6);
  const rays = 48;
  ctx.save();
  ctx.strokeStyle = rgba(palette.secondary, 0.1);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + rng.range(-0.02, 0.02);
    const len = Math.max(W, H);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function orbitalGrid(ctx: Ctx, palette: Palette, rng: Rng): void {
  // Concentric rings + a faint grid: the "creative systems lab" motif.
  grid(ctx, palette);
  const cx = rng.range(W * 0.6, W * 0.82);
  const cy = rng.range(H * 0.35, H * 0.62);
  ctx.save();
  ctx.strokeStyle = rgba(palette.secondary, 0.18);
  ctx.lineWidth = 1.4;
  const rings = 5;
  for (let i = 1; i <= rings; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, i * 46, 0, Math.PI * 2);
    ctx.stroke();
  }
  // a couple of orbiting nodes
  ctx.fillStyle = rgba(palette.accent, 0.8);
  for (let i = 0; i < 3; i++) {
    const ring = rng.int(1, rings);
    const a = rng.range(0, Math.PI * 2);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * ring * 46, cy + Math.sin(a) * ring * 46, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function diagonalRule(ctx: Ctx, palette: Palette): void {
  const step = 38;
  ctx.save();
  ctx.strokeStyle = rgba(palette.primary, 0.1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -H; x < W; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
  }
  ctx.stroke();
  ctx.restore();
}
