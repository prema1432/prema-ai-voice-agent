import { DIFFICULTY_CONFIG, STAGE_PRESETS, StagePreset } from "./model";

/** Left sidebar: clickable/draggable stage presets to add before "Hired". */
export default function StageLibrary({ onAdd }: { onAdd: (p: StagePreset) => void }) {
  return (
    <aside className="jr-lib">
      <div className="jr-lib-head">📦 Stage Library</div>
      <div className="jr-lib-sub">Click or drag to add before "Hired"</div>
      <div className="jr-lib-list">
        {STAGE_PRESETS.map((p) => (
          <div
            key={p.name}
            className="jr-lib-item"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", p.name)}
            onClick={() => onAdd(p)}
            title={`Add "${p.name}" stage`}
          >
            <span className="jr-lib-icon">{p.icon}</span>
            <span className="jr-lib-name">{p.name}</span>
            <span className="jr-lib-diff" style={{ color: DIFFICULTY_CONFIG[p.difficulty].color }}>
              {DIFFICULTY_CONFIG[p.difficulty].icon}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}