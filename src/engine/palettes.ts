import type { Palette } from "./types";

export interface PaletteScheme {
  name: string;
  palette: Palette;
}

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

// --- HSL conversion + color-harmony palette variations -----------------------

interface Hsl {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s);
  l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const rotate = (hex: string, deg: number): string => {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, h: hsl.h + deg });
};
const saturate = (hex: string, mult: number): string => {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, s: hsl.s * mult });
};
/** Nudge a hue toward a target hue by `amount` (0..1). */
const towardHue = (hex: string, target: number, amount: number): string => {
  const hsl = hexToHsl(hex);
  let diff = ((target - hsl.h + 540) % 360) - 180; // shortest signed delta
  return hslToHex({ ...hsl, h: hsl.h + diff * amount });
};

/**
 * Deterministic color-harmony variations of a base palette. Background and
 * accent are preserved (so contrast/legibility, already valid on the base,
 * is never broken); primary/secondary are transformed per named scheme. Same
 * input always yields the same set — this is the offline fallback for AI
 * palette suggestions, and is also reproducible on its own.
 */
export function paletteSchemes(base: Palette): PaletteScheme[] {
  const p = base.primary;
  const s = base.secondary;
  return [
    { name: "Original", palette: { ...base } },
    { name: "Complementary", palette: { ...base, secondary: rotate(p, 180) } },
    { name: "Analogous", palette: { ...base, primary: rotate(p, -25), secondary: rotate(p, 25) } },
    { name: "Triadic", palette: { ...base, secondary: rotate(p, 120), accent: base.accent } },
    { name: "Warm", palette: { ...base, primary: towardHue(p, 30, 0.5), secondary: towardHue(s, 30, 0.5) } },
    { name: "Cool", palette: { ...base, primary: towardHue(p, 210, 0.5), secondary: towardHue(s, 210, 0.5) } },
    { name: "Vivid", palette: { ...base, primary: saturate(p, 1.35), secondary: saturate(s, 1.35) } },
    { name: "Muted", palette: { ...base, primary: saturate(p, 0.55), secondary: saturate(s, 0.55) } },
  ];
}
