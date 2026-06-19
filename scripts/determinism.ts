// Cross-environment determinism check: measureWidth must return byte-identical
// results in Node and in the browser for the same (text, font, size, spacing).
// Run with: npx tsx scripts/determinism.ts   (dev server must be on :4190)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  registerFont,
  measureWidth,
  FONT_FILES,
  type FontId,
} from "../src/core/index";

// Node-side: load the same bundled fonts.
const dir = fileURLToPath(new URL("../src/assets/fonts/", import.meta.url));
for (const [id, file] of Object.entries(FONT_FILES)) {
  const b = readFileSync(dir + file);
  registerFont(id as FontId, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

const cases: [string, FontId, number][] = [
  ["Quarterly Review", "Inter", 96],
  ["The quick brown fox jumps over", "Inter", 72],
  ["SYSTEM BLUEPRINT", "Inter", 84],
  ["const x = render()", "JetBrains Mono", 60],
  ["Editorial Elegance & Restraint", "Lora", 90],
];

const nodeVals = cases.map(([t, f, s]) => measureWidth(t, f, s, 0.02));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:4190/", { waitUntil: "networkidle" });
await page.waitForFunction(() => "__nbgMeasure" in window, { timeout: 15000 });
const browserVals: number[] = await page.evaluate(
  (cs) =>
    (cs as [string, string, number][]).map(([t, f, s]) =>
      (window as unknown as { __nbgMeasure: (a: string, b: string, c: number, d: number) => number }).__nbgMeasure(t, f, s, 0.02),
    ),
  cases,
);
await browser.close();

let pass = true;
console.log("measureWidth — Node vs Browser (letterSpacing 0.02em):\n");
cases.forEach(([t, f, s], i) => {
  const n = nodeVals[i];
  const b = browserVals[i];
  const eq = Math.abs(n - b) < 0.001;
  if (!eq) pass = false;
  console.log(`  ${eq ? "✓" : "✗"} ${f}@${s}  "${t}"\n      node=${n.toFixed(4)}  browser=${b.toFixed(4)}`);
});
console.log(
  pass
    ? "\n✅ DETERMINISM PASS — identical text measurement in Node and the browser."
    : "\n❌ DETERMINISM FAIL — measurements diverge.",
);
process.exit(pass ? 0 : 1);
