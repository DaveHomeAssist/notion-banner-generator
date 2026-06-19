// One-off visual verification. Starts nothing — point it at an already-running
// preview/dev server and it captures the app + a clean exported banner.
//   node scripts/screenshot.mjs http://localhost:4173
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:4173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => console.log(`[console:${m.type()}]`, m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "verify-app.png", fullPage: true });

// Pull the live preview canvas to PNG to confirm pixels actually render.
const dataUrl = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  return c ? c.toDataURL("image/png") : null;
});
if (dataUrl) {
  const b64 = dataUrl.split(",")[1];
  const { writeFileSync } = await import("node:fs");
  writeFileSync("verify-banner.png", Buffer.from(b64, "base64"));
  console.log("wrote verify-app.png + verify-banner.png");
} else {
  console.error("no canvas found");
  process.exitCode = 1;
}
await browser.close();
