import type { Palette, PatternId } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";
import { rgba } from "./palettes";
import type { Rng } from "./rng";
import type { Primitive } from "./scene";

// Procedural pattern layer. Each pattern emits backend-agnostic Scene
// primitives (lines/circles/polylines) rather than drawing directly, so Canvas
// and SVG render identical geometry. All randomness flows through the seeded Rng.

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

export function patternPrimitives(
  pattern: PatternId,
  palette: Palette,
  rng: Rng,
): Primitive[] {
  switch (pattern) {
    case "none":
      return [];
    case "grid":
      return grid(palette);
    case "dots":
      return dots(palette);
    case "topographic":
      return topographic(palette, rng);
    case "radial-burst":
      return radialBurst(palette, rng);
    case "orbital-grid":
      return orbitalGrid(palette, rng);
    case "diagonal-rule":
      return diagonalRule(palette);
    case "waves":
      return waves(palette, rng);
    case "concentric":
      return concentric(palette, rng);
    case "halftone":
      return halftone(palette);
    case "mesh":
      return mesh(palette, rng);
  }
}

function grid(palette: Palette): Primitive[] {
  const step = 50;
  const out: Primitive[] = [];
  const stroke = rgba(palette.primary, 0.12);
  for (let x = step; x < W; x += step) out.push({ kind: "line", x1: x, y1: 0, x2: x, y2: H, stroke, width: 1 });
  for (let y = step; y < H; y += step) out.push({ kind: "line", x1: 0, y1: y, x2: W, y2: y, stroke, width: 1 });
  return out;
}

function dots(palette: Palette): Primitive[] {
  const step = 44;
  const fill = rgba(palette.primary, 0.16);
  const out: Primitive[] = [];
  for (let y = step; y < H; y += step) {
    for (let x = step; x < W; x += step) {
      out.push({ kind: "circle", cx: x, cy: y, r: 2.2, fill });
    }
  }
  return out;
}

function topographic(palette: Palette, rng: Rng): Primitive[] {
  const out: Primitive[] = [];
  const lines = 9;
  for (let i = 0; i < lines; i++) {
    const baseY = (H / (lines + 1)) * (i + 1);
    const amp = rng.range(12, 34);
    const freq = rng.range(0.004, 0.009);
    const phase = rng.range(0, Math.PI * 2);
    const points: Array<[number, number]> = [];
    for (let x = 0; x <= W; x += 6) points.push([x, baseY + Math.sin(x * freq + phase) * amp]);
    out.push({ kind: "polyline", points, stroke: rgba(palette.primary, 0.1 + (i % 2) * 0.05), width: 1.5 });
  }
  return out;
}

function radialBurst(palette: Palette, rng: Rng): Primitive[] {
  const cx = rng.range(W * 0.55, W * 0.8);
  const cy = rng.range(H * 0.3, H * 0.6);
  const rays = 48;
  const stroke = rgba(palette.secondary, 0.1);
  const out: Primitive[] = [];
  const len = Math.max(W, H);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + rng.range(-0.02, 0.02);
    out.push({ kind: "line", x1: cx, y1: cy, x2: cx + Math.cos(a) * len, y2: cy + Math.sin(a) * len, stroke, width: 1.2 });
  }
  return out;
}

function orbitalGrid(palette: Palette, rng: Rng): Primitive[] {
  const out: Primitive[] = grid(palette);
  const cx = rng.range(W * 0.6, W * 0.82);
  const cy = rng.range(H * 0.35, H * 0.62);
  const rings = 5;
  for (let i = 1; i <= rings; i++) {
    out.push({ kind: "circle", cx, cy, r: i * 46, stroke: rgba(palette.secondary, 0.18), width: 1.4 });
  }
  for (let i = 0; i < 3; i++) {
    const ring = rng.int(1, rings);
    const a = rng.range(0, Math.PI * 2);
    out.push({ kind: "circle", cx: cx + Math.cos(a) * ring * 46, cy: cy + Math.sin(a) * ring * 46, r: 4, fill: rgba(palette.accent, 0.8) });
  }
  return out;
}

function diagonalRule(palette: Palette): Primitive[] {
  const step = 38;
  const stroke = rgba(palette.primary, 0.1);
  const out: Primitive[] = [];
  for (let x = -H; x < W; x += step) out.push({ kind: "line", x1: x, y1: 0, x2: x + H, y2: H, stroke, width: 1 });
  return out;
}

// --- Phase 2 patterns ---

function waves(palette: Palette, rng: Rng): Primitive[] {
  // Stacked flowing sine bands across the full height.
  const out: Primitive[] = [];
  const bands = 14;
  const amp = rng.range(18, 30);
  const freq = rng.range(0.003, 0.006);
  for (let i = 0; i < bands; i++) {
    const baseY = (H / bands) * i + rng.range(-6, 6);
    const phase = i * 0.5 + rng.range(0, 1);
    const points: Array<[number, number]> = [];
    for (let x = 0; x <= W; x += 8) points.push([x, baseY + Math.sin(x * freq + phase) * amp]);
    out.push({ kind: "polyline", points, stroke: rgba(palette.primary, 0.08 + (i % 3) * 0.03), width: 1.4 });
  }
  return out;
}

function concentric(palette: Palette, rng: Rng): Primitive[] {
  // Off-canvas focal point with large concentric arcs — calm, premium.
  const cx = rng.range(W * 0.05, W * 0.25);
  const cy = rng.range(H * 0.1, H * 0.4);
  const out: Primitive[] = [];
  const rings = 16;
  for (let i = 1; i <= rings; i++) {
    out.push({ kind: "circle", cx, cy, r: i * 80, stroke: rgba(palette.primary, 0.07 + (i % 2) * 0.04), width: 1.6 });
  }
  return out;
}

function halftone(palette: Palette): Primitive[] {
  // Dot grid whose radius ramps left→right — classic print halftone gradient.
  const step = 30;
  const out: Primitive[] = [];
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const t = x / W; // 0..1
      const r = 1 + t * 6;
      out.push({ kind: "circle", cx: x, cy: y, r, fill: rgba(palette.primary, 0.18) });
    }
  }
  return out;
}

function mesh(palette: Palette, rng: Rng): Primitive[] {
  // Connected node mesh — a light "network" motif.
  const cols = 9;
  const rows = 4;
  const nodes: Array<[number, number]> = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = (W / cols) * c + rng.range(-18, 18);
      const y = (H / rows) * r + rng.range(-18, 18);
      nodes.push([x, y]);
    }
  }
  const idx = (r: number, c: number) => r * (cols + 1) + c;
  const out: Primitive[] = [];
  const stroke = rgba(palette.primary, 0.1);
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const [x, y] = nodes[idx(r, c)];
      if (c < cols) {
        const [nx, ny] = nodes[idx(r, c + 1)];
        out.push({ kind: "line", x1: x, y1: y, x2: nx, y2: ny, stroke, width: 1 });
      }
      if (r < rows) {
        const [nx, ny] = nodes[idx(r + 1, c)];
        out.push({ kind: "line", x1: x, y1: y, x2: nx, y2: ny, stroke, width: 1 });
      }
      out.push({ kind: "circle", cx: x, cy: y, r: 2.4, fill: rgba(palette.secondary, 0.5) });
    }
  }
  return out;
}
