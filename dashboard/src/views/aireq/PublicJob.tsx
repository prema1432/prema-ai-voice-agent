import { useState } from "react";
import { Button, Card } from "../../components";
import {
  ApplyField, Candidate, JobReq, MODE_LABEL, loadJobs, nid, normalizeJob, saveJobs,
} from "./model";
import { outcomeFor, ScreenOutcome, screenArrival } from "./screen";
import "./aireq.css";
import "./aireq-ui.css";

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
 * Public apply page at /jobs/:id — renders the job's configured application
 * fields (mandatory enforced), then auto-validates through the AI stages.
 */
export default function PublicJob({ id }: { id: string }) {
  const [job, setJob] = useState<JobReq | null>(() => {
    const found = loadJobs().find((j) => j.id === id);
    return found ? normalizeJob(found) : null;
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ name: string; outcome: ScreenOutcome } | null>(null);

  const valueOf = (f: ApplyField) => answers[f.id] ?? "";

  function setValue(f: ApplyField, v: string) {
    setAnswers((a) => ({ ...a, [f.id]: v }));
    if (errors[f.id]) setErrors((e) => ({ ...e, [f.id]: "" }));
  }

  function apply() {
    if (!job) return;
    const errs: Record<string, string> = {};
    for (const f of job.applyFields) {
      if (f.required && !valueOf(f).trim()) errs[f.id] = `${f.label} is required`;
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const bound = (key: "name" | "email" | "phone" | "resume") =>
      job.applyFields.find((f) => f.key === key);
    const ans = (f?: ApplyField) => (f ? valueOf(f).trim() : "");
    const answersAll = Object.fromEntries(
      job.applyFields.filter((f) => !f.key).map((f) => [f.id, valueOf(f).trim()]),
    );
    const applied = job.stages[0];
    const cand: Candidate = {
      id: nid("cand"),
      name: ans(bound("name")) || "Applicant",
      email: ans(bound("email")),
      phone: ans(bound("phone")),
      resume: ans(bound("resume")),
      answers: answersAll,
      appliedAt: new Date().toISOString(),
      stageId: applied.id,
      match: null,
      scores: {},
      evals: {},
      history: [{ at: new Date().toISOString(), stage: applied.name, result: "entered", note: "Applied via job link" }],
    };
    const updated = screenArrival({ ...job, candidates: [cand, ...job.candidates] }, cand.id);
    saveJobs(loadJobs().map((j) => (j.id === updated.id ? updated : j)));
    setJob(updated);
    const finalCand = updated.candidates.find((c) => c.id === cand.id) ?? cand;
    setDone({ name: cand.name, outcome: outcomeFor(updated, finalCand) });
  }

  if (!job) {
    return (
      <div className="jr-public">
        <Card><h2>🧠 Job not found</h2><p className="sub">This application link is invalid or the job was removed.</p></Card>
      </div>
    );
  }
  const closed = job.status !== "published";

  return (
    <div className="jr-public">
      <div className="jr-public-head">🧠 Prema AI · Careers</div>
      <JobPreviewCard job={job} />
      <Card style={{ marginTop: 14 }}>
        {done ? (
          <OutcomePanel name={done.name} outcome={done.outcome} />
        ) : (
          <>
            <div className="card-head">
              <h3>Apply for this position</h3>
              <span className="chip">
                {job.applyFields.filter((f) => f.required).length} required · ≈ {Math.max(2, job.applyFields.length)} min
              </span>
            </div>
            {closed && (
              <div className="jr-form-note warn">⛔ Applications are closed for this position.</div>
            )}
            <div className="jr-form-grid">
              {job.applyFields.map((f) => (
                <div key={f.id} className={`jr-field${f.type === "textarea" ? " full" : ""}${f.type === "date" ? " date" : ""}${f.type === "select" ? " full" : ""}`}>
                  <label className="lbl">
                    {f.label} {f.required && <span className="req-star" title="Mandatory">*</span>}
                    {!f.required && <em className="opt-tag">optional</em>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      className="input"
                      rows={5}
                      placeholder={f.placeholder}
                      value={valueOf(f)}
                      onChange={(e) => setValue(f, e.target.value)}
                    />
                  ) : f.type === "select" ? (
                    <select className="input" value={valueOf(f)} onChange={(e) => setValue(f, e.target.value)}>
                      <option value="">— select —</option>
                      {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={f.type === "email" ? "email" : f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      placeholder={f.placeholder}
                      value={valueOf(f)}
                      onChange={(e) => setValue(f, e.target.value)}
                    />
                  )}
                  {errors[f.id] && <div className="jr-form-err">⚠️ {errors[f.id]}</div>}
                  {!errors[f.id] && f.help && <div className="sub" style={{ fontSize: 11 }}>{f.help}</div>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" onClick={apply} disabled={closed}>🚀 Submit application</Button>
              <span className="sub">AI auto-validates your application against each stage as it arrives.</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/** Post-submit panel: where the application ended (or why it was not selected). */
function OutcomePanel({ name, outcome }: { name: string; outcome: ScreenOutcome }) {
  const failed = !outcome.landed;
  return (
    <div className={`jr-done${failed ? " failed" : ""}`}>
      <div className="jr-done-ic">{failed ? "😔" : outcome.stageName === "Hired 🎉" ? "🏆" : "🎉"}</div>
      <h3>
        {failed
          ? `Application not selected, ${name}`
          : outcome.stageName === "Hired 🎉"
            ? `Congratulations, ${name} — you're hired!`
            : `Application submitted, ${name}!`}
      </h3>
      {failed ? (
        <p className="sub">
          Your application was reviewed at <b>{outcome.failedAt ?? "the first stage"}</b> and didn't move forward.
          {outcome.reason ? (
            <span className="jr-done-reason">
              {outcome.reason.replace(/^Auto-validation failed:\s*/i, "").replace(/^.*?—\s*/, "")}
            </span>
          ) : ""}
        </p>
      ) : outcome.stageName === "Hired 🎉" ? (
        <p className="sub">Every stage auto-validated successfully — welcome aboard! Our team will reach out with next steps.</p>
      ) : (
        <p className="sub">
          You're now at the <b>{outcome.stageName}</b> stage
          {outcome.awaitingHuman ? " — our team will review your profile for the next round." : " — the next AI stage will keep validating automatically."}
        </p>
      )}
    </div>
  );
}