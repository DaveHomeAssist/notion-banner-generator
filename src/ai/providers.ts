import { buildMessages, parseRecipeIntent, type RecipeIntent } from "./recipeIntent";

// AI provider adapters. Each turns freeform page context into a RecipeIntent via
// a local (or OpenAI-compatible) chat endpoint. The whole layer is optional and
// fetch-based — no DOM, no Node-only APIs — so it runs in the browser, the CLI,
// and the MCP server. It NEVER renders or touches the filesystem; it only
// produces structured intent that the caller coerces and renders.

export type ProviderKind = "ollama" | "lmstudio" | "openai-compatible" | "davellm-router";

export interface ProviderConfig {
  kind: ProviderKind;
  /** Base URL for the endpoint. Defaults per provider. */
  baseUrl?: string;
  model?: string;
  /** Bearer token for hosted/authenticated endpoints. Held in memory only. */
  apiKey?: string;
  /** Generation timeout (ms). Default 20000. */
  timeoutMs?: number;
}

export interface BannerProvider {
  readonly id: string;
  readonly label: string;
  /** True only for endpoints that leave the machine — drives privacy UX. */
  readonly isRemote: boolean;
  /** Reachability check before any generate call. Never throws. */
  isAvailable(): Promise<boolean>;
  /** Turn page context into a structured RecipeIntent. May throw on failure. */
  generateRecipeIntent(context: string): Promise<RecipeIntent>;
}

const DEFAULT_TIMEOUT = 20000;
const HEALTH_TIMEOUT = 3000;

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Strip obvious PII/secrets before any provider call (defense for hosted ones). */
export function redactContext(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(sk|pk|ghp|xox[baprs])[-_][A-Za-z0-9]{8,}\b/g, "[secret]");
}

class OllamaProvider implements BannerProvider {
  readonly id = "ollama";
  readonly label: string;
  readonly isRemote = false;
  private base: string;
  constructor(private cfg: ProviderConfig) {
    this.base = (cfg.baseUrl ?? "http://localhost:11434").replace(/\/+$/, "");
    this.label = `Ollama (${cfg.model ?? "llama3"})`;
  }
  async isAvailable(): Promise<boolean> {
    try {
      return await withTimeout(HEALTH_TIMEOUT, async (signal) => (await fetch(`${this.base}/api/tags`, { signal })).ok);
    } catch {
      return false;
    }
  }
  async generateRecipeIntent(context: string): Promise<RecipeIntent> {
    const { system, user } = buildMessages(redactContext(context));
    const body = {
      model: this.cfg.model ?? "llama3",
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    const data = await withTimeout(this.cfg.timeoutMs ?? DEFAULT_TIMEOUT, async (signal) => {
      const res = await fetch(`${this.base}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) throw new Error(`ollama responded ${res.status}`);
      return (await res.json()) as { message?: { content?: string } };
    });
    return parseRecipeIntent(data.message?.content ?? "");
  }
}

/** OpenAI-compatible /chat/completions (LM Studio, DaveLLM Router, generic). */
class OpenAiCompatibleProvider implements BannerProvider {
  readonly id: string;
  readonly label: string;
  readonly isRemote: boolean;
  private base: string;
  constructor(
    private cfg: ProviderConfig,
    defaults: { id: string; label: string; baseUrl: string; isRemote: boolean },
  ) {
    this.id = defaults.id;
    this.label = defaults.label;
    this.isRemote = defaults.isRemote;
    this.base = (cfg.baseUrl ?? defaults.baseUrl).replace(/\/+$/, "");
  }
  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.cfg.apiKey) h["authorization"] = `Bearer ${this.cfg.apiKey}`;
    return h;
  }
  async isAvailable(): Promise<boolean> {
    try {
      return await withTimeout(
        HEALTH_TIMEOUT,
        async (signal) => (await fetch(`${this.base}/models`, { headers: this.headers(), signal })).ok,
      );
    } catch {
      return false;
    }
  }
  async generateRecipeIntent(context: string): Promise<RecipeIntent> {
    const { system, user } = buildMessages(redactContext(context));
    const body = {
      model: this.cfg.model ?? "local-model",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    const data = await withTimeout(this.cfg.timeoutMs ?? DEFAULT_TIMEOUT, async (signal) => {
      const res = await fetch(`${this.base}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) throw new Error(`${this.id} responded ${res.status}`);
      return (await res.json()) as { choices?: { message?: { content?: string } }[] };
    });
    return parseRecipeIntent(data.choices?.[0]?.message?.content ?? "");
  }
}

export function createProvider(config: ProviderConfig): BannerProvider {
  switch (config.kind) {
    case "ollama":
      return new OllamaProvider(config);
    case "lmstudio":
      return new OpenAiCompatibleProvider(config, {
        id: "lmstudio",
        label: `LM Studio (${config.model ?? "local"})`,
        baseUrl: "http://localhost:1234/v1",
        isRemote: false,
      });
    case "davellm-router":
      return new OpenAiCompatibleProvider(config, {
        id: "davellm-router",
        label: `DaveLLM Router (${config.model ?? "router"})`,
        baseUrl: "http://localhost:8000/v1",
        isRemote: false,
      });
    case "openai-compatible":
      return new OpenAiCompatibleProvider(config, {
        id: "openai-compatible",
        label: `OpenAI-compatible (${config.model ?? "model"})`,
        baseUrl: config.baseUrl ?? "http://localhost:8000/v1",
        isRemote: Boolean(config.apiKey),
      });
  }
}

const KINDS: ProviderKind[] = ["ollama", "lmstudio", "openai-compatible", "davellm-router"];

/** Build a provider from environment variables, or null if AI is unconfigured.
 *   NBG_AI_PROVIDER, NBG_AI_BASE_URL, NBG_AI_MODEL, NBG_AI_API_KEY, NBG_AI_TIMEOUT_MS */
export function providerFromEnv(env: Record<string, string | undefined>): BannerProvider | null {
  const kind = env.NBG_AI_PROVIDER;
  if (!kind || !KINDS.includes(kind as ProviderKind)) return null;
  return createProvider({
    kind: kind as ProviderKind,
    baseUrl: env.NBG_AI_BASE_URL,
    model: env.NBG_AI_MODEL,
    apiKey: env.NBG_AI_API_KEY,
    timeoutMs: env.NBG_AI_TIMEOUT_MS ? Number(env.NBG_AI_TIMEOUT_MS) : undefined,
  });
}
