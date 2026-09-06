import { STAGE_PRESETS, DIFFICULTY_CONFIG, EVAL_ICON, type StagePreset } from "./model";

/** Draggable sidebar — stage-type cards that can be dropped onto the canvas.
 *  Uses plain HTML5 drag-and-drop (not reactflow's internal useDrag) so it works
 *  across reactflow v11+ public API. */
export default function StageSidebar() {
  return (
    <div className="jr-sidebar">
      <div className="jr-sidebar-title">Stage Types</div>
      <div className="jr-sidebar-sub">Drag onto canvas to add</div>
      <div className="jr-sidebar-list">
        {STAGE_PRESETS.map((p) => (
          <DraggableCard key={p.name} preset={p} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ preset }: { preset: StagePreset }) {
  const diff = DIFFICULTY_CONFIG[preset.difficulty];
  return (
    <div
      className="jr-drag-card"
      style={{ borderLeftColor: diff.color }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/prema-stage", JSON.stringify({ name: preset.name, icon: preset.icon, evalType: preset.evalType, difficulty: preset.difficulty, criteria: preset.criteria }));
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <span className="jr-drag-icon">{preset.icon}</span>
      <span className="jr-drag-info">
        <span className="jr-drag-name">{preset.name}</span>
        <span className="jr-drag-meta">{EVAL_ICON[preset.evalType]} · {diff.icon} {diff.label} · ≥{preset.criteria}%</span>
      </span>
    </div>
  );
}