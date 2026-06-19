// Minimal, dependency-free TrueType/OpenType metrics reader.
//
// We don't need a full font parser — only per-glyph advance widths to lay out
// and wrap text. So we read just `head` (unitsPerEm), `hhea`/`hmtx` (advances),
// `maxp` (glyph count) and `cmap` (char -> glyph). This deliberately ignores
// GSUB/GPOS (no kerning/ligatures), which means measurement is a *pure function
// of the font bytes* and is byte-identical in every browser and in Node — the
// property that makes "recipe = banner everywhere" actually hold. It also
// sidesteps opentype.js's unsupported-GSUB-lookup crash on Inter/Lora and adds
// zero runtime dependencies.

export interface FontMetrics {
  unitsPerEm: number;
  /** Advance width of a string at the given pixel size (no kerning/tracking). */
  stringWidth(text: string, sizePx: number): number;
}

export function parseFontMetrics(buffer: ArrayBuffer): FontMetrics {
  const dv = new DataView(buffer);
  const numTables = dv.getUint16(4);

  const tables: Record<string, { offset: number; length: number }> = {};
  let p = 12;
  for (let i = 0; i < numTables; i++) {
    const tag = String.fromCharCode(
      dv.getUint8(p),
      dv.getUint8(p + 1),
      dv.getUint8(p + 2),
      dv.getUint8(p + 3),
    );
    tables[tag] = { offset: dv.getUint32(p + 8), length: dv.getUint32(p + 12) };
    p += 16;
  }

  const head = tables.head;
  const hhea = tables.hhea;
  const hmtx = tables.hmtx;
  const cmap = tables.cmap;
  if (!head || !hhea || !hmtx || !cmap) {
    throw new Error("font missing a required table (head/hhea/hmtx/cmap)");
  }

  const unitsPerEm = dv.getUint16(head.offset + 18);
  const numHMetrics = dv.getUint16(hhea.offset + 34);
  // Glyphs past numHMetrics reuse the final advance (monospaced tail).
  const lastAdvance = numHMetrics > 0 ? dv.getUint16(hmtx.offset + (numHMetrics - 1) * 4) : unitsPerEm;
  const glyphAdvance = (gid: number): number =>
    gid < numHMetrics ? dv.getUint16(hmtx.offset + gid * 4) : lastAdvance;

  const charToGlyph = buildCmap(dv, cmap.offset);
  const cache = new Map<number, number>();
  const advUnits = (code: number): number => {
    let a = cache.get(code);
    if (a === undefined) {
      a = glyphAdvance(charToGlyph(code));
      cache.set(code, a);
    }
    return a;
  };

  return {
    unitsPerEm,
    stringWidth(text, sizePx) {
      let units = 0;
      for (const ch of text) units += advUnits(ch.codePointAt(0) ?? 0);
      return (units / unitsPerEm) * sizePx;
    },
  };
}

/** Pick the best Unicode cmap subtable and return a char-code -> glyph-id fn. */
function buildCmap(dv: DataView, cmapBase: number): (code: number) => number {
  const numSub = dv.getUint16(cmapBase + 2);
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < numSub; i++) {
    const rec = cmapBase + 4 + i * 8;
    const platformID = dv.getUint16(rec);
    const encodingID = dv.getUint16(rec + 2);
    const subOffset = dv.getUint32(rec + 4);
    const format = dv.getUint16(cmapBase + subOffset);
    let score = -1;
    if (platformID === 3 && encodingID === 10 && format === 12) score = 5;
    else if (platformID === 3 && encodingID === 1 && format === 4) score = 4;
    else if (platformID === 0 && format === 12) score = 4;
    else if (platformID === 0 && format === 4) score = 3;
    else if (format === 12) score = 2;
    else if (format === 4) score = 1;
    if (score > bestScore) {
      bestScore = score;
      best = subOffset;
    }
  }
  if (best < 0) throw new Error("no usable cmap subtable");

  const sub = cmapBase + best;
  const format = dv.getUint16(sub);

  if (format === 4) {
    const segX2 = dv.getUint16(sub + 6);
    const segCount = segX2 / 2;
    const endCodes = sub + 14;
    const startCodes = endCodes + segX2 + 2;
    const idDeltas = startCodes + segX2;
    const idRangeOffsets = idDeltas + segX2;
    return (code) => {
      if (code > 0xffff) return 0;
      for (let s = 0; s < segCount; s++) {
        if (code <= dv.getUint16(endCodes + s * 2)) {
          const start = dv.getUint16(startCodes + s * 2);
          if (code < start) return 0;
          const idDelta = dv.getInt16(idDeltas + s * 2);
          const idRangeOffset = dv.getUint16(idRangeOffsets + s * 2);
          if (idRangeOffset === 0) return (code + idDelta) & 0xffff;
          const gIdx = idRangeOffsets + s * 2 + idRangeOffset + (code - start) * 2;
          const g = dv.getUint16(gIdx);
          return g === 0 ? 0 : (g + idDelta) & 0xffff;
        }
      }
      return 0;
    };
  }

  // format 12 (segmented coverage, full Unicode)
  const nGroups = dv.getUint32(sub + 12);
  const groups = sub + 16;
  return (code) => {
    let lo = 0;
    let hi = nGroups - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const o = groups + mid * 12;
      const startChar = dv.getUint32(o);
      const endChar = dv.getUint32(o + 4);
      if (code < startChar) hi = mid - 1;
      else if (code > endChar) lo = mid + 1;
      else return dv.getUint32(o + 8) + (code - startChar);
    }
    return 0;
  };
}
