// End-to-end MCP smoke test: spawn the stdio server as a subprocess, connect a
// real MCP client, and exercise every tool. Proves the server speaks MCP and
// that banner-core renders through it. Run: npm run mcp:smoke
import { existsSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type Content = { type: string; text?: string; uri?: string; name?: string; mimeType?: string };
type Result = { content?: Content[] };
const textOf = (r: Result) => r.content?.find((c) => c.type === "text")?.text ?? "";
const linkOf = (r: Result) => r.content?.find((c) => c.type === "resource_link");

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}

const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "mcp/server.ts"] });
const client = new Client({ name: "nbg-smoke", version: "0.0.0" });
await client.connect(transport);

const call = async (name: string, args: Record<string, unknown>): Promise<Result> =>
  (await client.callTool({ name, arguments: args })) as Result;

console.log("MCP server smoke test:\n");

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
check(
  "advertises the 5 tools",
  ["create_recipe", "list_presets", "render_png", "render_svg", "validate_recipe"].every((n) => names.includes(n)),
  names.join(", "),
);

const presets = await call("list_presets", {});
check("list_presets returns built-ins", textOf(presets).includes("Gradient Field"));

const recipe = await call("create_recipe", { title: "Quarterly Review", subtitle: "FY26", presetId: "builtin-radial-burst", seed: "q1" });
const recipeText = textOf(recipe);
check("create_recipe returns a preset+content+seed", recipeText.includes("Radial Burst") && recipeText.includes('"title": "Quarterly Review"'));

const bad = await call("validate_recipe", { recipe: { preset: { name: "Bogus", layout: "not-a-layout", palette: { background: "nope" } } } });
const badText = textOf(bad);
check("validate_recipe coerces bad values + reports notes", badText.includes('"valid": true') && badText.includes("invalid ->"));

const svg = await call("render_svg", { title: "Headless via MCP", presetId: "builtin-system-blueprint" });
check("render_svg returns vector <text>", textOf(svg).includes("<svg") && textOf(svg).includes("<text"));
check("render_svg returns an svg resource link", linkOf(svg)?.mimeType === "image/svg+xml");

const png = await call("render_png", { title: "Headless via MCP", presetId: "builtin-system-blueprint" });
const pngLink = linkOf(png);
const pngPath = pngLink?.uri?.replace("file://", "") ?? "";
check("render_png returns a png resource link", pngLink?.mimeType === "image/png");
check("render_png wrote the file to the sandbox", !!pngPath && existsSync(pngPath), pngPath);

await client.close();

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
