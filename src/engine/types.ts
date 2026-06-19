// Canonical banner schema. The AI enhancement layer (Phase 3) emits objects
// that map 1:1 onto BannerPreset — there is no separate "AI shape" that drifts
// from the render shape. Every field the AI can influence lives here.

export type BannerMode = "standard" | "ai" | "hybrid";

/** Notion page covers are cropped. Canvas stays fixed; the crop is a viewport. */
export const CANVAS_WIDTH = 1500;
export const CANVAS_HEIGHT = 600;

/**
 * Notion renders a page cover at full width but vertically crops it to a band.
 * The visible band height depends on viewport, but content kept inside this
 * centered safe area survives every crop. These ratios drive the safe-area
 * overlay and the layout engine's vertical anchoring.
 */
export const SAFE_AREA = {
  // Fraction of height visible in Notion's default (uncentered) crop.
  topRatio: 0.21,
  bottomRatio: 0.79,
  // Horizontal inset Notion's UI chrome (title block) can overlap.
  leftRatio: 0.04,
  rightRatio: 0.96,
} as const;

export const LAYOUTS = [
  "left-title-right-glyph",
  "centered-title",
  "centered-title-orbit-pattern",
  "lower-left-title",
  "split-block",
] as const;
export type LayoutId = (typeof LAYOUTS)[number];

export const PATTERNS = [
  "none",
  "grid",
  "dots",
  "topographic",
  "radial-burst",
  "orbital-grid",
  "diagonal-rule",
] as const;
export type PatternId = (typeof PATTERNS)[number];

export const TEXTURES = ["none", "subtle-noise", "grain", "vignette"] as const;
export type TextureId = (typeof TEXTURES)[number];

/** Bundled, license-clear fonts. AI/import font values are validated against
 * this registry; unknown values fall back to the default rather than silently
 * substituting a system font. */
export const FONT_REGISTRY = {
  Inter: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  "JetBrains Mono": '"JetBrains Mono", ui-monospace, "SF Mono", monospace',
  Georgia: 'Georgia, "Times New Roman", serif',
  System: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;
export type FontId = keyof typeof FONT_REGISTRY;
export const DEFAULT_FONT: FontId = "Inter";

export interface Palette {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface Typography {
  titleFont: FontId;
  weight: number;
  scale: number;
}

/** Optional art-direction metadata produced by the AI layer. Render-irrelevant
 * but preserved so a banner's recipe can be reproduced and re-prompted. */
export interface AiBannerRecipe {
  concept: string;
  mood: string[];
  motifs: string[];
  prompt?: string;
  constraints?: string[];
}

export interface BannerPreset {
  id: string;
  name: string;
  mode: BannerMode;
  palette: Palette;
  layout: LayoutId;
  pattern: PatternId;
  /** First-class field — the AI preset refiner writes here directly. */
  texture: TextureId;
  typography: Typography;
  /** Short emoji or glyph placed by glyph-bearing layouts. */
  glyph?: string;
  /** Deterministic seed. Same seed + same preset + same content => same pixels. */
  seed?: string;
  aiRecipe?: AiBannerRecipe;
}

/** The text content laid onto a banner — kept separate from the visual preset
 * so one preset can render many pages. */
export interface BannerContent {
  title: string;
  subtitle?: string;
}

/** Everything renderBanner needs. */
export interface RenderInput {
  preset: BannerPreset;
  content: BannerContent;
}

export function resolveFont(font: string | undefined): string {
  if (font && font in FONT_REGISTRY) {
    return FONT_REGISTRY[font as FontId];
  }
  return FONT_REGISTRY[DEFAULT_FONT];
}

export function isFontId(value: string): value is FontId {
  return value in FONT_REGISTRY;
}
