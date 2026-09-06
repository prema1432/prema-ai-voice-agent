import { Button } from "../../components";
import {
  DIFFICULTY_CONFIG, Difficulty, EVAL_COLOR, EVAL_ICON, EVAL_LABEL, Stage,
} from "./model";

const DIFF_ORDER: Difficulty[] = ["easy", "medium", "hard", "extreme"];

/** Right detail panel: configure the selected stage's criteria, eval type, difficulty, fail label. */
export default function StageDetail({
  stage,
  onUpdate,
  onOpenMail,
}: {
  stage: Stage;
  onUpdate: (patch: Partial<Stage>) => void;
  onOpenMail: () => void;
}) {
  const diff = DIFFICULTY_CONFIG[stage.difficulty ?? "medium"];
  return (
    <div className="jr-detail">
      <div className="card-head"><h3>⚙️ {stage.name}</h3><span className="jr-open-badge open" style={{ background: diff.color }}>{diff.icon} {diff.label}</span></div>
      <div className="jr-detail-body">
        <div>
          <label className="lbl">Pass criteria: {stage.criteria}%</label>
          <input type="range" min={0} max={100} value={stage.criteria} onChange={(e) => onUpdate({ criteria: Number(e.target.value) })} />
        </div>
        <div>
          <label className="lbl">Evaluation</label>
          <div className="jr-eval-row">
            {(["ai", "human", "ai_human"] as const).map((t) => (
              <button
                key={t}
                className={`jr-eval-btn${stage.evalType === t ? " active" : ""}`}
                style={{ borderColor: stage.evalType === t ? EVAL_COLOR[t] : undefined }}
                onClick={() => onUpdate({ evalType: t })}
              >{EVAL_ICON[t]} {EVAL_LABEL[t]}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="lbl">Difficulty</label>
          <div className="jr-eval-row">
            {DIFF_ORDER.map((d) => (
              <button
                key={d}
                className={`jr-eval-btn${stage.difficulty === d ? " active" : ""}`}
                style={{ borderColor: stage.difficulty === d ? DIFFICULTY_CONFIG[d].color : undefined }}
                onClick={() => onUpdate({ difficulty: d })}
              >{DIFFICULTY_CONFIG[d].icon} {DIFFICULTY_CONFIG[d].label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="lbl">Fail label</label>
          <input className="input" value={stage.failLabel ?? ""} onChange={(e) => onUpdate({ failLabel: e.target.value })} placeholder={`${stage.name} Failed`} />
        </div>
        <Button size="sm" onClick={onOpenMail}>✉️ Configure mail templates</Button>
      </div>
    </div>
  );
}