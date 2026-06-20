// Self-contained Phase 3B verification: serve the built dist at the base path
// with a tiny Node http server, then drive Playwright — no vite/curl needed.
// Checks the AI panel renders and the no-provider fallback updates the preview.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const DIST = "dist";
const BASE = "/notion-banner-generator";
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".ttf": "font/ttf", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p === "/" || p === "") p = "/index.html";
  const file = join(DIST, p);
  if (existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  } else {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}${BASE}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on("pageerror", (e) => errs.push("ERR " + e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("textarea", { timeout: 15000 });

await page.fill("textarea", "Quarterly Finance Review — board deck for the leadership team");
const before = await page.evaluate(() => document.querySelector("canvas")?.toDataURL());
await page.getByRole("button", { name: /generate from text/i }).click();
await page.waitForTimeout(1500);

const badge = await page.evaluate(() => document.body.innerText.includes("deterministic fallback"));
const title = await page.evaluate(
  () => [...document.querySelectorAll("input")].find((i) => /quarterly/i.test(i.value))?.value ?? null,
);
const after = await page.evaluate(() => document.querySelector("canvas")?.toDataURL());
await page.screenshot({ path: "verify-ai-panel.png", fullPage: true });
await browser.close();
server.close();

const ok = badge && title && before !== after;
console.log(JSON.stringify({ fallbackBadge: badge, derivedTitle: title, canvasChanged: before !== after, errs }, null, 2));
console.log(ok ? "AI PANEL FALLBACK: PASS" : "AI PANEL FALLBACK: FAIL");
process.exit(ok ? 0 : 1);
