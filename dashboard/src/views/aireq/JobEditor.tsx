import { useState } from "react";
import { Button, Card } from "../../components";
import { defaultStages, JobReq, MODE_LABEL, newJob, Stage, WorkMode } from "./model";

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
  const set = (patch: Partial<JobReq>) => setDraft({ ...draft, ...patch });

  const setStage = (id: string, patch: Partial<Stage>) =>
    set({ stages: draft.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const moveStage = (idx: number, dir: -1 | 1) => {
    const next = [...draft.stages];
    const j = idx + dir;
    if (j < 1 || j >= next.length - 1) return; // Applied stays first, Hired stays last
    [next[idx], next[j]] = [next[j], next[idx]];
    set({ stages: next });
  };

  const addStage = (afterIdx: number) => {
    const next = [...draft.stages];
    next.splice(afterIdx + 1, 0, { id: `st_${Date.now().toString(36)}`, name: "New Round", criteria: 60 });
    set({ stages: next });
  };

  const removeStage = (idx: number) => {
    if (idx === 0 || idx === draft.stages.length - 1) return; // Applied / Hired fixed
    set({ stages: draft.stages.filter((_, i) => i !== idx) });
  };

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
      <div className="lbl" style={{ marginTop: 18 }}>Pipeline stages — criteria is the % needed to pass that stage</div>
      <div className="stack" style={{ marginTop: 8 }}>
        {draft.stages.map((s, i) => (
          <div key={s.id} className="jr-stage-row">
            <span className="jr-stage-idx">{i + 1}</span>
            <input className="input" value={s.name} onChange={(e) => setStage(s.id, { name: e.target.value })} disabled={i === 0 || i === draft.stages.length - 1} />
            <div className="jr-crit">
              <input className="input" type="number" min={0} max={100} value={s.criteria} onChange={(e) => setStage(s.id, { criteria: Math.max(0, Math.min(100, Number(e.target.value))) })} />
              <span>% pass</span>
            </div>
            <button className="btn ghost sm" title="Move up" onClick={() => moveStage(i, -1)} disabled={i <= 1}>↑</button>
            <button className="btn ghost sm" title="Move down" onClick={() => moveStage(i, 1)} disabled={i >= draft.stages.length - 2}>↓</button>
            <button className="btn ghost sm" title="Add stage after" onClick={() => addStage(i)}>＋</button>
            <button className="btn ghost sm danger" title="Remove" onClick={() => removeStage(i)} disabled={i === 0 || i === draft.stages.length - 1}>🗑</button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Button variant="primary" onClick={save}>💾 Save job</Button>
        <Button onClick={() => set({ stages: defaultStages() })}>↺ Reset stage template</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}
