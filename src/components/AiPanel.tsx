import { Section, Field, TextInput, Select, Button } from "./ui";

// Optional AI panel. Turns freeform page context into a banner recipe via a
// configured provider — or a deterministic fallback when AI is off/unreachable.
// The provider call itself is lazy-loaded by App, so this panel (and zod) cost
// nothing until used.

export interface AiConfig {
  kind: string;
  baseUrl: string;
  model: string;
  /** In-memory only; never persisted. */
  apiKey: string;
}

export interface AiResult {
  source: "ai" | "fallback";
  notes: string[];
}

export const PROVIDER_KINDS = ["none", "ollama", "lmstudio", "openai-compatible", "davellm-router"] as const;

const DEFAULT_BASE: Record<string, string> = {
  ollama: "http://localhost:11434",
  lmstudio: "http://localhost:1234/v1",
  "openai-compatible": "http://localhost:8000/v1",
  "davellm-router": "http://localhost:8000/v1",
  none: "",
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Where the page context goes — drives the privacy label. */
function destination(kind: string, baseUrl: string, apiKey: string): { text: string; remote: boolean } {
  if (kind === "none") return { text: "AI off — standard compute never sends data anywhere.", remote: false };
  const url = baseUrl || DEFAULT_BASE[kind] || "";
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
  if (local && !apiKey) return { text: `Local model — page context stays on your machine (${hostOf(url)}).`, remote: false };
  return { text: `Sends page context to ${hostOf(url)}${apiKey ? " (authenticated)" : ""}.`, remote: true };
}

interface Props {
  config: AiConfig;
  setConfig: (patch: Partial<AiConfig>) => void;
  context: string;
  setContext: (s: string) => void;
  onGenerate: () => void;
  busy: boolean;
  result: AiResult | null;
}

export function AiPanel({ config, setConfig, context, setContext, onGenerate, busy, result }: Props) {
  const dest = destination(config.kind, config.baseUrl, config.apiKey);
  const aiOn = config.kind !== "none";

  return (
    <Section title="AI (optional)">
      <div className="rounded-lg border border-purple-400/20 bg-purple-500/5 p-3 space-y-3">
        <Field label="Provider">
          <Select value={config.kind} onChange={(v) => setConfig({ kind: v })} options={PROVIDER_KINDS} />
        </Field>

        {aiOn && (
          <>
            <Field label="Endpoint">
              <TextInput
                value={config.baseUrl}
                onChange={(e) => setConfig({ baseUrl: e.target.value })}
                placeholder={DEFAULT_BASE[config.kind] || "http://localhost:…"}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Model">
                <TextInput value={config.model} onChange={(e) => setConfig({ model: e.target.value })} placeholder="model name" />
              </Field>
              <Field label="API key (memory only)">
                <TextInput type="password" value={config.apiKey} onChange={(e) => setConfig({ apiKey: e.target.value })} placeholder="optional" />
              </Field>
            </div>
          </>
        )}

        <Field label="Page context">
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            placeholder="Paste a page title + a few lines describing the page. The AI turns it into a recipe; with no provider you still get a deterministic recipe from the text."
            className="w-full resize-y rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/60"
          />
        </Field>

        <Button variant="primary" onClick={onGenerate} disabled={busy || !context.trim()}>
          {busy ? "Generating…" : aiOn ? "Generate with AI" : "Generate from text"}
        </Button>

        <p className={`text-[11px] ${dest.remote ? "text-amber-300" : "text-slate-500"}`}>
          {dest.remote ? "⚠️ " : "🔒 "}
          {dest.text}
          {aiOn ? " Output is always coerced to a valid, reproducible recipe; the model only suggests intent." : ""}
        </p>

        {result && (
          <div className="rounded-md border border-white/10 bg-black/20 p-2 text-[11px]">
            <span
              className={`mr-2 rounded px-1.5 py-0.5 font-medium ${
                result.source === "ai" ? "bg-purple-500/30 text-purple-200" : "bg-slate-500/30 text-slate-200"
              }`}
            >
              {result.source === "ai" ? "AI-derived" : "deterministic fallback"}
            </span>
            {result.notes.map((n, i) => (
              <span key={i} className="text-slate-400">
                {i > 0 ? " · " : ""}
                {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
