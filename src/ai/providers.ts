import type { BannerPreset } from "../engine/types";

// AI provider contract. Phase 3 lands real implementations (Ollama, LM Studio,
// DaveLLM Router, OpenAI-compatible, hosted). Defining the interface now keeps
// the router as "just another implementation" rather than a special case, and
// lets the UI render provider state before any provider exists.

export type ProviderKind =
  | "none"
  | "ollama"
  | "lmstudio"
  | "davellm-router"
  | "openai-compatible"
  | "hosted";

export interface ProviderConfig {
  kind: ProviderKind;
  /** Base URL for local/openai-compatible endpoints. */
  baseUrl?: string;
  model?: string;
  /** Never persisted in plaintext by the app — held in memory only. */
  apiKey?: string;
  /** True only for endpoints that leave the machine. Drives the privacy UI. */
  isRemote: boolean;
}

export const NO_PROVIDER: ProviderConfig = { kind: "none", isRemote: false };

/** Input passed to the concept generator (Phase 3). */
export interface ConceptRequest {
  title: string;
  subtitle?: string;
  pageContext?: string;
  mood?: string;
  styleHint?: string;
}

/** The AI layer returns preset-shaped overrides plus art-direction metadata.
 * This maps 1:1 onto BannerPreset fields — no separate shape to drift. */
export interface ConceptResult {
  concept: string;
  overrides: Partial<
    Pick<BannerPreset, "palette" | "layout" | "pattern" | "texture" | "glyph">
  >;
  recipe: NonNullable<BannerPreset["aiRecipe"]>;
}

export interface BannerAiProvider {
  readonly config: ProviderConfig;
  /** Reachability check before any generate call. */
  health(): Promise<boolean>;
  generateConcepts(req: ConceptRequest, n?: number): Promise<ConceptResult[]>;
  refinePreset(base: BannerPreset, concept: ConceptResult): Promise<BannerPreset>;
}

/**
 * Phase 3 placeholder. Every method rejects with a clear "not implemented"
 * signal so the UI can show AI as present-but-inactive without faking output.
 */
export class UnconfiguredProvider implements BannerAiProvider {
  readonly config = NO_PROVIDER;
  async health(): Promise<boolean> {
    return false;
  }
  async generateConcepts(): Promise<ConceptResult[]> {
    throw new Error("AI enhancement arrives in Phase 3. Standard compute is fully available.");
  }
  async refinePreset(): Promise<BannerPreset> {
    throw new Error("AI enhancement arrives in Phase 3. Standard compute is fully available.");
  }
}

export function createProvider(_config: ProviderConfig = NO_PROVIDER): BannerAiProvider {
  // Phase 3: switch on _config.kind and return the matching adapter.
  return new UnconfiguredProvider();
}

/** Redaction stub. Phase 3 strips PII/secrets before any remote call; defined
 * now so the privacy contract is visible at the seam, not bolted on later. */
export function redactContext(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(sk|pk|ghp|xox[baprs])[-_][A-Za-z0-9]{8,}\b/g, "[secret]");
}
