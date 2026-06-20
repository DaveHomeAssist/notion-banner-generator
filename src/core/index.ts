// banner-core — the headless-safe public surface.
//
// This barrel is the import boundary between the pure, environment-agnostic
// engine (schema + Scene + SVG serialization) and the web-only bits
// (canvasBackend, DOM export in exportImage). Anything re-exported here is safe
// to CALL in Node, a worker, or a CLI — no `document`, no Canvas, no DOM.
//
// The web app keeps importing engine/* and data/* directly; the CLI and any
// future MCP server import ONLY from this file. If something browser-dependent
// ever sneaks into this surface, the headless CLI/MCP run breaks immediately —
// which is exactly the guard we want.

// --- Schema, types, constants ---
export type {
  BannerMode,
  BannerPreset,
  BannerContent,
  RenderInput,
  Palette,
  Typography,
  LayoutId,
  PatternId,
  TextureId,
  FontId,
  AiBannerRecipe,
} from "../engine/types";
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SAFE_AREA,
  LAYOUTS,
  PATTERNS,
  TEXTURES,
  FONT_REGISTRY,
  DEFAULT_FONT,
  resolveFont,
  isFontId,
} from "../engine/types";

// --- Scene model + SVG serialization (pure) ---
export type { Scene, Primitive, GradientStop } from "../engine/scene";
export { buildScene, effectiveSeed } from "../engine/buildScene";
export { sceneToSvg } from "../engine/backends/svgBackend";
/** Build a Scene and serialize it straight to an SVG string. Headless-safe. */
export { renderBannerSvg } from "../engine/renderBanner";

// --- Font metrics layer. Loaders (web/node) call registerFont with the same
// TTF bytes; measurement is then byte-identical across environments.
export {
  FONT_FILES,
  registerFont,
  measureWidth,
  fontsReady,
  hasFont,
} from "../engine/fonts";

// --- Presets + validation/coercion (pure) ---
export { defaultPresets, defaultPresetId } from "../data/defaultPresets";
export { coercePreset, forkPreset, makePresetId } from "../data/presetSchema";

// --- Recipe shape (pure type) ---
export type { ExportRecipe } from "../engine/exportImage";

// --- Optional AI layer (Phase 3). Fetch-based, headless-safe; never renders.
// The web app does not import this barrel, so zod stays out of the web bundle. ---
export type { ProviderKind, ProviderConfig, BannerProvider } from "../ai/providers";
export { createProvider, providerFromEnv, redactContext } from "../ai/providers";
export type { RecipeIntent } from "../ai/recipeIntent";
export {
  parseRecipeIntent,
  buildMessages,
  intentToRenderInput,
  deriveTitle,
  IntentParseError,
} from "../ai/recipeIntent";
export type { DerivedRecipe } from "../ai/derive";
export { deriveRecipeFromContext, fallbackRecipe } from "../ai/derive";
