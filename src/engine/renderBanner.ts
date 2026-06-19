import type { RenderInput } from "./types";
import { buildScene, effectiveSeed } from "./buildScene";
import { paintScene } from "./backends/canvasBackend";
import { sceneToSvg } from "./backends/svgBackend";

// Thin façade over the Scene pipeline. Builds the backend-agnostic Scene once,
// then hands it to a backend (Canvas for preview/PNG, SVG for vector export).

export { effectiveSeed } from "./buildScene";

export function renderBanner(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  seedOverride?: string,
): void {
  const scene = buildScene(input, seedOverride);
  paintScene(ctx, scene, seedOverride ?? effectiveSeed(input));
}

export function renderBannerSvg(input: RenderInput, seedOverride?: string): string {
  return sceneToSvg(buildScene(input, seedOverride));
}
