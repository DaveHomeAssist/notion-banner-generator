import type { BannerContent, BannerPreset } from "./types";

// Deterministic text-to-image prompt built from a recipe. Pure (no AI, no
// rendering) — it just describes the banner so the user can paste it into an
// external image model. We do NOT generate images here; this is the recipe in
// natural language. Stable input => stable prompt.

const PATTERN_DESC: Record<string, string> = {
  none: "a smooth gradient field",
  grid: "a subtle blueprint grid",
  dots: "a fine dot matrix",
  topographic: "soft topographic contour lines",
  "radial-burst": "a faint radial burst",
  "orbital-grid": "an orbital grid with concentric rings",
  "diagonal-rule": "diagonal rule lines",
  waves: "flowing wave bands",
  concentric: "large concentric arcs",
  halftone: "a halftone dot gradient",
  mesh: "a light connected node mesh",
};

const TEXTURE_DESC: Record<string, string> = {
  none: "a flat finish",
  "subtle-noise": "a subtle film-grain finish",
  grain: "a grainy finish",
  vignette: "a soft vignette",
};

export function buildImagePrompt(preset: BannerPreset, content: BannerContent): string {
  const { palette, layout } = preset;
  const mood = preset.aiRecipe?.mood?.length ? preset.aiRecipe.mood.join(", ") : "";
  const motifs = preset.aiRecipe?.motifs?.length ? preset.aiRecipe.motifs.join(", ") : "";

  const parts = [
    "A clean abstract banner image, 1500x600, no text and no lettering.",
    `Background ${pattern(preset.pattern)} with ${texture(preset.texture)}.`,
    `Color palette: background ${palette.background}, primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}.`,
    mood ? `Mood: ${mood}.` : "",
    motifs ? `Motifs: ${motifs}.` : "",
    content.title ? `Theme: ${content.title}.` : "",
    `Composition: ${layout.replace(/-/g, " ")}, modern editorial, vector-like, minimal.`,
  ];
  return parts.filter(Boolean).join(" ");
}

function pattern(id: string): string {
  return PATTERN_DESC[id] ?? "a clean background";
}
function texture(id: string): string {
  return TEXTURE_DESC[id] ?? "a flat finish";
}
