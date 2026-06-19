import type { RenderInput } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";
import { mix, rgba } from "./palettes";
import { createRng } from "./rng";
import { patternPrimitives } from "./patterns";
import { texturePrimitives } from "./textures";
import { layoutPrimitives } from "./layouts";
import type { Scene } from "./scene";

// Composes the full backend-agnostic Scene:
//   background -> pattern -> typography/glyph -> finishing texture
// Same (preset + seed) always yields the same Scene because all randomness
// derives from one seed string. Backends turn this Scene into PNG or SVG.

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

/** Purely preset-driven seed: "same seed + same preset => same scene" holds
 * exactly, which is what makes variant adoption and recipe replay reliable. */
export function effectiveSeed(input: RenderInput): string {
  return input.preset.seed || input.preset.id || input.preset.name;
}

export function buildScene(input: RenderInput, seedOverride?: string): Scene {
  const { preset, content } = input;
  const rng = createRng(seedOverride ?? effectiveSeed(input));
  const scene: Scene = [];

  // 1. Background — diagonal gradient field + corner glow.
  const bg = preset.palette.background;
  const tint = mix(bg, preset.palette.primary, 0.14);
  const angle = rng.range(-0.25, 0.25);
  scene.push({
    kind: "linearGradient",
    x1: 0,
    y1: 0,
    x2: W * (1 + Math.sin(angle)),
    y2: H * (1 + Math.cos(angle)),
    stops: [
      { offset: 0, color: bg },
      { offset: 1, color: tint },
    ],
  });
  scene.push({
    kind: "radialGradient",
    cx: W * rng.range(0.15, 0.4),
    cy: H * rng.range(0.1, 0.4),
    r0: 0,
    r1: W * 0.6,
    stops: [
      { offset: 0, color: rgba(preset.palette.primary, 0.12) },
      { offset: 1, color: rgba(preset.palette.primary, 0) },
    ],
  });

  // 2. Pattern layer.
  scene.push(...patternPrimitives(preset.pattern, preset.palette, rng));

  // 3. Typography + glyph.
  scene.push(...layoutPrimitives(preset.layout, content, preset.palette, preset.typography, preset.glyph));

  // 4. Finishing texture.
  scene.push(...texturePrimitives(preset.texture, preset.palette));

  return scene;
}
