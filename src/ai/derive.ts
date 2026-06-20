import type { RenderInput } from "../engine/types";
import { defaultPresets } from "../data/defaultPresets";
import { coercePreset } from "../data/presetSchema";
import { deriveTitle, slugSeed, intentToRenderInput } from "./recipeIntent";
import type { BannerProvider } from "./providers";

// High-level entry point used by the MCP server / CLI: turn freeform page
// context into a render-ready recipe. AI is strictly optional — with no provider
// (or on any provider failure) it returns a deterministic fallback recipe and
// explains why in `notes`. It never throws and never renders.

export interface DerivedRecipe {
  input: RenderInput;
  notes: string[];
  source: "ai" | "fallback";
}

/** Deterministic, model-free recipe: title from context, default preset. */
export function fallbackRecipe(context: string): RenderInput {
  const title = deriveTitle(context);
  const preset = coercePreset(structuredClone(defaultPresets[0]), defaultPresets[0].name);
  preset.seed = slugSeed(title);
  return { preset, content: { title } };
}

export async function deriveRecipeFromContext(
  context: string,
  opts: { provider?: BannerProvider | null } = {},
): Promise<DerivedRecipe> {
  const provider = opts.provider ?? null;
  const notes: string[] = [];

  if (provider) {
    try {
      if (await provider.isAvailable()) {
        const intent = await provider.generateRecipeIntent(context);
        return {
          input: intentToRenderInput(intent, context),
          notes: [`recipe derived via AI: ${provider.label}`],
          source: "ai",
        };
      }
      notes.push(`AI provider '${provider.label}' not reachable`);
    } catch (e) {
      notes.push(`AI generation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    notes.push("no AI provider configured");
  }

  notes.push("used deterministic fallback recipe (title derived from context)");
  return { input: fallbackRecipe(context), notes, source: "fallback" };
}
