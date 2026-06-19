import { useEffect, useRef } from "react";
import type { RenderInput } from "../engine/types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, SAFE_AREA } from "../engine/types";
import { renderBanner } from "../engine/renderBanner";

// On-screen preview. Renders at full 1500x600 internal resolution and scales
// down via CSS, so the preview is pixel-accurate to the export. The safe-area
// overlay is a DOM layer (not painted into the canvas), so it is never exported.

interface Props {
  input: RenderInput;
  showSafeArea: boolean;
  seedNonce?: number;
  seedOverride?: string;
  /** Bumped when web fonts finish loading so text re-measures/redraws exactly. */
  fontsReady?: boolean;
}

export function BannerCanvas({ input, showSafeArea, seedNonce, seedOverride, fontsReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderBanner(ctx, input, seedOverride);
  }, [input, seedNonce, seedOverride, fontsReady]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl ring-1 ring-white/10 shadow-2xl">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block w-full h-auto"
        style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      />
      {showSafeArea && <SafeAreaOverlay />}
    </div>
  );
}

function SafeAreaOverlay() {
  const top = `${SAFE_AREA.topRatio * 100}%`;
  const bottom = `${(1 - SAFE_AREA.bottomRatio) * 100}%`;
  const left = `${SAFE_AREA.leftRatio * 100}%`;
  const right = `${(1 - SAFE_AREA.rightRatio) * 100}%`;
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* dim the area Notion is likely to crop away */}
      <div className="absolute inset-x-0 top-0 bg-black/45" style={{ height: top }} />
      <div className="absolute inset-x-0 bottom-0 bg-black/45" style={{ height: bottom }} />
      {/* safe-zone outline */}
      <div
        className="absolute border border-dashed border-sky-400/70"
        style={{ top, bottom, left, right }}
      />
      <span className="absolute left-2 rounded bg-sky-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ top: `calc(${top} + 6px)` }}>
        Notion safe area
      </span>
    </div>
  );
}
