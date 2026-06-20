import { z } from "zod";
import type { RenderInput, BannerPreset } from "../engine/types";
import { LAYOUTS, PATTERNS, TEXTURES, FONT_REGISTRY } from "../engine/types";
import { defaultPresets } from "../data/defaultPresets";
import { coercePreset } from "../data/presetSchema";

// The structured "recipe intent" an AI provider returns from freeform page
// context. Every field is OPTIONAL and loosely typed on purpose: the model is
// allowed to be wrong. Nothing here renders directly — intentToRenderInput maps
// it onto a base preset and runs the whole thing through coercePreset, so the
// final banner is always valid and deterministic regardless of model output.

export const recipeIntentSchema = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  mood: z.array(z.string().max(40)).max(8).optional(),
  presetId: z.string().max(80).optional(),
  palette: z
    .object({
      background: z.string().max(32).optional(),
      primary: z.string().max(32).optional(),
      secondary: z.string().max(32).optional(),
      accent: z.string().max(32).optional(),
    })
    .optional(),
  layout: z.string().max(60).optional(),
  pattern: z.string().max(60).optional(),
  texture: z.string().max(60).optional(),
  font: z.string().max(60).optional(),
  glyph: z.string().max(8).optional(),
  uppercase: z.boolean().optional(),
  seed: z.string().max(120).optional(),
});

export type RecipeIntent = z.infer<typeof recipeIntentSchema>;

export class IntentParseError extends Error {}

/** Pull a JSON object out of model output: tolerate code fences and surrounding
 * prose, then parse the first {...} block. Throws IntentParseError otherwise. */
export function extractJson(text: string): unknown {
  let t = (text ?? "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new IntentParseError("no JSON object found in model output");
  }
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    throw new IntentParseError("model output is not valid JSON");
  }
}

export function parseRecipeIntent(text: string): RecipeIntent {
  const parsed = recipeIntentSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new IntentParseError("model output did not match the recipe-intent schema");
  }
  return parsed.data;
}

/** System + user messages instructing the model to emit a RecipeIntent. The
 * valid enum values are listed so the model picks coercible values. */
export function buildMessages(context: string): { system: string; user: string } {
  const presetIds = defaultPresets.map((p) => p.id).join(", ");
  const fonts = Object.keys(FONT_REGISTRY).join(", ");
  const system = [
    "You turn a page description into a JSON recipe-intent for a Notion banner.",
    "Respond with ONLY a single JSON object — no prose, no code fences.",
    "All fields optional: title, subtitle, mood (string[]), presetId, palette {background,primary,secondary,accent}, layout, pattern, texture, font, glyph, uppercase (bool), seed.",
    "Use #hex colors only. Keep title <= 6 words. glyph is one emoji/symbol.",
    `Valid presetId: ${presetIds}.`,
    `Valid layout: ${LAYOUTS.join(", ")}.`,
    `Valid pattern: ${PATTERNS.join(", ")}.`,
    `Valid texture: ${TEXTURES.join(", ")}.`,
    `Valid font: ${fonts}.`,
    "Pick the closest valid value; anything invalid is ignored downstream.",
  ].join("\n");
  return { system, user: context };
}

/** First meaningful line of context as a title, markdown-stripped + length-capped. */
export function deriveTitle(context: string): string {
  const firstLine = (context ?? "").split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? "";
  const cleaned = firstLine
    .replace(/^#+\s*/, "")
    .replace(/[*_`>#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Untitled";
  const words = cleaned.split(" ");
  const short = words.length > 8 ? words.slice(0, 8).join(" ") : cleaned;
  return short.slice(0, 80) || "Untitled";
}

export function slugSeed(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "banner";
}

function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * Map a (possibly wrong) RecipeIntent onto a valid, reproducible RenderInput.
 * Invalid enum/color/font values are coerced to safe defaults by coercePreset;
 * the title falls back to one derived from the original context.
 */
export function intentToRenderInput(intent: RecipeIntent, originalContext = ""): RenderInput {
  const base =
    (intent.presetId && defaultPresets.find((p) => p.id === intent.presetId)) || defaultPresets[0];
  const draft = structuredClone(base) as BannerPreset & Record<string, unknown>;

  if (intent.palette) draft.palette = { ...draft.palette, ...defined(intent.palette) };
  if (intent.layout) draft.layout = intent.layout as BannerPreset["layout"];
  if (intent.pattern) draft.pattern = intent.pattern as BannerPreset["pattern"];
  if (intent.texture) draft.texture = intent.texture as BannerPreset["texture"];
  if (intent.glyph !== undefined) draft.glyph = intent.glyph;
  if (intent.font || intent.uppercase !== undefined) {
    draft.typography = { ...draft.typography };
    if (intent.font) draft.typography.titleFont = intent.font as BannerPreset["typography"]["titleFont"];
    if (intent.uppercase !== undefined) draft.typography.uppercase = intent.uppercase;
  }

  const title = (intent.title && intent.title.trim()) || deriveTitle(originalContext);
  draft.aiRecipe = { concept: title, mood: intent.mood ?? [], motifs: [] };

  const preset = coercePreset(draft, base.name);
  preset.seed = (intent.seed && intent.seed.trim()) || slugSeed(title);
  return { preset, content: { title, subtitle: intent.subtitle?.trim() || undefined } };
}
