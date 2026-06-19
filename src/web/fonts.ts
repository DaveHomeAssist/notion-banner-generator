import InterUrl from "../assets/fonts/Inter.ttf?url";
import JetBrainsMonoUrl from "../assets/fonts/JetBrainsMono.ttf?url";
import LoraUrl from "../assets/fonts/Lora.ttf?url";
import type { FontId } from "../engine/types";
import { registerFont, measureWidth } from "../engine/fonts";

// Web-only font loader. Fetches the same bundled TTF bytes the Node renderer
// uses and (1) registers them for measurement and (2) adds them as canvas
// FontFaces so the preview/PNG render in the intended typeface. Browser-only
// APIs (fetch, FontFace) live here, never in the engine.

const URLS: Record<FontId, string> = {
  Inter: InterUrl,
  "JetBrains Mono": JetBrainsMonoUrl,
  Lora: LoraUrl,
};

let promise: Promise<void> | null = null;

/** Idempotent. Resolves once measurement + canvas fonts are ready. */
export function ensureWebFonts(): Promise<void> {
  if (!promise) {
    promise = (async () => {
      await Promise.all(
        (Object.keys(URLS) as FontId[]).map(async (id) => {
          const buf = await (await fetch(URLS[id])).arrayBuffer();
          registerFont(id, buf);
          const face = new FontFace(id, buf);
          await face.load();
          document.fonts.add(face);
        }),
      );
      // Dev-only hook so the determinism check can compare browser measurement
      // against Node measurement for identical inputs.
      if (import.meta.env.DEV) {
        (window as unknown as { __nbgMeasure?: typeof measureWidth }).__nbgMeasure = measureWidth;
      }
    })();
  }
  return promise;
}
