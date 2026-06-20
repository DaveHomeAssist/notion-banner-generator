// AI provider-layer contract tests. No network: global.fetch is mocked. Proves
// the parser tolerates real-world model output, the intent maps onto a VALID
// coerced preset, and that everything degrades to a deterministic fallback when
// no provider is configured or a provider fails. Run via: npm test
import assert from "node:assert/strict";
import {
  parseRecipeIntent,
  intentToRenderInput,
  deriveTitle,
  deriveRecipeFromContext,
  createProvider,
  IntentParseError,
} from "../src/core/index";

let passed = 0;
let failed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name} — ${(e as Error).message}`);
  }
}

type FetchFn = typeof globalThis.fetch;
async function withMockFetch(impl: (url: string) => Response, fn: () => Promise<void>) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => impl(String(input))) as FetchFn;
  try {
    await fn();
  } finally {
    globalThis.fetch = orig;
  }
}
const chat = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

console.log("AI provider layer:\n");

await check("parses a plain JSON intent", () => {
  const i = parseRecipeIntent('{"title":"Q1 Review","mood":["technical"]}');
  assert.equal(i.title, "Q1 Review");
});

await check("parses code-fenced JSON", () => {
  const i = parseRecipeIntent("```json\n{\"title\":\"Fenced\"}\n```");
  assert.equal(i.title, "Fenced");
});

await check("extracts JSON embedded in prose", () => {
  const i = parseRecipeIntent('Sure! Here you go:\n{"title":"Embedded"}\nHope that helps.');
  assert.equal(i.title, "Embedded");
});

await check("throws IntentParseError on non-JSON output", () => {
  assert.throws(() => parseRecipeIntent("I can't help with that."), IntentParseError);
});

await check("intent maps onto a valid coerced preset (bad values fixed)", () => {
  const input = intentToRenderInput(
    { title: "Bad Inputs", palette: { background: "not-a-color" }, layout: "bogus-layout", pattern: "waves", font: "Comic Sans" },
    "ctx",
  );
  assert.match(input.preset.palette.background, /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/); // coerced to hex
  assert.equal(input.preset.pattern, "waves"); // valid value kept
  assert.equal(input.preset.layout, "left-title-right-glyph"); // invalid -> default
  assert.equal(input.preset.typography.titleFont, "Inter"); // unbundled font -> default
  assert.equal(input.content.title, "Bad Inputs");
  assert.ok(input.preset.seed && input.preset.seed.length > 0); // reproducible seed
});

await check("deriveTitle strips markdown and caps empties", () => {
  assert.equal(deriveTitle("# My Heading\nbody text"), "My Heading");
  assert.equal(deriveTitle(""), "Untitled");
});

await check("no provider => deterministic fallback with a note", async () => {
  const r = await deriveRecipeFromContext("Quarterly business review for the finance team", {});
  assert.equal(r.source, "fallback");
  assert.ok(r.notes.some((n) => n.includes("no AI provider")));
  assert.ok(r.input.content.title.length > 0);
});

await check("openai-compatible provider parses a chat completion (AI path)", async () => {
  await withMockFetch(
    (url) => (url.endsWith("/models") ? new Response("{}", { status: 200 }) : chat('{"title":"AI Title","pattern":"grid"}')),
    async () => {
      const provider = createProvider({ kind: "openai-compatible", baseUrl: "http://localhost:9/v1", model: "mock" });
      assert.equal(await provider.isAvailable(), true);
      const r = await deriveRecipeFromContext("anything", { provider });
      assert.equal(r.source, "ai");
      assert.equal(r.input.content.title, "AI Title");
      assert.equal(r.input.preset.pattern, "grid");
    },
  );
});

await check("provider HTTP error degrades to fallback with a note", async () => {
  await withMockFetch(
    () => new Response("nope", { status: 500 }),
    async () => {
      const provider = createProvider({ kind: "ollama", baseUrl: "http://localhost:9", model: "x" });
      const r = await deriveRecipeFromContext("ctx", { provider });
      assert.equal(r.source, "fallback");
      assert.ok(r.notes.some((n) => /not reachable|failed/.test(n)));
    },
  );
});

await check("garbage model output degrades to fallback (no crash)", async () => {
  await withMockFetch(
    (url) => (url.endsWith("/models") ? new Response("{}", { status: 200 }) : chat("I refuse to answer.")),
    async () => {
      const provider = createProvider({ kind: "openai-compatible", baseUrl: "http://localhost:9/v1" });
      const r = await deriveRecipeFromContext("ctx", { provider });
      assert.equal(r.source, "fallback");
    },
  );
});

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
