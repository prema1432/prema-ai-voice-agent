import { useState } from "react";
import { Badge, Button } from "../../components";
import { EMPLOYMENT_LABEL, JobReq, MODE_LABEL, WorkMode } from "./model";
import ApplyFieldsEditor from "./ApplyFieldsEditor";
import StageBuilder from "./StageBuilder";
import FlowPlayground from "./FlowPlayground";

const STEPS = [
  { icon: "📋", title: "Role details", sub: "Title, pay, experience & JD" },
  { icon: "📝", title: "Application form", sub: "Fields candidates fill on apply" },
  { icon: "🪜", title: "Pipeline stages", sub: "Rounds, pass gates & eval type" },
] as const;

/** Tip shown in the summary rail for the active step. */
const TIPS = [
  "A clear title + required skills power the AI resume screening. Add a description candidates will read.",
  "Mandatory fields block incomplete applications. Anything optional is still stored on the candidate card.",
  "🤖 AI stages auto-validate on arrival — pass goes to the next stage, fail drops to Not Qualified with a reason. 🧑 Human / 🤝 AI+Human stages pause for your team.",
];

/** Guided 3-step setup for creating / editing a job requirement. */
export default function JobEditor({
  job,
  onSave,
  onCancel,
}: {
  job: JobReq;
  onSave: (j: JobReq) => void;
  onCancel: () => void;
}) {
  const isNew = !job.title;
  const [draft, setDraft] = useState<JobReq>(isNew ? { ...job, status: "draft" } : job);
  const [skillsText, setSkillsText] = useState(job.skills.join(", "));
  const [step, setStep] = useState(0);
  const [flowView, setFlowView] = useState<"list" | "flow">("list");
  const [publishNow, setPublishNow] = useState(false);
  const [triedSave, setTriedSave] = useState(false);
  const set = (patch: Partial<JobReq>) => setDraft({ ...draft, ...patch });

  const titleOk = draft.title.trim().length > 0;
  const skillCount = skillsText.split(",").map((s) => s.trim()).filter(Boolean).length;
  const mandatory = draft.applyFields.filter((f) => f.required).length;

  function save() {
    setTriedSave(true);
    if (!titleOk) {
      setStep(0);
      return;
    }
    const skills = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
    onSave({
      ...draft,
      skills,
      status: publishNow ? "published" : draft.status,
      ctcMin: Number(draft.ctcMin) || 0,
      ctcMax: Number(draft.ctcMax) || 0,
      openings: Math.max(1, Number(draft.openings) || 1),
      minExp: Math.max(0, Number(draft.minExp) || 0),
    });
  }

  return (
    <div className="jr-setup">
      {/* Step indicator */}
      <div className="jr-stepper" role="tablist" aria-label="Job setup steps">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={step === i}
            className={`jr-step${step === i ? " active" : ""}${i < step ? " done" : ""}`}
            onClick={() => setStep(i)}
          >
            <span className="jr-step-ic">{i < step ? "✓" : s.icon}</span>
            <span className="jr-step-tx">
              <b>{s.title}</b>
              <em>{s.sub}</em>
            </span>
          </button>
        ))}
      </div>

      <div className="jr-stepper-note">
        {isNew ? (
          <>Step {step + 1} of {STEPS.length} — set up your job, then publish it and share the link.</>
        ) : (
          <>Editing <b>{draft.title || "this job"}</b> — changes apply when you save.</>
        )}
      </div>

      <div className={`jr-setup-body${step === 2 && flowView === "flow" ? " wide" : ""}`}>
        <div className="jr-setup-main">
          {step === 0 && (
            <section className="jr-panel">
              <div className="jr-panel-head">
                <span className="jr-panel-ic">💼</span>
                <div>
                  <h3>Position</h3>
                  <p>What the role is and where it sits</p>
                </div>
              </div>
              <div className="jr-fields">
                <div className="full">
                  <label className="lbl">Job title *</label>
                  <input
                    className={`input${triedSave && !titleOk ? " err" : ""}`}
                    value={draft.title}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="e.g. Senior Frontend Engineer"
                    autoFocus
                  />
                  {triedSave && !titleOk && <div className="jr-form-err">⚠️ Job title is required — give the role a name to save it.</div>}
                </div>
                <div>
                  <label className="lbl">Work mode</label>
                  <select className="input" value={draft.mode} onChange={(e) => set({ mode: e.target.value as WorkMode })}>
                    {(Object.keys(MODE_LABEL) as WorkMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Employment type</label>
                  <select className="input" value={draft.employmentType} onChange={(e) => set({ employmentType: e.target.value as JobReq["employmentType"] })}>
                    {Object.entries(EMPLOYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Location</label>
                  <input className="input" value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="Hyderabad / Remote" />
                </div>
                <div>
                  <label className="lbl">Open positions</label>
                  <input className="input" type="number" min={1} value={draft.openings} onChange={(e) => set({ openings: Number(e.target.value) })} />
                </div>

                <div className="jr-sec full">💰 Compensation &amp; eligibility</div>
                <div>
                  <label className="lbl">Package range (₹ LPA)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" type="number" min={0} value={draft.ctcMin || ""} onChange={(e) => set({ ctcMin: Number(e.target.value) })} placeholder="Min" />
                    <input className="input" type="number" min={0} value={draft.ctcMax || ""} onChange={(e) => set({ ctcMax: Number(e.target.value) })} placeholder="Max" />
                  </div>
                </div>
                <div>
                  <label className="lbl">Min experience (years)</label>
                  <input className="input" type="number" min={0} value={draft.minExp} onChange={(e) => set({ minExp: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="lbl">Last date to apply</label>
                  <input className="input" type="date" value={draft.lastDate} onChange={(e) => set({ lastDate: e.target.value })} />
                </div>
                <div>
                  <label className="lbl">Education (nice to have)</label>
                  <input className="input" value={draft.education} onChange={(e) => set({ education: e.target.value })} placeholder="B.Tech / B.E. / MCA" />
                </div>

                <div className="jr-sec full">🎯 Who you're looking for</div>
                <div className="full">
                  <label className="lbl">Description</label>
                  <textarea className="input" rows={3} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="What the role is about, responsibilities, team…" />
                </div>
                <div className="full">
                  <label className="lbl">Required skills — comma separated (drives AI resume screening)</label>
                  <input className="input" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="React, TypeScript, Node.js, REST APIs" />
                  {skillCount > 0 && <div className="jr-hint">✓ {skillCount} skill{skillCount === 1 ? "" : "s"} will be matched against resumes.</div>}
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <ApplyFieldsEditor job={draft} onChange={(applyFields) => set({ applyFields })} defaultOpen />
          )}

          {step === 2 && (
            <section className="jr-panel">
              <div className="jr-panel-head">
                <span className="jr-panel-ic">🪜</span>
                <div>
                  <h3>Hiring pipeline</h3>
                  <p>Candidates start at the first stage and flow through each gate</p>
                </div>
                <Badge tone="blue">{draft.stages.length} stages</Badge>
              </div>
              <div className="view-toggle" style={{ marginBottom: 14 }}>
                <button className={`view-tgl-btn${flowView === "list" ? " on" : ""}`} onClick={() => setFlowView("list")}>📋 Stage list</button>
                <button className={`view-tgl-btn${flowView === "flow" ? " on" : ""}`} onClick={() => setFlowView("flow")}>🎨 Flow builder</button>
              </div>
              {flowView === "list" ? (
                <StageBuilder stages={draft.stages} onChange={(stages) => set({ stages })} />
              ) : (
                <FlowPlayground job={draft} onChange={setDraft} />
              )}
            </section>
          )}
        </div>

        {/* Live summary rail */}
        <aside className="jr-summary">
          <div className="jr-summary-head">🧭 Setup summary</div>
          <div className="jr-summary-role">
            <span className="jr-summary-av">{draft.title ? "💼" : "🕳️"}</span>
            <div>
              <b>{draft.title.trim() || "Untitled role"}</b>
              <em>{MODE_LABEL[draft.mode]} · {EMPLOYMENT_LABEL[draft.employmentType]}{draft.location ? ` · ${draft.location}` : ""}</em>
            </div>
          </div>
          <div className="jr-summary-grid">
            <div><b>{draft.stages.length}</b><span>stages</span></div>
            <div><b>{draft.applyFields.length}</b><span>form fields</span></div>
            <div><b>{mandatory}</b><span>mandatory</span></div>
            <div><b>{skillCount}</b><span>skills</span></div>
          </div>
          <div className="jr-summary-path">
            <span className="jr-summary-pathlbl">Candidate journey</span>
            <div className="jr-journey jr-summary-jr">
              {(draft.stages.length <= 4 ? draft.stages : [...draft.stages.slice(0, 2), ...draft.stages.slice(-1)]).map((s) => (
                <div key={s.id} className="jr-step">
                  <span className="jr-step-ic">{s.icon}</span>
                  <span className="jr-step-lbl">{s.name}</span>
                </div>
              ))}
              {draft.stages.length > 4 && (
                <div className="jr-step">
                  <span className="jr-step-ic">⋯</span>
                  <span className="jr-step-lbl">+{draft.stages.length - 3} more</span>
                </div>
              )}
            </div>
          </div>
          <div className="jr-summary-tip">💡 {TIPS[step]}</div>
          {isNew && (
            <label className="jr-summary-publish">
              <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
              <span>
                <b>🚀 Publish right away</b>
                <em>Goes live & shows the share link on save</em>
              </span>
            </label>
          )}
        </aside>
      </div>

      {/* Footer */}
      <div className="jr-setup-foot">
        <div className="jr-setup-nav">
          <Button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Back</Button>
          {step < STEPS.length - 1 && (
            <Button variant="primary" onClick={() => setStep(step + 1)}>Next — {STEPS[step + 1].title} →</Button>
          )}
        </div>
        <div className="jr-setup-save">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={save}>💾 {isNew ? "Save job" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}