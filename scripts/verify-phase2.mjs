// Phase 2 verification: new patterns render, SVG export is valid vector, and the
// batch ZIP downloads. Point at a running dev server.
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://localhost:4190/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[ERR]", e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: "verify-app.png", fullPage: true });

// Contact sheet of the four new patterns.
const patterns = ["waves", "concentric", "halftone", "mesh"];
const shots = [];
for (const p of patterns) {
  await page.selectOption("text=Pattern >> xpath=following-sibling::select", p).catch(() => {});
  // fall back: find the Pattern select by label proximity
  await page.evaluate((val) => {
    const labels = [...document.querySelectorAll("span")].filter((s) => s.textContent === "Pattern");
    const sel = labels[0]?.parentElement?.querySelector("select");
    if (sel) { sel.value = val; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  }, p);
  await page.waitForTimeout(250);
  const data = await page.evaluate(() => document.querySelector("canvas")?.toDataURL("image/png") || null);
  shots.push({ p, ok: !!data, data });
}
const html = `<body style="margin:0;background:#0b0f19">` + shots.map((s) =>
  `<div style="padding:6px"><div style="color:#94a3b8;font:12px sans-serif;padding:4px">${s.p}</div><img src="${s.data}" style="width:760px;display:block"/></div>`).join("") + `</body>`;
await page.setContent(html);
await page.waitForTimeout(200);
await page.screenshot({ path: "verify-newpatterns.png", fullPage: true });
console.log("patterns:", shots.map((s) => s.p + (s.ok ? "✓" : "✗")).join(" "));

// SVG export download → validate.
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const [svgDl] = await Promise.all([
  page.waitForEvent("download"),
  page.click("text=Vector SVG"),
]);
const svgPath = "verify-export.svg";
await svgDl.saveAs(svgPath);
const { readFileSync } = await import("node:fs");
const svg = readFileSync(svgPath, "utf8");
const checks = {
  isSvg: svg.startsWith("<svg") && svg.includes("</svg>"),
  hasText: svg.includes("<text"),
  hasGradient: svg.includes("Gradient"),
  bytes: svg.length,
};
console.log("svg:", JSON.stringify(checks));

// Batch ZIP download → validate magic bytes + size.
const [zipDl] = await Promise.all([
  page.waitForEvent("download"),
  page.click("text=Export variations"),
]);
await zipDl.saveAs("verify-batch.zip");
const zip = readFileSync("verify-batch.zip");
console.log("zip:", JSON.stringify({ magic: zip.slice(0, 2).toString("hex") === "504b", bytes: zip.length }));

await browser.close();
