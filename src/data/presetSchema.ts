import type { BannerPreset } from "../engine/types";
import {
  LAYOUTS,
  PATTERNS,
  TEXTURES,
  isFontId,
  DEFAULT_FONT,
} from "../engine/types";

// Validation / coercion for presets coming from anywhere untrusted: localStorage,
// imported JSON, or the AI layer. Anything invalid is coerced to the nearest
// safe value rather than throwing — a malformed preset should still render.

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim())
    ? value.trim()
    : fallback;
}

function oneOf<T extends readonly string[]>(
  value: unknown,
  options: T,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && (options as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
}

let idCounter = 0;
/** Deterministic-enough id without Date.now/Math.random (both unreliable here). */
export function makePresetId(name: string): string {
  idCounter += 1;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "preset"}-${idCounter}`;
}

/** Coerce arbitrary input into a valid BannerPreset. */
export function coercePreset(raw: unknown, fallbackName = "Imported Preset"): BannerPreset {
  const r = (raw ?? {}) as Record<string, unknown>;
  const p = (r.palette ?? {}) as Record<string, unknown>;
  const t = (r.typography ?? {}) as Record<string, unknown>;

  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : fallbackName;

  return {
    id: typeof r.id === "string" && r.id ? r.id : makePresetId(name),
    name,
    mode: oneOf(r.mode, ["standard", "ai", "hybrid"] as const, "standard"),
    palette: {
      background: hex(p.background, "#111827"),
      primary: hex(p.primary, "#60A5FA"),
      secondary: hex(p.secondary, "#F97316"),
      accent: hex(p.accent, "#F8FAFC"),
    },
    layout: oneOf(r.layout, LAYOUTS, "left-title-right-glyph"),
    pattern: oneOf(r.pattern, PATTERNS, "grid"),
    texture: oneOf(r.texture, TEXTURES, "subtle-noise"),
    typography: {
      titleFont: typeof t.titleFont === "string" && isFontId(t.titleFont)
        ? t.titleFont
        : DEFAULT_FONT,
      weight: num(t.weight, 700, 300, 900),
      scale: num(t.scale, 1, 0.6, 1.6),
    },
    glyph: typeof r.glyph === "string" ? r.glyph.slice(0, 4) : undefined,
    seed: typeof r.seed === "string" ? r.seed : undefined,
    aiRecipe: r.aiRecipe as BannerPreset["aiRecipe"],
  };
}

/** Clone with a fresh id — used when "Save as preset" forks a built-in. */
export function forkPreset(preset: BannerPreset, name: string): BannerPreset {
  return { ...structuredClone(preset), id: makePresetId(name), name };
}
