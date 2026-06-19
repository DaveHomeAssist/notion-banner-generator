// Backend-agnostic scene model. The renderer builds an ordered list of these
// primitives from (preset + content); a Canvas backend rasterizes them and an
// SVG backend serializes them. One source of truth => Canvas and SVG can never
// visually drift, and new export formats are just new backends.

export interface GradientStop {
  offset: number; // 0..1
  color: string; // any CSS/canvas color string
}

export type Primitive =
  | { kind: "rectFill"; x: number; y: number; w: number; h: number; color: string }
  | {
      kind: "linearGradient";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stops: GradientStop[];
    }
  | {
      kind: "radialGradient";
      cx: number;
      cy: number;
      r0: number;
      r1: number;
      stops: GradientStop[];
    }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      width: number;
    }
  | {
      kind: "polyline";
      points: Array<[number, number]>;
      stroke: string;
      width: number;
    }
  | {
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      stroke?: string;
      width?: number;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      font: string; // CSS font-family stack
      size: number;
      weight: number;
      color: string;
      align: "left" | "center" | "right";
      letterSpacing: number;
      shadow?: { color: string; blur: number };
    }
  // Procedural noise — Canvas stamps speckle, SVG uses an feTurbulence filter.
  | { kind: "noise"; intensity: number };

export type Scene = Primitive[];
