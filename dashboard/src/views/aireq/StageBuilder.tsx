import { useState } from "react";
import { Button } from "../../components";
import { DEFAULT_MAIL, defaultStages, Stage, EVAL_COLOR, EVAL_LABEL } from "./model";
import StageCards from "./StageCards";

/** Quick-start stage templates. */
const TEMPLATES: { name: string; icon: string; stages: Stage[] }[] = [
  { name: "Software Engineer", icon: "💻", stages: defaultStages() },
  {
    name: "Product Manager", icon: "📊",
        stages: [
      { id: "t_applied", name: "Applied", icon: "📥", criteria: 0, evalType: "ai", difficulty: "easy", failLabel: "Not Eligible", mail: { ...DEFAULT_MAIL } },
      { id: "t_resume", name: "Resume Screening", icon: "📄", criteria: 70, evalType: "ai", difficulty: "medium", failLabel: "Resume Rejected", mail: { ...DEFAULT_MAIL } },
      { id: "t_case", name: "Case Study", icon: "📊", criteria: 65, evalType: "ai_human", difficulty: "medium", failLabel: "Case Study Failed", mail: { ...DEFAULT_MAIL } },
      { id: "t_product", name: "Product Sense", icon: "💡", criteria: 70, evalType: "human", difficulty: "medium", failLabel: "Product Sense Failed", mail: { ...DEFAULT_MAIL } },
      { id: "t_leadership", name: "Leadership", icon: "🌟", criteria: 70, evalType: "human", difficulty: "hard", failLabel: "Leadership Failed", mail: { ...DEFAULT_MAIL } },
      { id: "t_hired", name: "Hired", icon: "🎉", criteria: 100, evalType: "human", difficulty: "easy", mail: { ...DEFAULT_MAIL } },
    ],
  },
  {
    name: "Sales Executive", icon: "🤝",
    stages: [
            { id: "t_applied", name: "Applied", icon: "📥", criteria: 0, evalType: "ai", difficulty: "easy", failLabel: "Not Eligible", mail: { ...DEFAULT_MAIL } },
      { id: "t_resume", name: "Resume Screening", icon: "📄", criteria: 60, evalType: "ai", difficulty: "medium", failLabel: "Resume Rejected", mail: { ...DEFAULT_MAIL } },
      { id: "t_aptitude", name: "Aptitude", icon: "🧠", criteria: 60, evalType: "ai", difficulty: "medium", failLabel: "Aptitude Failed", mail: { ...DEFAULT_MAIL } },
      { id: "t_roleplay", name: "Role Play", icon: "🎭", criteria: 70, evalType: "ai_human", difficulty: "medium", failLabel: "Role Play Failed", mail: { ...DEFAULT_MAIL } },
      { id: "t_hr", name: "HR Round", icon: "🤝", criteria: 70, evalType: "human", difficulty: "easy", failLabel: "HR Rejected", mail: { ...DEFAULT_MAIL } },
      { id: "t_hired", name: "Hired", icon: "🎉", criteria: 100, evalType: "human", difficulty: "easy", mail: { ...DEFAULT_MAIL } },
    ],
  },
  {
    name: "Minimal", icon: "⚡",
        stages: [
      { id: "t_applied", name: "Applied", icon: "📥", criteria: 0, evalType: "ai", difficulty: "easy", failLabel: "Not Eligible", mail: { ...DEFAULT_MAIL } },
      { id: "t_screening", name: "Screening", icon: "📄", criteria: 70, evalType: "ai", difficulty: "medium", failLabel: "Screening Failed", mail: { ...DEFAULT_MAIL } },
      { id: "t_interview", name: "Interview", icon: "🛠", criteria: 70, evalType: "human", difficulty: "hard", failLabel: "Interview Failed", mail: { ...DEFAULT_MAIL } },
      { id: "t_hired", name: "Hired", icon: "🎉", criteria: 100, evalType: "human", difficulty: "easy", mail: { ...DEFAULT_MAIL } },
    ],
  },
];

let seq = 0;
const nid = () => `st_${Date.now().toString(36)}_${++seq}`;

/**
 * Dynamic visual stage builder — live pipeline flow preview, drag-to-reorder,
 * stage templates, animated transitions, per-stage eval type + criteria.
 * Uses visual stage cards with dropdowns.
 */
export default function StageBuilder({
  stages,
  onChange,
}: {
  stages: Stage[];
  onChange: (stages: Stage[]) => void;
}) {
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div className="jr-stage-builder">
      {/* Live pipeline flow preview */}
      <div className="jr-flow-preview">
        <div className="jr-flow-title">Live pipeline preview</div>
        <div className="jr-flow-track">
          {stages.map((s, i) => (
            <div key={s.id} className="jr-flow-node-wrap">
              <div
                className="jr-flow-node"
                style={{
                  borderColor: EVAL_COLOR[s.evalType],
                  background: i === stages.length - 1 ? "var(--green, #10b981)" : i === 0 ? "var(--well, rgba(99,102,241,0.08))" : "var(--card)",
                  color: i === stages.length - 1 ? "#fff" : "var(--text)",
                }}
              >
                <span className="jr-flow-ic">{i === stages.length - 1 ? "🎯" : i === 0 ? "📥" : EVAL_LABEL[s.evalType]?.split(" ")[0]}</span>
                <span className="jr-flow-name">{s.name}</span>
                {s.criteria > 0 && s.criteria < 100 && (
                  <span className="jr-flow-crit">≥{s.criteria}%</span>
                )}
              </div>
              {i < stages.length - 1 && (
                <div className="jr-flow-arrow" style={{ color: EVAL_COLOR[s.evalType] }}>
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stage templates */}
      <div className="jr-templates">
        <Button size="sm" variant="ghost" onClick={() => setShowTemplates((s) => !s)}>
          {showTemplates ? "▾ Hide templates" : "▸ Quick-start templates"}
        </Button>
        {showTemplates && (
          <div className="jr-template-grid">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                className="jr-template-card"
                onClick={() => {
                  onChange(t.stages.map((s) => ({ ...s, id: nid() })));
                  setShowTemplates(false);
                }}
              >
                <span className="jr-template-icon">{t.icon}</span>
                <span className="jr-template-name">{t.name}</span>
                <span className="jr-template-count">{t.stages.length} stages</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Visual stage cards with dropdowns */}
      <div className="jr-cards-section">
        <div className="jr-cards-section-header">
          <span>Stages ({stages.length})</span>
          <span className="jr-hint">Each stage is a card — pick eval type, set pass %, drag ⠿ to reorder</span>
        </div>
        <StageCards stages={stages} onChange={onChange} />
      </div>
    </div>
  );
}