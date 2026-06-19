import type { Palette, TextureId } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";
import { rgba } from "./palettes";
import type { Rng } from "./rng";

// Finishing-pass textures, drawn last over everything. Kept deliberately subtle
// so banners read as "designed", never noisy (the stated style goal).

type Ctx = CanvasRenderingContext2D;
const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

export function drawTexture(
  ctx: Ctx,
  texture: TextureId,
  palette: Palette,
  rng: Rng,
): void {
  switch (texture) {
    case "none":
      return;
    case "subtle-noise":
      return noise(ctx, rng, 0.04);
    case "grain":
      return noise(ctx, rng, 0.08);
    case "vignette":
      return vignette(ctx, palette);
  }
}

function noise(ctx: Ctx, rng: Rng, intensity: number): void {
  // Sparse monochrome speckle. Drawing individual pixels for 1500x600 is too
  // slow, so we stamp small translucent dots from the seeded stream.
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

function vignette(ctx: Ctx, palette: Palette): void {
  const g = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.25,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.75,
  );
  g.addColorStop(0, rgba(palette.background, 0));
  g.addColorStop(1, rgba(palette.background, 0.55));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
