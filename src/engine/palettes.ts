import type { Palette } from "./types";

// Palette utilities. Colors are stored as hex on the preset; these helpers
// derive the translucent / mixed variants the renderer needs without pulling in
// a color library.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

/** Linear mix between two hex colors. t=0 => a, t=1 => b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = clamp01(t);
  const r = Math.round(ca.r + (cb.r - ca.r) * k);
  const g = Math.round(ca.g + (cb.g - ca.g) * k);
  const bl = Math.round(ca.b + (cb.b - ca.b) * k);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Perceived luminance 0..1 (Rec. 601-ish). Used to pick legible text color. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Choose the palette color that reads best on the given background. */
export function readableInk(palette: Palette): string {
  const bgLum = luminance(palette.background);
  // accent is usually the near-white/near-black extreme; prefer it when it
  // contrasts, else fall back to a computed black/white.
  const accentContrast = Math.abs(luminance(palette.accent) - bgLum);
  if (accentContrast > 0.45) return palette.accent;
  return bgLum > 0.5 ? "#0B0F19" : "#F8FAFC";
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
