import { useEffect, useMemo, useState } from "react";
import type {
  BannerContent,
  BannerMode,
  BannerPreset,
  RenderInput,
} from "./engine/types";
import { LAYOUTS, PATTERNS, TEXTURES, FONT_REGISTRY } from "./engine/types";
import { effectiveSeed } from "./engine/renderBanner";
import {
  renderToPng,
  renderToSvg,
  exportBatch,
  downloadBlob,
  buildRecipe,
} from "./engine/exportImage";
import { defaultPresets } from "./data/defaultPresets";
import { forkPreset, makePresetId } from "./data/presetSchema";
import {
  loadSavedPresets,
  saveSavedPresets,
  loadRecents,
  pushRecent,
} from "./data/storage";
import { ensureWebFonts } from "./web/fonts";
import { BannerCanvas } from "./components/BannerCanvas";
import {
  Section,
  Field,
  TextInput,
  Select,
  Range,
  ColorField,
  Button,
} from "./components/ui";

const FONT_IDS = Object.keys(FONT_REGISTRY);

export default function App() {
  const [savedPresets, setSavedPresets] = useState<BannerPreset[]>(() => loadSavedPresets());
  const [recents, setRecents] = useState(() => loadRecents());

  // Working preset is an editable copy. Switching presets replaces it; editing
  // mutates the copy without touching the stored original until "Save".
  const [preset, setPreset] = useState<BannerPreset>(() => structuredClone(defaultPresets[0]));
  const [content, setContent] = useState<BannerContent>({
    title: "Notion Banner Generator",
    subtitle: "Local-first cover art, deterministic by design",
  });
  const [mode, setMode] = useState<BannerMode>("standard");
  const [showSafeArea, setShowSafeArea] = useState(true);

  // Load bundled fonts once; flip a flag so canvases re-measure/redraw exactly.
  // On failure we still proceed (engine falls back to a width heuristic).
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    ensureWebFonts().then(
      () => setFontsReady(true),
      () => setFontsReady(true),
    );
  }, []);

  const allPresets = useMemo(() => [...defaultPresets, ...savedPresets], [savedPresets]);
  const input: RenderInput = useMemo(() => ({ preset, content }), [preset, content]);
  const baseSeed = effectiveSeed(input);

  function update(patch: Partial<BannerPreset>) {
    setPreset((p) => ({ ...p, ...patch }));
  }
  function updatePalette(key: keyof BannerPreset["palette"], value: string) {
    setPreset((p) => ({ ...p, palette: { ...p.palette, [key]: value } }));
  }
  function updateType(patch: Partial<BannerPreset["typography"]>) {
    setPreset((p) => ({ ...p, typography: { ...p.typography, ...patch } }));
  }

  function selectPreset(id: string) {
    const found = allPresets.find((p) => p.id === id);
    if (found) setPreset(structuredClone(found));
  }

  function regenerate() {
    // New deterministic seed -> fresh procedural variation, still reproducible.
    update({ seed: `${preset.id}-${makePresetId("seed")}` });
  }

  function savePreset() {
    const name = window.prompt("Save preset as:", `${preset.name} copy`);
    if (!name) return;
    const forked = forkPreset(preset, name);
    const next = [...savedPresets, forked];
    setSavedPresets(next);
    saveSavedPresets(next);
    setPreset(structuredClone(forked));
  }

  const [batchCount, setBatchCount] = useState(4);
  const [busy, setBusy] = useState(false);

  async function exportPng() {
    const { blob, filename } = await renderToPng(input);
    downloadBlob(blob, filename);
    setRecents(pushRecent(buildRecipe(input)));
  }

  function exportSvg() {
    const { blob, filename } = renderToSvg(input);
    downloadBlob(blob, filename);
    setRecents(pushRecent(buildRecipe(input)));
  }

  async function exportVariations() {
    setBusy(true);
    try {
      const { blob, filename } = await exportBatch(input, batchCount);
      downloadBlob(blob, filename);
    } finally {
      setBusy(false);
    }
  }

  function exportRecipe() {
    const recipe = buildRecipe(input);
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" });
    downloadBlob(blob, `nbg_${preset.name.toLowerCase().replace(/\s+/g, "-")}_recipe.json`);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
      <Header mode={mode} setMode={setMode} />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        {/* LEFT: content + design controls */}
        <div className="space-y-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Section title="Content">
            <Field label="Page title">
              <TextInput
                value={content.title}
                onChange={(e) => setContent((c) => ({ ...c, title: e.target.value }))}
                placeholder="Page title"
              />
            </Field>
            <Field label="Subtitle (optional)">
              <TextInput
                value={content.subtitle ?? ""}
                onChange={(e) => setContent((c) => ({ ...c, subtitle: e.target.value }))}
                placeholder="Subtitle"
              />
            </Field>
            <Field label="Glyph (emoji or symbol)">
              <TextInput
                value={preset.glyph ?? ""}
                onChange={(e) => update({ glyph: e.target.value.slice(0, 4) || undefined })}
                placeholder="✦"
              />
            </Field>
          </Section>

          <Section title="Layout & pattern">
            <Field label="Layout">
              <Select value={preset.layout} onChange={(v) => update({ layout: v as BannerPreset["layout"] })} options={LAYOUTS} />
            </Field>
            <Field label="Pattern">
              <Select value={preset.pattern} onChange={(v) => update({ pattern: v as BannerPreset["pattern"] })} options={PATTERNS} />
            </Field>
            <Field label="Texture">
              <Select value={preset.texture} onChange={(v) => update({ texture: v as BannerPreset["texture"] })} options={TEXTURES} />
            </Field>
          </Section>

          <Section title="Typography">
            <Field label="Font">
              <Select value={preset.typography.titleFont} onChange={(v) => updateType({ titleFont: v as BannerPreset["typography"]["titleFont"] })} options={FONT_IDS} />
            </Field>
            <Field label={`Weight: ${preset.typography.weight}`}>
              <Range value={preset.typography.weight} min={300} max={900} step={100} onChange={(v) => updateType({ weight: v })} />
            </Field>
            <Field label={`Title scale: ${preset.typography.scale.toFixed(2)}×`}>
              <Range value={preset.typography.scale} min={0.6} max={1.6} step={0.05} onChange={(v) => updateType({ scale: v })} />
            </Field>
            <Field label={`Letter spacing: ${preset.typography.letterSpacing.toFixed(2)}em`}>
              <Range value={preset.typography.letterSpacing} min={-0.04} max={0.3} step={0.01} onChange={(v) => updateType({ letterSpacing: v })} />
            </Field>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={preset.typography.uppercase} onChange={(e) => updateType({ uppercase: e.target.checked })} className="accent-sky-500" />
                Uppercase
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={preset.typography.shadow} onChange={(e) => updateType({ shadow: e.target.checked })} className="accent-sky-500" />
                Text shadow
              </label>
            </div>
          </Section>

          <Section title="Palette">
            <div className="space-y-2">
              <ColorField label="Background" value={preset.palette.background} onChange={(v) => updatePalette("background", v)} />
              <ColorField label="Primary" value={preset.palette.primary} onChange={(v) => updatePalette("primary", v)} />
              <ColorField label="Secondary" value={preset.palette.secondary} onChange={(v) => updatePalette("secondary", v)} />
              <ColorField label="Accent (ink)" value={preset.palette.accent} onChange={(v) => updatePalette("accent", v)} />
            </div>
          </Section>
        </div>

        {/* CENTER: preview + variants */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={showSafeArea} onChange={(e) => setShowSafeArea(e.target.checked)} className="accent-sky-500" />
              Notion safe-area overlay
            </label>
            <div className="flex gap-2">
              <Button onClick={regenerate}>↻ Regenerate variation</Button>
              <Button variant="primary" onClick={exportPng}>↓ Export PNG</Button>
            </div>
          </div>

          <BannerCanvas input={input} showSafeArea={showSafeArea} seedNonce={preset.seed ? 1 : 0} fontsReady={fontsReady} />

          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Variations</h2>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((i) => {
                const variantSeed = `${baseSeed}#${i}`;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => update({ seed: variantSeed })}
                    className="overflow-hidden rounded-md ring-1 ring-white/10 transition hover:ring-sky-400/60"
                    title="Adopt this variation"
                  >
                    <BannerCanvas input={input} showSafeArea={false} seedOverride={variantSeed} seedNonce={i} fontsReady={fontsReady} />
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Output: 1500 × 600 PNG · seed <code className="text-slate-400">{baseSeed}</code> · everything renders locally, nothing is uploaded.
          </p>
        </div>

        {/* RIGHT: presets + export + AI */}
        <div className="space-y-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Section title="Presets" right={<Button variant="ghost" onClick={savePreset}>+ Save</Button>}>
            <div className="flex flex-wrap gap-2">
              {allPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    p.id === preset.id ? "border-sky-400/70 bg-sky-500/15 text-sky-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Export">
            <div className="flex flex-col gap-2">
              <Button variant="primary" onClick={exportPng}>Download PNG (1500 × 600)</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={exportSvg}>Vector SVG</Button>
                <Button onClick={exportRecipe}>Recipe JSON</Button>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100"
                >
                  {[4, 8, 12].map((n) => (
                    <option key={n} value={n} className="bg-slate-900">{n}</option>
                  ))}
                </select>
                <Button onClick={exportVariations} disabled={busy} title="Export N seeded variations as a ZIP">
                  {busy ? "Bundling…" : "Export variations .zip"}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Drop the PNG into a Notion page → <em>Add cover → Upload</em>. SVG stays editable vector; the ZIP bundles N seeded variations + recipes.
              </p>
            </div>
          </Section>

          <AiPanel mode={mode} />

          {recents.length > 0 && (
            <Section title="Recent exports">
              <ul className="space-y-1 text-xs text-slate-400">
                {recents.slice(0, 6).map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="truncate">{r.title || "Untitled"}</span>
                    <code className="shrink-0 text-slate-600">{r.preset.name}</code>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ mode, setMode }: { mode: BannerMode; setMode: (m: BannerMode) => void }) {
  const modes: { id: BannerMode; label: string; enabled: boolean }[] = [
    { id: "standard", label: "Standard compute", enabled: true },
    { id: "ai", label: "AI enhanced", enabled: false },
    { id: "hybrid", label: "Hybrid", enabled: false },
  ];
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🖼️</span>
        <div>
          <h1 className="text-lg font-semibold text-white">Notion Banner Generator</h1>
          <p className="text-xs text-slate-400">Local-first · deterministic · 1500 × 600</p>
        </div>
      </div>
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={!m.enabled}
            onClick={() => m.enabled && setMode(m.id)}
            title={m.enabled ? "" : "Arrives in Phase 3"}
            className={`rounded-md px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === m.id ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"
            }`}
          >
            {m.label}
            {!m.enabled && " ·"}
          </button>
        ))}
      </div>
    </header>
  );
}

function AiPanel({ mode }: { mode: BannerMode }) {
  return (
    <Section title="AI enhancement">
      <div className="rounded-lg border border-purple-400/20 bg-purple-500/5 p-3">
        <p className="text-xs text-slate-300">
          The AI concept generator, palette/motif suggestions, and preset refiner land in <strong>Phase 3</strong>. The provider contract (Ollama, LM Studio, DaveLLM Router, OpenAI-compatible, hosted) is already wired; standard compute is fully functional today.
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          Privacy: standard compute never sends data anywhere. AI mode will label the provider destination and redact context before any remote call.
        </p>
        {mode !== "standard" && (
          <p className="mt-2 text-[11px] text-amber-300">Selected mode is inactive until Phase 3 — rendering falls back to standard compute.</p>
        )}
      </div>
    </Section>
  );
}
