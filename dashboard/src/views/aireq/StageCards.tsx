import { useState } from "react";
import { EvalType, Stage, EVAL_LABEL, EVAL_COLOR, EVAL_DESC, STAGE_PRESETS, DEFAULT_MAIL } from "./model";
import StageProcessEditor from "./StageProcessEditor";
import { defaultProcessFor } from "./process";

export default function StageCards({
  stages,
  onChange,
}: {
  stages: Stage[];
  onChange: (stages: Stage[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [procFor, setProcFor] = useState<string | null>(null);

  const setStage = (id: string, patch: Partial<Stage>) =>
    onChange(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const applyPreset = (id: string, name: string) => {
    const p = STAGE_PRESETS.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
        if (p) onChange(stages.map((s) => (s.id === id ? { ...s, name: p.name, icon: p.icon, evalType: p.evalType, criteria: p.criteria, process: defaultProcessFor(p.name) } : s)));
    else onChange(stages.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const addStage = (stage: Stage) => {
    const next = [...stages];
    next.splice(next.length - 1, 0, stage);
    onChange(next);
  };

  const stageFor = (name: string): Stage => ({
    id: `st_${Date.now().toString(36)}`, name, icon: "📋", evalType: "ai", criteria: 70, difficulty: "medium",
    failLabel: `${name || "Stage"} Failed`, mail: { ...DEFAULT_MAIL }, process: defaultProcessFor(name),
  });

  const removeStage = (idx: number) => {
    if (idx === 0 || idx === stages.length - 1) return;
    onChange(stages.filter((_, i) => i !== idx));
  };

  const moveStage = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 1 || j >= stages.length - 1) return;
    const next = [...stages];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const reorderStages = (from: number, to: number) => {
    const n = stages.length;
    if (from === to || from < 1 || to < 1 || from > n - 2 || to > n - 2) return;
    const next = [...stages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const filteredPresets = filter
    ? STAGE_PRESETS.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : STAGE_PRESETS;

  return (
    <div className="jr-cards">
      {/* Preset filter */}
      <div className="jr-cards-toolbar">
        <input
          className="input"
          placeholder="🔍 Filter presets…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="jr-hint">Drag ⠿ to reorder · Applied & Hired are pinned</span>
      </div>

      {/* Stage cards grid */}
      <div className="jr-cards-grid">
        {stages.map((s, i) => {
          const isEndpoint = i === 0 || i === stages.length - 1;
          const preset = STAGE_PRESETS.find((p) => p.name.toLowerCase() === s.name.toLowerCase());
          const icon = preset?.icon ?? "📋";

          return (
            <div
              key={s.id}
              className={`jr-card${overIdx === i && dragIdx !== null && dragIdx !== i ? " drag-over" : ""}${dragIdx === i ? " dragging" : ""}${isEndpoint ? " endpoint" : ""}`}
              draggable={!isEndpoint}
              onDragStart={() => setDragIdx(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDrop={(e) => { e.preventDefault(); if (dragIdx != null) reorderStages(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
            >
              {/* Card header */}
              <div className="jr-card-top">
                {!isEndpoint && <span className="jr-grip" title="Drag to reorder">⠿</span>}
                <span className="jr-card-icon">{icon}</span>
                <span className="jr-card-num">{i + 1}</span>
                {s.name && <span className="jr-card-name">{s.name}</span>}
              </div>

              {/* Stage name dropdown */}
              <div className="jr-card-field">
                <label className="lbl">Stage name</label>
                <select
                  className="input"
                  value={s.name}
                  onChange={(e) => applyPreset(s.id, e.target.value)}
                >
                  <option value="">— pick a preset —</option>
                  <optgroup label="Preset stages">
                    {filteredPresets.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Custom">
                    <option value={s.name && !STAGE_PRESETS.find((p) => p.name === s.name) ? s.name : ""}>
                      {s.name && !STAGE_PRESETS.find((p) => p.name === s.name) ? `✏️ ${s.name} (custom)` : "✏️ Type a custom name…"}
                    </option>
                  </optgroup>
                </select>
              </div>

              {/* Eval type */}
              <div className="jr-card-field">
                <label className="lbl">Evaluation type</label>
                <div className="jr-eval-group">
                  {(Object.keys(EVAL_LABEL) as EvalType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`jr-eval-btn${s.evalType === t ? " active" : ""}`}
                      onClick={() => setStage(s.id, { evalType: t })}
                      style={{ borderColor: s.evalType === t ? EVAL_COLOR[t] : undefined }}
                      title={EVAL_DESC[t]}
                    >
                      {EVAL_LABEL[t]}
                    </button>
                  ))}
                </div>
                <div className="jr-eval-desc">{EVAL_DESC[s.evalType]}</div>
              </div>

              {/* Pass criteria */}
              <div className="jr-card-field">
                <label className="lbl">
                  Pass criteria <span className="jr-crit-val">{s.criteria}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={s.criteria}
                  onChange={(e) => setStage(s.id, { criteria: Number(e.target.value) })}
                  className="jr-slider"
                />
                <div className="jr-crit-scale">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Fail label */}
              <div className="jr-card-field">
                <label className="lbl">Fail label</label>
                <input
                  className="input"
                  value={s.failLabel ?? ""}
                  onChange={(e) => setStage(s.id, { failLabel: e.target.value })}
                  placeholder={`e.g. ${s.name || "Stage"} Failed`}
                />
              </div>

              {/* Action item on advance */}
              <div className="jr-card-field">
                <label className="lbl">Action item when candidate advances</label>
                <input
                  className="input"
                  value={s.action ?? ""}
                  onChange={(e) => setStage(s.id, { action: e.target.value })}
                  placeholder="e.g. Send email + schedule interview panel"
                />
              </div>

              {/* What this stage evaluates (dynamic process config) */}
              <div className="jr-card-proc">
                <button type="button" className={`jr-card-proc-btn${procFor === s.id ? " on" : ""}`} onClick={() => setProcFor(procFor === s.id ? null : s.id)}>
                  🧪 {procFor === s.id ? "Hide what it evaluates" : "Set what this stage evaluates ▸"}
                </button>
                {procFor === s.id && (
                  <StageProcessEditor
                    value={s.process ?? defaultProcessFor(s.name)}
                    onChange={(p) => setStage(s.id, { process: p })}
                  />
                )}
              </div>

              {/* Card actions */}
              {!isEndpoint && (
                <div className="jr-card-actions">
                  <button className="btn ghost sm" title="Move up" onClick={() => moveStage(i, -1)} disabled={i <= 1}>↑</button>
                  <button className="btn ghost sm" title="Move down" onClick={() => moveStage(i, 1)} disabled={i >= stages.length - 2}>↓</button>
                  <button className="btn ghost sm" title="Add stage after" onClick={() => addStage(stageFor("New Stage"))}>＋</button>
                  <button className="btn ghost sm danger" title="Remove" onClick={() => removeStage(i)}>🗑</button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add new stage card */}
        <div className="jr-card add-card" onClick={() => addStage(stageFor("New Stage"))}>
          <span className="jr-add-icon">＋</span>
          <span className="jr-add-text">Add stage</span>
          <span className="jr-add-hint">before Hired</span>
        </div>
      </div>
    </div>
  );
}