import { useState } from "react";
import { Button, Card } from "../../components";
import { Candidate, JobReq, MODE_LABEL, loadJobs, nid, saveJobs } from "./model";

/** Candidate-facing job card: what an applicant sees before applying. */
export function JobPreviewCard({ job }: { job: JobReq }) {
  const closed = job.status !== "published";
  const expired = !!job.lastDate && new Date(job.lastDate) < new Date(new Date().toDateString());
  return (
    <Card>
      <div className="req-head">
        <span className="req-av">💼</span>
        <div>
          <b style={{ fontSize: 17 }}>{job.title || "Untitled job"}</b>
          <em>{MODE_LABEL[job.mode]} · ₹{job.ctcMin || "?"}–{job.ctcMax || "?"} LPA · {job.minExp || 0}+ yrs</em>
        </div>
        {closed ? <BadgeInner text="closed" /> : expired ? <BadgeInner text="expired" /> : <BadgeInner text="open" />}
      </div>
      <p className="req-summary" style={{ whiteSpace: "pre-wrap" }}>{job.description || "No description provided."}</p>
      <div className="chips req-chips">
        {job.skills.map((s) => <span key={s} className="chip on">{s}</span>)}
        {job.lastDate && <span className="chip">⏳ apply by {job.lastDate}</span>}
        <span className="chip">🧑‍💻 {job.openings} opening(s)</span>
      </div>
      <div className="lbl" style={{ marginTop: 14 }}>Hiring process</div>
      <div className="jr-journey" style={{ marginTop: 6 }}>
        {job.stages.map((s, i) => (
          <div key={s.id} className="jr-step">
            <span className="jr-step-ic">{i === job.stages.length - 1 ? "🎯" : `${i + 1}.`}</span>
            <span className="jr-step-lbl">{s.name}{s.criteria > 0 && s.criteria < 100 ? ` (pass ≥ ${s.criteria}%)` : ""}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BadgeInner({ text }: { text: string }) {
  return <span className={`jr-open-badge ${text}`}>{text}</span>;
}

/**
 * Public apply page at /jobs/:id — candidate view with the job preview and
 * the application form. Submissions land in the job's Applied stage.
 */
export default function PublicJob({ id }: { id: string }) {
  const [job, setJob] = useState<JobReq | null>(() => loadJobs().find((j) => j.id === id) ?? null);
  const [done, setDone] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", resume: "" });

  function apply() {
    if (!job || !form.name.trim()) return;
    const applied = job.stages[0];
    const cand: Candidate = {
      id: nid("cand"), name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
      resume: form.resume.trim(), appliedAt: new Date().toISOString(), stageId: applied.id,
      match: null, scores: {}, evals: {}, pendingAI: undefined,
      history: [{ at: new Date().toISOString(), stage: applied.name, result: "entered", note: "Applied via job link" }],
    };
    const updated = { ...job, candidates: [cand, ...job.candidates] };
    saveJobs(loadJobs().map((j) => (j.id === updated.id ? updated : j)));
    setJob(updated);
    setDone(form.name.trim());
  }

  if (!job) {
    return (
      <div className="jr-public">
        <Card><h2>🧠 Job not found</h2><p className="sub">This application link is invalid or the job was removed.</p></Card>
      </div>
    );
  }

  return (
    <div className="jr-public">
      <div className="jr-public-head">🧠 Prema AI · Careers</div>
      <JobPreviewCard job={job} />
      <Card style={{ marginTop: 14 }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "26px 10px" }}>
            <div style={{ fontSize: 34 }}>🎉</div>
            <h3>Application submitted, {done}!</h3>
            <p className="sub">You're in the pipeline at <b>{job.stages[0]?.name}</b>. Our team will review your profile and you may take AI-led assessments next.</p>
          </div>
        ) : (
          <>
            <div className="card-head"><h3>Apply for this position</h3><span className="chip">≈ 2 minutes</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <input className="input" placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <textarea className="input" rows={6} style={{ gridColumn: "1 / -1" }} placeholder="Paste your resume — skills are matched against this role by AI screening" value={form.resume} onChange={(e) => setForm({ ...form, resume: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button variant="primary" onClick={apply} disabled={job.status !== "published"}>🚀 Submit application</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}