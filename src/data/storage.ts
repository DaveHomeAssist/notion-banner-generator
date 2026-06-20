import type { BannerPreset } from "../engine/types";
import type { ExportRecipe } from "../engine/exportImage";
import { coercePreset } from "./presetSchema";

// Local persistence. MVP uses localStorage (zero deps, fits the no-backend
// rule); the interface is deliberately small so it can be swapped for
// IndexedDB/Dexie later without touching callers.

const PRESETS_KEY = "nbg.presets.v1";
const RECENTS_KEY = "nbg.recents.v1";
const AI_CONFIG_KEY = "nbg.ai.v1";
const MAX_RECENTS = 12;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / disabled — non-fatal, the app stays usable in-memory
  }
}

export function loadSavedPresets(): BannerPreset[] {
  const raw = read<unknown[]>(PRESETS_KEY, []);
  return Array.isArray(raw) ? raw.map((p) => coercePreset(p)) : [];
}

export function saveSavedPresets(presets: BannerPreset[]): void {
  write(PRESETS_KEY, presets);
}

export function loadRecents(): ExportRecipe[] {
  return read<ExportRecipe[]>(RECENTS_KEY, []);
}

export function pushRecent(recipe: ExportRecipe): ExportRecipe[] {
  const next = [recipe, ...loadRecents()].slice(0, MAX_RECENTS);
  write(RECENTS_KEY, next);
  return next;
}

// AI provider config — persisted WITHOUT the apiKey (held in memory only, per
// the privacy rule). Endpoint/model are convenience, not secrets.
export interface StoredAiConfig {
  kind: string;
  baseUrl: string;
  model: string;
}

export function loadAiConfig(): StoredAiConfig {
  const c = read<Partial<StoredAiConfig>>(AI_CONFIG_KEY, {});
  return { kind: c.kind ?? "none", baseUrl: c.baseUrl ?? "", model: c.model ?? "" };
}

export function saveAiConfig(c: StoredAiConfig): void {
  write(AI_CONFIG_KEY, { kind: c.kind, baseUrl: c.baseUrl, model: c.model });
}
