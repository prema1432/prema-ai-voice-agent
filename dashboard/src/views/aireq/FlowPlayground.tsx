import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, type Node, type Edge, type OnConnect,
  type NodeTypes, type Connection, MarkerType, type NodeDragHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import StageSidebar from "./StageSidebar";
import StageNode from "./StageNode";
import StageProcessEditor from "./StageProcessEditor";
import { type JobReq, type Stage, EVAL_COLOR, DIFFICULTY_CONFIG, DEFAULT_MAIL } from "./model";
import { defaultProcessFor } from "./process";

/** Vertical spacing between pipeline rows — used to snap drag-reorder. */
const ROW_H = 140;

/**
 * React Flow pipeline builder.
 * Left: the flow canvas — drag nodes vertically to reorder, click to configure.
 * Right rail: the full draggable stage library on top, configuration panel below.
 */
export default function FlowPlayground({ job, onChange }: { job: JobReq; onChange: (j: JobReq) => void }) {
  const initialNodes: Node<Stage>[] = useMemo(
    () => job.stages.map((s, i) => ({ id: s.id, type: "stage", position: { x: 220, y: i * ROW_H }, data: s })),
    [job.stages],
  );
  const [nodes, setNodes] = useState<Node<Stage>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(() =>
    job.stages.slice(0, -1).map((s, i) => ({
      id: `e-${s.id}-${job.stages[i + 1].id}`, source: s.id, target: job.stages[i + 1].id,
      animated: true, markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "var(--accent-1, #6366f1)", strokeWidth: 2 },
    })),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const nodeTypes: NodeTypes = useMemo(() => ({ stage: StageNode }), []);

  const syncFromStages = useCallback((stages: Stage[]) => {
    setNodes((prev) => {
      const ex = new Map(prev.map((n) => [n.id, n]));
      return stages.map((s, i) => ex.get(s.id) ? { ...ex.get(s.id)!, position: { x: 220, y: i * ROW_H }, data: s } : { id: s.id, type: "stage", position: { x: 220, y: i * ROW_H }, data: s });
    });
    setEdges((prev) => {
      const wanted = stages.slice(0, -1).map((s, i) => `e-${s.id}-${stages[i + 1].id}`);
      const kept = prev.filter((e) => wanted.includes(e.id));
      const have = new Set(kept.map((e) => e.id));
      for (let i = 0; i < stages.length - 1; i++) {
        const id = `e-${stages[i].id}-${stages[i + 1].id}`;
        if (!have.has(id)) kept.push({ id, source: stages[i].id, target: stages[i + 1].id, animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "var(--accent-1, #6366f1)", strokeWidth: 2 } });
      }
      return kept;
    });
  }, []);

  useEffect(() => {
    syncFromStages(job.stages);
  }, [job.stages, syncFromStages]);

  const onConnect: OnConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    setEdges((es) => {
      const id = `e-${c.source}-${c.target}`;
      if (es.some((e) => e.id === id)) return es;
      return [...es, { id, source: c.source!, target: c.target!, animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "var(--accent-1, #6366f1)", strokeWidth: 2 } }];
    });
  }, []);

  /** Drag a stage card from the right-side library onto the canvas → insert before "Hired". */
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/prema-stage");
    if (!raw) return;
    const preset = JSON.parse(raw) as { name: string; icon: string; evalType: Stage["evalType"]; difficulty: Stage["difficulty"]; criteria: number };
    const id = `st_${Date.now().toString(36)}`;
    const ns: Stage = { id, name: preset.name, icon: preset.icon, evalType: preset.evalType, difficulty: preset.difficulty, criteria: preset.criteria, failLabel: `${preset.name} Failed`, mail: { ...DEFAULT_MAIL }, process: defaultProcessFor(preset.name) };
    const nj = { ...job, stages: [...job.stages.slice(0, -1), ns, job.stages[job.stages.length - 1]] };
    onChange(nj); syncFromStages(nj.stages); setSelected(id);
  }, [job, onChange, syncFromStages]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  /** Drag a node on the canvas → reorder the pipeline (snap into the row grid). */
  const onNodeDragStop: NodeDragHandler = useCallback((_e, node) => {
    const cur = job.stages.findIndex((s) => s.id === node.id);
    if (cur === -1) return;
    const target = Math.max(1, Math.min(job.stages.length - 2, Math.round(node.position.y / ROW_H)));
    if (target === cur) return;
    const next = [...job.stages];
    const [moved] = next.splice(cur, 1);
    next.splice(target, 0, moved);
    onChange({ ...job, stages: next });
    syncFromStages(next);
  }, [job, onChange, syncFromStages]);

  const updateStage = useCallback((id: string, patch: Partial<Stage>) => { onChange({ ...job, stages: job.stages.map((s) => s.id === id ? { ...s, ...patch } : s) }); }, [job, onChange]);
  const removeStage = useCallback((id: string) => { if (id === job.stages[0].id || id === job.stages[job.stages.length - 1].id) return; onChange({ ...job, stages: job.stages.filter((s) => s.id !== id) }); }, [job, onChange]);

  const selectedStage = nodes.find((n) => n.id === selected)?.data;

  return (
    <div className="jr-playground">
      {/* Left: flow canvas */}
      <div className="jr-canvas-wrap" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, n) => setSelected(n.id)} onPaneClick={() => setSelected(null)} onNodeDragStop={onNodeDragStop} onConnect={onConnect} fitView proOptions={{ hideAttribution: true }} nodesConnectable={false}>
          <Background gap={20} size={1} color="var(--border, rgba(120,130,160,0.3))" />
          <Controls />
          <MiniMap nodeColor={(n) => DIFFICULTY_CONFIG[((n.data as Stage)?.difficulty ?? "medium") as keyof typeof DIFFICULTY_CONFIG]?.color ?? "var(--accent-1, #6366f1)"} maskColor="rgba(10,15,40,0.15)" />
        </ReactFlow>
      </div>

      {/* Right rail: all stages to drag + configure the selected one */}
      <aside className="jr-rail">
        <StageSidebar />
        <div className="jr-config-wrap">
          {selectedStage ? (
            <div className="jr-detail">
              <div className="jr-detail-head">
                <span className="jr-detail-icon" style={{ background: EVAL_COLOR[selectedStage.evalType] }}>{selectedStage.icon}</span>
                <input className="jr-detail-name" value={selectedStage.name} onChange={(e) => updateStage(selectedStage.id, { name: e.target.value })} />
                <button className="btn ghost sm danger" onClick={() => removeStage(selectedStage.id)}>🗑</button>
              </div>
              <div className="jr-detail-body">
                <div className="jr-field"><label>Eval type</label>
                  <div className="jr-eval-row">
                    {(["ai", "human", "ai_human"] as const).map((t) => (
                      <button key={t} className={`jr-eval-btn${selectedStage.evalType === t ? " on" : ""}`} style={{ borderColor: selectedStage.evalType === t ? EVAL_COLOR[t] : undefined }} onClick={() => updateStage(selectedStage.id, { evalType: t })}>
                        {t === "ai" ? "🤖 AI" : t === "human" ? "🧑 Human" : "🤝 AI+Human"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="jr-field"><label>Difficulty</label>
                  <div className="jr-diff-row">
                    {(["easy", "medium", "hard", "extreme"] as const).map((d) => { const c = DIFFICULTY_CONFIG[d]; return (
                      <button key={d} className={`jr-diff-btn${selectedStage.difficulty === d ? " on" : ""}`} style={{ borderColor: selectedStage.difficulty === d ? c.color : undefined, color: selectedStage.difficulty === d ? c.color : undefined }} onClick={() => updateStage(selectedStage.id, { difficulty: d })}>{c.icon} {c.label}</button>
                    ); })}
                  </div>
                </div>
                <div className="jr-field"><label>Pass criteria: {selectedStage.criteria}%</label>
                  <input type="range" min={0} max={100} value={selectedStage.criteria} onChange={(e) => updateStage(selectedStage.id, { criteria: Number(e.target.value) })} className="jr-range" />
                </div>
                <div className="jr-field"><label>Fail label</label>
                  <input className="input" value={selectedStage.failLabel} onChange={(e) => updateStage(selectedStage.id, { failLabel: e.target.value })} />
                </div>
                <div className="jr-field"><label>Action item when candidate advances</label>
                  <input
                    className="input"
                    value={selectedStage.action ?? ""}
                    onChange={(e) => updateStage(selectedStage.id, { action: e.target.value })}
                    placeholder="e.g. Send email + schedule interview panel"
                  />
                  <span className="jr-hint">Shown on the board and appended to the candidate's pass history.</span>
                </div>
                <div className="jr-proc-wrap">
                  <div className="jr-proc-title">🧪 What this stage evaluates</div>
                  <StageProcessEditor
                    value={selectedStage.process ?? defaultProcessFor(selectedStage.name)}
                    onChange={(p) => updateStage(selectedStage.id, { process: p })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="jr-config-empty">
              👆 Select a stage on the canvas to configure it<br />
              <span>…or drag one from the library above</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}