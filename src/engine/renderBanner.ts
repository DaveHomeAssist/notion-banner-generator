import type { RenderInput } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";
import { mix, rgba } from "./palettes";
import { createRng } from "./rng";
import { drawPattern } from "./patterns";
import { drawTexture } from "./textures";
import { drawLayout } from "./layouts";

// Deterministic render pipeline:
//   background -> pattern -> typography/glyph -> finishing texture
// Same (preset + content) always produces identical pixels because all
// randomness derives from a single seed string.

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

/** Seed actually used for a render. Purely preset-driven so "same seed + same
 * preset => same pixels" holds exactly, which is what makes variant adoption and
 * recipe replay reliable. Content text changes never silently reshuffle the art. */
export function effectiveSeed(input: RenderInput): string {
  return input.preset.seed || input.preset.id || input.preset.name;
}

export function renderBanner(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  seedOverride?: string,
): void {
  const { preset, content } = input;
  const rng = createRng(seedOverride ?? effectiveSeed(input));

  ctx.clearRect(0, 0, W, H);

  // 1. Background — diagonal gradient field derived from the palette.
  drawBackground(ctx, preset.palette.background, preset.palette.primary, rng);

  // 2. Procedural pattern layer.
  drawPattern(ctx, preset.pattern, preset.palette, rng);

  // 3. Typography + glyph (inside the safe area).
  drawLayout(
    ctx,
    preset.layout,
    content,
    preset.palette,
    preset.typography,
    preset.glyph,
  );

  // 4. Finishing texture pass.
  drawTexture(ctx, preset.texture, preset.palette, rng);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  background: string,
  primary: string,
  rng: ReturnType<typeof createRng>,
): void {
  // Subtle diagonal: background -> background tinted slightly toward primary.
  const tint = mix(background, primary, 0.14);
  const angle = rng.range(-0.25, 0.25);
  const x2 = W * (1 + Math.sin(angle));
  const y2 = H * (1 + Math.cos(angle));
  const g = ctx.createLinearGradient(0, 0, x2, y2);
  g.addColorStop(0, background);
  g.addColorStop(1, tint);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Faint corner glow for depth.
  const glow = ctx.createRadialGradient(
    W * rng.range(0.15, 0.4),
    H * rng.range(0.1, 0.4),
    0,
    W * 0.3,
    H * 0.3,
    W * 0.6,
  );
  glow.addColorStop(0, rgba(primary, 0.12));
  glow.addColorStop(1, rgba(primary, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}
