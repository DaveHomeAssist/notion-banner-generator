import type { Palette, TextureId } from "./types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";
import { rgba } from "./palettes";
import type { Primitive } from "./scene";

// Finishing-pass textures, emitted as Scene primitives. Kept deliberately subtle
// so banners read as "designed", never noisy (the stated style goal).

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

export function texturePrimitives(texture: TextureId, palette: Palette): Primitive[] {
  switch (texture) {
    case "none":
      return [];
    case "subtle-noise":
      return [{ kind: "noise", intensity: 0.04 }];
    case "grain":
      return [{ kind: "noise", intensity: 0.08 }];
    case "vignette":
      return [
        {
          kind: "radialGradient",
          cx: W / 2,
          cy: H / 2,
          r0: Math.min(W, H) * 0.25,
          r1: Math.max(W, H) * 0.75,
          stops: [
            { offset: 0, color: rgba(palette.background, 0) },
            { offset: 1, color: rgba(palette.background, 0.55) },
          ],
        },
      ];
  }
}
