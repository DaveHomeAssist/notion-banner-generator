import type { Palette } from "../engine/types";
import { paletteSchemes, type PaletteScheme } from "../engine/palettes";
import type { BannerProvider } from "./providers";

// AI-assisted palette suggestions. An optional provider supplies a *color
// direction* (one palette via the existing recipe-intent contract); the
// deterministic color-harmony engine (paletteSchemes) then expands it into a
// cohesive set. With no provider — or on any failure — it derives the set from
// the current palette. Either way the output is a set of valid named palettes.

export interface PaletteSuggestionResult {
  suggestions: PaletteScheme[];
  source: "ai" | "fallback";
  notes: string[];
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const pick = (v: string | undefined, fallback: string): string =>
  v && HEX.test(v.trim()) ? v.trim() : fallback;

export async function suggestPalettes(
  context: string,
  base: Palette,
  opts: { provider?: BannerProvider | null } = {},
): Promise<PaletteSuggestionResult> {
  const provider = opts.provider ?? null;

  if (provider && context.trim()) {
    try {
      if (await provider.isAvailable()) {
        const intent = await provider.generateRecipeIntent(`Suggest a banner color direction for: ${context}`);
        const ip = intent.palette ?? {};
        const seed: Palette = {
          background: pick(ip.background, base.background),
          primary: pick(ip.primary, base.primary),
          secondary: pick(ip.secondary, base.secondary),
          accent: pick(ip.accent, base.accent),
        };
        return {
          suggestions: paletteSchemes(seed),
          source: "ai",
          notes: [`palettes from an AI-suggested base (${provider.label})`],
        };
      }
      return {
        suggestions: paletteSchemes(base),
        source: "fallback",
        notes: [`AI provider '${provider.label}' not reachable — derived from current colors`],
      };
    } catch (e) {
      return {
        suggestions: paletteSchemes(base),
        source: "fallback",
        notes: [`AI suggestion failed (${e instanceof Error ? e.message : String(e)}) — derived from current colors`],
      };
    }
  }

  return { suggestions: paletteSchemes(base), source: "fallback", notes: ["palettes derived from the current colors"] };
}
