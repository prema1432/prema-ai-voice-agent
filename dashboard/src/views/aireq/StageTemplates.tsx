import { useEffect, useState } from "react";
import { Button, Card, EmptyState } from "../../components";
import { defaultStages, newTemplate, nid, Stage, StageTemplate, loadTemplates, saveTemplates } from "./model";
import StageBuilder from "./StageBuilder";

const ICONS = ["📋", "💻", "📊", "🤝", "🎯", "⚡", "🧪", "🏗", "🚀", "🎓", "💡", "🔬"];

/**
 * Stage Template Library — create, edit, and manage reusable hiring pipelines.
 * Each template is a full stage flow (with eval types + criteria) that can be
 * applied to any job requisition. Stages are fully dynamic.
 */
export default function StageTemplates({ onApplyToJob }: { onApplyToJob?: (stages: Stage[]) => void }) {
  const [templates, setTemplates] = useState<StageTemplate[]>(() => loadTemplates());
  const [editing, setEditing] = useState<StageTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  function startNew() {
    setEditing(newTemplate());
    setShowForm(true);
  }

  function startEdit(t: StageTemplate) {
    setEditing({ ...t, stages: t.stages.map((s) => ({ ...s })) });
    setShowForm(true);
  }

  function save() {
    if (!editing?.name.trim()) return;
    if (templates.some((t) => t.id === editing.id)) {
      setTemplates(templates.map((t) => (t.id === editing.id ? editing : t)));
    } else {
      setTemplates([editing, ...templates]);
    }
    setEditing(null);
    setShowForm(false);
  }

  function remove(id: string) {
    if (confirm("Delete this template?")) setTemplates(templates.filter((t) => t.id !== id));
  }

  function duplicate(t: StageTemplate) {
    setTemplates([
      { ...t, id: nid("tmpl"), name: `${t.name} (copy)`, stages: t.stages.map((s) => ({ ...s })), createdAt: new Date().toISOString() },
      ...templates,
    ]);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🧱 Stage Templates</h2>
          <div className="sub">Create reusable hiring pipelines — each with dynamic stages, eval types, and pass criteria. Apply them to any job.</div>
        </div>
        <div className="page-head-actions">
          <Button variant="primary" onClick={startNew}>＋ New template</Button>
        </div>
      </div>

      {showForm && editing && (
        <Card style={{ marginBottom: 18 }}>
          <div className="card-head">
            <h3>{editing.name ? `Editing: ${editing.name}` : "✨ New stage template"}</h3>
            <span className="chip">{editing.stages.length} stages</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div>
              <label className="lbl">Template name *</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Software Engineer Pipeline" />
            </div>
            <div>
              <label className="lbl">Icon</label>
              <div className="jr-icon-picker">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    className={`jr-icon-btn${editing.icon === ic ? " active" : ""}`}
                    onClick={() => setEditing({ ...editing, icon: ic })}
                    type="button"
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="lbl">Description</label>
              <input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="When to use this pipeline…" />
            </div>
          </div>

          <div className="lbl">Pipeline stages — fully dynamic</div>
          <StageBuilder stages={editing.stages} onChange={(stages) => setEditing({ ...editing, stages })} />

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={save}>💾 Save template</Button>
            <Button onClick={() => setEditing({ ...editing, stages: defaultStages() })}>↺ Reset to default</Button>
            <Button onClick={() => { setEditing(null); setShowForm(false); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {templates.length === 0 && !showForm ? (
        <Card>
          <EmptyState
            icon="🧱"
            title="No stage templates yet"
            sub="Create your first reusable hiring pipeline — add dynamic stages, set eval types and pass criteria, then apply it to any job."
          />
        </Card>
      ) : (
        <div className="jr-template-grid">
          {templates.map((t) => (
            <Card key={t.id} className="jr-template-card">
              <div className="jr-template-top">
                <span className="jr-template-icon">{t.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{t.name || "Untitled template"}</b>
                  <em>{t.description || "No description"}</em>
                </div>
                <span className="chip">{t.stages.length} stages</span>
              </div>

              <div className="jr-template-flow">
                {t.stages.slice(0, 5).map((s, i) => (
                  <span key={s.id} className="jr-flow-mini">
                    {i > 0 && <span className="jr-flow-arrow">›</span>}
                    {s.name}
                  </span>
                ))}
                {t.stages.length > 5 && <span className="jr-flow-more">+{t.stages.length - 5} more</span>}
              </div>

              <div className="jr-template-actions">
                {onApplyToJob && (
                  <Button size="sm" variant="primary" onClick={() => onApplyToJob(t.stages.map((s) => ({ ...s, id: nid("st") })))}>
                    ➕ Apply to job
                  </Button>
                )}
                <Button size="sm" onClick={() => startEdit(t)}>✏️ Edit</Button>
                <Button size="sm" onClick={() => duplicate(t)}>📋 Copy</Button>
                <Button size="sm" variant="danger" onClick={() => remove(t.id)}>🗑</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}