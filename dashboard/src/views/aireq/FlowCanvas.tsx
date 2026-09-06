import {
  DIFFICULTY_CONFIG, Difficulty, EVAL_COLOR, EVAL_ICON, EVAL_LABEL, JobReq,
} from "./model";

const DIFF_ORDER: Difficulty[] = ["easy", "medium", "hard", "extreme"];

/**
 * Centre canvas: connected flow nodes for each stage. Drag forward to advance
 * (gated by pass criteria), drag back for HR override, drag to fallout lane.
 */
export default function FlowCanvas({
  job,
  selected,
  onSelect,
  onDrop,
  onMove,
  onRemove,
}: {
  job: JobReq;
  selected: string | null;
  onSelect: (id: string) => void;
  onDrop: (candId: string, toId: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onOpenMail: (id: string) => void;
}) {
  const hired = job.stages[job.stages.length - 1];
  const fallout = job.candidates.filter((c) => c.stageId === "__fallout__");
  const maxCount = Math.max(1, ...job.stages.map((s) => job.candidates.filter((c) => c.stageId === s.id).length));

  return (
    <div className="jr-canvas">
      <div className="jr-canvas-head">
        <span>Live pipeline</span>
        <span className="jr-canvas-count">{job.stages.length} stages · {job.candidates.length} candidates</span>
      </div>

      <div className="jr-flow">
        {job.stages.map((s, i) => {
          const count = job.candidates.filter((c) => c.stageId === s.id).length;
          const diff = DIFFICULTY_CONFIG[s.difficulty ?? "medium"];
          const isHired = s.id === hired.id;
          const isApplied = i === 0;
          const pinned = isApplied || isHired;
          return (
            <div key={s.id} className="jr-flow-col">
              <div
                className={`jr-node${selected === s.id ? " selected" : ""}${isHired ? " hired" : ""}`}
                draggable={!pinned}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
                onClick={() => onSelect(s.id)}
              >
                <div className="jr-node-top">
                  <span className="jr-node-eval" style={{ background: EVAL_COLOR[s.evalType ?? "ai"] }}>
                    {EVAL_ICON[s.evalType ?? "ai"]}
                  </span>
                  {!pinned && <button className="jr-node-del" onClick={(e) => { e.stopPropagation(); onRemove(s.id); }}>✕</button>}
                </div>
                <div className="jr-node-name">{s.name}</div>
                <div className="jr-node-meta">
                  <span className="jr-node-diff" style={{ background: diff.color }}>{diff.icon} {diff.label}</span>
                  <span className="jr-node-gate">≥ {s.criteria}%</span>
                </div>
                <div className="jr-node-bar"><span style={{ width: `${(count / maxCount) * 100}%` }} /></div>
                <div className="jr-node-count">{count} candidate{count !== 1 ? "s" : ""}</div>
                {!pinned && (
                  <div className="jr-node-move">
                    <button onClick={(e) => { e.stopPropagation(); onMove(s.id, -1); }}>↑</button>
                    <button onClick={(e) => { e.stopPropagation(); onMove(s.id, 1); }}>↓</button>
                  </div>
                )}
              </div>
              {i < job.stages.length - 1 && <div className="jr-connector"><span>▶</span></div>}
            </div>
          );
        })}

        {/* Fallout lane */}
        <div className="jr-flow-col">
          <div
            className="jr-node fallout"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const candId = e.dataTransfer.getData("text/plain");
              if (candId) onDrop(candId, "__fallout__");
            }}
          >
            <div className="jr-node-top"><span className="jr-node-eval" style={{ background: "#ef4444" }}>✕</span></div>
            <div className="jr-node-name">Not Qualified</div>
            <div className="jr-node-count">{fallout.length} fallout</div>
          </div>
        </div>
      </div>

      {/* Difficulty legend */}
      <div className="jr-legend">
        {DIFF_ORDER.map((d) => (
          <span key={d} className="jr-legend-item" style={{ borderColor: DIFFICULTY_CONFIG[d].color }}>
            {DIFFICULTY_CONFIG[d].icon} {DIFFICULTY_CONFIG[d].label}
          </span>
        ))}
        <span className="jr-legend-sep">|</span>
        {(["ai", "human", "ai_human"] as const).map((t) => (
          <span key={t} className="jr-legend-item" style={{ borderColor: EVAL_COLOR[t] }}>
            {EVAL_ICON[t]} {EVAL_LABEL[t]}
          </span>
        ))}
      </div>
    </div>
  );
}