import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../types";
import type { GradientStop, Scene } from "../scene";

// Serializes a Scene into a standalone SVG document. Text stays real <text>
// (editable/crisp), geometry stays vector, and noise becomes an feTurbulence
// filter — so the SVG is genuinely vector, not a PNG in a wrapper.

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;

export function sceneToSvg(scene: Scene): string {
  const defs: string[] = [];
  const body: string[] = [];
  let gid = 0;

  for (const p of scene) {
    switch (p.kind) {
      case "rectFill":
        body.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" fill="${esc(p.color)}"/>`);
        break;
      case "linearGradient": {
        const id = `g${gid++}`;
        defs.push(
          `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}">${stops(p.stops)}</linearGradient>`,
        );
        body.push(`<rect width="${W}" height="${H}" fill="url(#${id})"/>`);
        break;
      }
      case "radialGradient": {
        const id = `g${gid++}`;
        defs.push(
          `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r1)}" fx="${n(p.cx)}" fy="${n(p.cy)}">${stops(p.stops, p.r0 / p.r1)}</radialGradient>`,
        );
        body.push(`<rect width="${W}" height="${H}" fill="url(#${id})"/>`);
        break;
      }
      case "line":
        body.push(`<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${esc(p.stroke)}" stroke-width="${n(p.width)}"/>`);
        break;
      case "polyline":
        body.push(`<polyline points="${p.points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}" fill="none" stroke="${esc(p.stroke)}" stroke-width="${n(p.width)}"/>`);
        break;
      case "circle": {
        const attrs = [`cx="${n(p.cx)}"`, `cy="${n(p.cy)}"`, `r="${n(p.r)}"`];
        attrs.push(`fill="${p.fill ? esc(p.fill) : "none"}"`);
        if (p.stroke) attrs.push(`stroke="${esc(p.stroke)}"`, `stroke-width="${n(p.width ?? 1)}"`);
        body.push(`<circle ${attrs.join(" ")}/>`);
        break;
      }
      case "text": {
        let filter = "";
        if (p.shadow) {
          const id = `s${gid++}`;
          defs.push(
            `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="${n(p.shadow.blur / 2)}" flood-color="${esc(p.shadow.color)}"/></filter>`,
          );
          filter = ` filter="url(#${id})"`;
        }
        const anchor = p.align === "center" ? "middle" : p.align === "right" ? "end" : "start";
        const ls = p.letterSpacing * p.size; // em -> user units
        body.push(
          `<text x="${n(p.x)}" y="${n(p.y)}" font-family="${esc(p.font)}" font-size="${n(p.size)}" font-weight="${p.weight}" fill="${esc(p.color)}" text-anchor="${anchor}" letter-spacing="${n(ls)}"${filter}>${esc(p.text)}</text>`,
        );
        break;
      }
      case "noise": {
        const id = `n${gid++}`;
        defs.push(
          `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`,
        );
        body.push(`<rect width="${W}" height="${H}" filter="url(#${id})" opacity="${n(Math.min(0.12, p.intensity * 1.3))}"/>`);
        break;
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    defs.length ? `<defs>${defs.join("")}</defs>` : "",
    body.join(""),
    `</svg>`,
  ].join("");
}

function stops(list: GradientStop[], startOffset = 0): string {
  return list
    .map((s) => `<stop offset="${n(startOffset + s.offset * (1 - startOffset))}" stop-color="${esc(s.color)}"/>`)
    .join("");
}

function n(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
