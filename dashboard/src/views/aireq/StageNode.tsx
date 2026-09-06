import { Handle, Position, type NodeProps } from "reactflow";
import { DIFFICULTY_CONFIG, EVAL_ICON, type Stage } from "./model";

/** Custom React Flow node representing a pipeline stage. */
export default function StageNode({ data, selected }: NodeProps<Stage>) {
  const diff = DIFFICULTY_CONFIG[data.difficulty];

  return (
    <div className={`jr-node${selected ? " selected" : ""}`} style={{ borderTopColor: diff.color }}>
      <Handle type="target" position={Position.Top} className="jr-handle" />
      <div className="jr-node-head">
        <span className="jr-node-eval">{EVAL_ICON[data.evalType]}</span>
        <span className="jr-node-name">{data.name}</span>
      </div>
      <div className="jr-node-body">
        <span className="jr-node-diff" style={{ color: diff.color }}>
          {diff.icon} {diff.label}
        </span>
        <span className="jr-node-crit">≥ {data.criteria}%</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="jr-handle" />
    </div>
  );
}