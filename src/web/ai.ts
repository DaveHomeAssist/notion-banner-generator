import { createProvider } from "../ai/providers";
import { deriveRecipeFromContext, type DerivedRecipe } from "../ai/derive";
import type { ProviderKind } from "../ai/providers";

// Web AI bridge. This module (and its zod-using transitive deps) is loaded ONLY
// via dynamic import() from App, so Vite splits it into a separate chunk — the
// main bundle stays lean and AI costs nothing until the user actually generates.
//
// In the browser, reaching a local model needs that endpoint to allow this
// origin (CORS) and, on an https page, to be a localhost URL. If it's
// unreachable, deriveRecipeFromContext degrades to a deterministic fallback with
// a note — generation never hard-fails.

export type { DerivedRecipe } from "../ai/derive";

export interface WebAiConfig {
  /** "none" or a ProviderKind; validated at the boundary, so a stale/unknown
   * value safely degrades to no-provider (deterministic fallback). */
  kind: string;
  baseUrl?: string;
  model?: string;
  /** In-memory only; never persisted. */
  apiKey?: string;
}

const KINDS: ProviderKind[] = ["ollama", "lmstudio", "openai-compatible", "davellm-router"];

export async function generateFromContext(context: string, config: WebAiConfig): Promise<DerivedRecipe> {
  const kind = KINDS.find((k) => k === config.kind);
  const provider = kind
    ? createProvider({
        kind,
        baseUrl: config.baseUrl || undefined,
        model: config.model || undefined,
        apiKey: config.apiKey || undefined,
      })
    : null;
  return deriveRecipeFromContext(context, { provider });
}
