import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../types";
import type { Scene } from "../scene";
import { createRng } from "../rng";

// Rasterizes a Scene onto a 2D canvas context. The only Canvas-specific logic
// lives here; pattern/text/background geometry comes from the shared Scene.

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

export function paintScene(ctx: CanvasRenderingContext2D, scene: Scene, noiseSeed: string): void {
  ctx.clearRect(0, 0, W, H);
  for (const p of scene) {
    switch (p.kind) {
      case "rectFill":
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        break;
      case "linearGradient": {
        const g = ctx.createLinearGradient(p.x1, p.y1, p.x2, p.y2);
        for (const s of p.stops) g.addColorStop(clamp01(s.offset), s.color);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case "radialGradient": {
        const g = ctx.createRadialGradient(p.cx, p.cy, p.r0, p.cx, p.cy, p.r1);
        for (const s of p.stops) g.addColorStop(clamp01(s.offset), s.color);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case "line":
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.width;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
        break;
      case "polyline":
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.width;
        ctx.beginPath();
        p.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        break;
      case "circle":
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        if (p.fill) {
          ctx.fillStyle = p.fill;
          ctx.fill();
        }
        if (p.stroke) {
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = p.width ?? 1;
          ctx.stroke();
        }
        break;
      case "text":
        ctx.save();
        ctx.font = `${p.weight} ${p.size}px ${p.font}`;
        ctx.textAlign = p.align;
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = p.color;
        // letterSpacing is supported on modern canvas contexts; ignored if not.
        (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${p.letterSpacing}em`;
        if (p.shadow) {
          ctx.shadowColor = p.shadow.color;
          ctx.shadowBlur = p.shadow.blur;
        }
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
        break;
      case "noise":
        paintNoise(ctx, p.intensity, noiseSeed);
        break;
    }
  }
}

function paintNoise(ctx: CanvasRenderingContext2D, intensity: number, seed: string): void {
  // Sparse seeded speckle (full per-pixel noise is too slow at 1500x600).
  const rng = createRng(`noise:${seed}`);
  const count = Math.floor(W * H * intensity * 0.02);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, W);
    const y = rng.range(0, H);
    const v = rng.next() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, ${rng.range(0.02, 0.06)})`;
    ctx.fillRect(x, y, 1.3, 1.3);
  }
  ctx.restore();
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
