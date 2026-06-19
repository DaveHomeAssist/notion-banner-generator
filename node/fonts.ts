import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registerFont, FONT_FILES, type FontId } from "../src/core/index";

// Shared Node-side font loader (used by the CLI and the MCP server). Reads the
// bundled TTFs, registers them for deterministic measurement, and returns their
// file paths so resvg (which loads fonts by path) rasterizes with the same
// typefaces the browser uses.
export function loadNodeFonts(): string[] {
  const dir = fileURLToPath(new URL("../src/assets/fonts/", import.meta.url));
  const paths: string[] = [];
  for (const [id, file] of Object.entries(FONT_FILES)) {
    const path = dir + file;
    const buf = readFileSync(path);
    registerFont(id as FontId, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    paths.push(path);
  }
  return paths;
}
