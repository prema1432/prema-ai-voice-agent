import { useEffect, useRef, useState } from "react";
import { Stage, STAGE_PRESETS, EVAL_COLOR, EVAL_LABEL, DEFAULT_MAIL } from "./model";

let seq = 0;
const nid = () => `st_${Date.now().toString(36)}_${++seq}`;

/**
 * Visual stage picker — a dropdown that opens into a grid of stage-type cards.
 * User clicks a card to add that stage (no typing required). Each stage is
 * a dynamic card with preset name, eval type, and criteria pre-filled.
 */
export default function StagePicker({
  onPick,
  existingNames,
}: {
  onPick: (stage: Stage) => void;
  existingNames?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const presets = filter
    ? STAGE_PRESETS.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : STAGE_PRESETS;

  const alreadyAdded = new Set(existingNames ?? []);

  return (
    <div className="jr-picker" ref={ref}>
      <button className="jr-picker-trigger" onClick={() => setOpen((o) => !o)}>
        <span>＋ Add stage</span>
        <span className="jr-picker-arrow">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="jr-picker-dropdown">
          <div className="jr-picker-toolbar">
            <input
              className="input"
              placeholder="🔍 Search stage types…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
            <span className="jr-picker-hint">{presets.length} types</span>
          </div>

          <div className="jr-picker-grid">
            {presets.map((p) => {
              const added = alreadyAdded.has(p.name);
              return (
                <button
                  key={p.name}
                  className={`jr-picker-card${added ? " added" : ""}`}
                  onClick={() => {
                    if (!added) {
                      onPick({ id: nid(), name: p.name, icon: p.icon, evalType: p.evalType, criteria: p.criteria, difficulty: p.difficulty, mail: { ...DEFAULT_MAIL } });
                      setFilter("");
                    }
                  }}
                  disabled={added}
                  style={{ borderColor: EVAL_COLOR[p.evalType] }}
                >
                  <span className="jr-picker-card-icon">{p.icon}</span>
                  <span className="jr-picker-card-name">{p.name}</span>
                  <span className="jr-picker-card-eval" style={{ color: EVAL_COLOR[p.evalType] }}>
                    {EVAL_LABEL[p.evalType]}
                  </span>
                  {p.criteria > 0 && p.criteria < 100 && (
                    <span className="jr-picker-card-crit">≥{p.criteria}%</span>
                  )}
                  {added && <span className="jr-picker-card-check">✓ added</span>}
                </button>
              );
            })}
          </div>

          <div className="jr-picker-footer">
            Pick a stage type to add it — eval type &amp; pass criteria are pre-filled, editable after.
          </div>
        </div>
      )}
    </div>
  );
}