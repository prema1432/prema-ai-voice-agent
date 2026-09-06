import { useState } from "react";
import { Button, Card } from "../../components";
import { JobReq, MODE_LABEL, newJob, WorkMode } from "./model";
import ApplyFieldsEditor from "./ApplyFieldsEditor";
import StageBuilder from "./StageBuilder";
import FlowPlayground from "./FlowPlayground";

/** Job Description editor + pipeline stage builder with pass-criteria gates. */
export default function JobEditor({
  job,
  onSave,
  onCancel,
}: {
  job: JobReq;
  onSave: (j: JobReq) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<JobReq>(job.id && job.title ? job : newJob());
  const [skillsText, setSkillsText] = useState(job.skills.join(", "));
  const [view, setView] = useState<"form" | "pipeline">("pipeline");
  const set = (patch: Partial<JobReq>) => setDraft({ ...draft, ...patch });

  function save() {
    if (!draft.title.trim()) return;
    const skills = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
    onSave({
      ...draft,
      skills,
      ctcMin: Number(draft.ctcMin) || 0,
      ctcMax: Number(draft.ctcMax) || 0,
      openings: Math.max(1, Number(draft.openings) || 1),
      minExp: Math.max(0, Number(draft.minExp) || 0),
    });
  }

  return (
    <Card style={{ marginBottom: 18 }}>
      <div className="card-head">
        <h3>📋 Job description</h3>
        <span className="chip">{draft.stages.length} stages</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div>
          <label className="lbl">Job title *</label>
          <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Senior Frontend Engineer" />
        </div>
        <div>
          <label className="lbl">Work mode</label>
          <select className="input" value={draft.mode} onChange={(e) => set({ mode: e.target.value as WorkMode })}>
            {(Object.keys(MODE_LABEL) as WorkMode[]).map((m) => (
              <option key={m} value={m}>{MODE_LABEL[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Package range (₹ LPA)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" type="number" min={0} value={draft.ctcMin || ""} onChange={(e) => set({ ctcMin: Number(e.target.value) })} placeholder="Min" />
            <input className="input" type="number" min={0} value={draft.ctcMax || ""} onChange={(e) => set({ ctcMax: Number(e.target.value) })} placeholder="Max" />
          </div>
        </div>
        <div>
          <label className="lbl">Open positions</label>
          <input className="input" type="number" min={1} value={draft.openings} onChange={(e) => set({ openings: Number(e.target.value) })} />
        </div>
        <div>
          <label className="lbl">Last date to apply</label>
          <input className="input" type="date" value={draft.lastDate} onChange={(e) => set({ lastDate: e.target.value })} />
        </div>
        <div>
          <label className="lbl">Min experience (years)</label>
          <input className="input" type="number" min={0} value={draft.minExp} onChange={(e) => set({ minExp: Number(e.target.value) })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="lbl">Description</label>

          <textarea className="input" rows={3} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="What the role is about, responsibilities, team…" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="lbl">Required skills (comma separated — drives AI resume screening)</label>
          <input className="input" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="React, TypeScript, Node.js, REST APIs" />
        </div>
      </div>
      <div className="view-toggle" style={{ marginBottom: 14 }}>
        <button className={`view-tgl-btn${view === "form" ? " on" : ""}`} onClick={() => setView("form")}>📋 Job details</button>
        <button className={`view-tgl-btn${view === "pipeline" ? " on" : ""}`} onClick={() => setView("pipeline")}>🎨 Flow builder</button>
      </div>

      {view === "form" ? (
        <>
          <ApplyFieldsEditor job={draft} onChange={(applyFields) => set({ applyFields })} />
          <StageBuilder stages={draft.stages} onChange={(stages) => set({ stages })} />
        </>
      ) : (
        <FlowPlayground job={draft} onChange={setDraft} />
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Button variant="primary" onClick={save}>💾 Save job</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}
