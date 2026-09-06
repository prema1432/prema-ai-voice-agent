import { useState } from "react";
import { Badge, Button, Card } from "../../components";
import {
  analyzeResume, Candidate, FALLOUT_ID, FALLOUT_NAME, HistoryEntry, JobReq, MODE_LABEL,
  demoCandidates, nid,
} from "./model";

type Form = { name: string; email: string; phone: string; resume: string };

/** Kanban pipeline for one job: stages with pass-criteria gates + fallout lane. */
export default function Board({ job, onChange }: { job: JobReq; onChange: (j: JobReq) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [openCand, setOpenCand] = useState<string | null>(null);
  const [scoring, setScoring] = useState<{ id: string; value: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Form>({ name: "", email: "", phone: "", resume: "" });

  const stageIdx = (id: string) => job.stages.findIndex((s) => s.id === id);
  const hist = (stage: string, result: HistoryEntry["result"], note: string): HistoryEntry => ({
    at: new Date().toISOString(), stage, result, note,
  });

  function applyToAll(fn: (c: Candidate) => Candidate, candId: string) {
    onChange({ ...job, candidates: job.candidates.map((c) => (c.id === candId ? fn(c) : c)) });
  }

  /** AI screen a candidate sitting in Applied: advance or fall out by criteria. */
  function analyze(candId: string) {
    const c = job.candidates.find((x) => x.id === candId);
    const applied = job.stages[0];
    const screening = job.stages[1];
    if (!c || !screening) return;
    const { score, matched, missing } = analyzeResume(job, c.resume);
    const note = `AI match ${score}% (skills: ${matched.join(", ") || "none"}${missing.length ? ` · missing: ${missing.join(", ")}` : ""})`;
    const pass = score >= screening.criteria;
    applyToAll(
      (x) => ({
        ...x,
        match: score,
        scores: { ...x.scores, [applied.id]: score },
        stageId: pass ? screening.id : FALLOUT_ID,
        history: [
          ...x.history,
          hist(applied.name, "note", note),
          hist(applied.name, pass ? "passed" : "fallout", pass ? `${score}% ≥ ${screening.criteria}% → ${screening.name}` : `${score}% < ${screening.criteria}% required`),
        ],
      }),
      candId,
    );
  }

  /** Record a score for the candidate's current stage → auto pass/fallout. */
  function submitScore(candId: string, raw: string) {
    const c = job.candidates.find((x) => x.id === candId);
    const idx = c ? stageIdx(c.stageId) : -1;
    const stage = idx >= 0 ? job.stages[idx] : undefined;
    const value = Number(raw);
    if (!c || !stage || Number.isNaN(value)) return;
    const next = job.stages[idx + 1];
    const pass = value >= stage.criteria;
    const isHire = pass && next && next.id === job.stages[job.stages.length - 1].id;
    applyToAll(
      (x) => ({
        ...x,
        scores: { ...x.scores, [stage.id]: value },
        stageId: pass ? next.id : FALLOUT_ID,
        history: [
          ...x.history,
          hist(stage.name, pass ? (isHire ? "hired" : "passed") : "fallout",
            pass ? `Scored ${value}% ≥ ${stage.criteria}% → ${isHire ? "HIRED 🎉" : next.name}` : `Scored ${value}% — needed ${stage.criteria}%`),
        ],
      }),
      candId,
    );
    setScoring(null);
  }

  /** Drag & drop: forward = gated by criteria; backward/fallout = HR override. */
  function drop(candId: string, toId: string) {
    const c = job.candidates.find((x) => x.id === candId);
    if (!c || c.stageId === toId) return;
    const fromIdx = stageIdx(c.stageId);
    const toIdx = stageIdx(toId);

    if (toId === FALLOUT_ID) {
      applyToAll((x) => ({ ...x, stageId: FALLOUT_ID, history: [...x.history, hist(job.stages[fromIdx]?.name ?? "", "fallout", "Marked not qualified by HR")] }), candId);
      return;
    }
    if (fromIdx === -1) {
      // Reinstating from the fallout lane — HR override.
      applyToAll((x) => ({ ...x, stageId: toId, history: [...x.history, hist(job.stages[toIdx]?.name ?? "", "reinstated", "Reinstated by HR override")] }), candId);
      return;
    }
    const fromStage = job.stages[fromIdx];
    if (toIdx < fromIdx) {
      applyToAll((x) => ({ ...x, stageId: toId, history: [...x.history, hist(fromStage.name, "reinstated", `Moved back to ${job.stages[toIdx].name} by HR`)] }), candId);
      return;
    }
    const score = c.scores[fromStage.id];
    if (score == null) return; // gate: score the stage first
    if (score < fromStage.criteria) {
      applyToAll((x) => ({ ...x, stageId: FALLOUT_ID, history: [...x.history, hist(fromStage.name, "fallout", `Scored ${score}% — needed ${fromStage.criteria}%`)] }), candId);
      return;
    }
    const next = job.stages[fromIdx + 1];
    const isHire = next.id === job.stages[job.stages.length - 1].id;
    applyToAll(
      (x) => ({
        ...x,
        stageId: toIdx > fromIdx + 1 ? next.id : toId, // can't skip stages forward
        history: [...x.history, hist(fromStage.name, isHire ? "hired" : "passed", `Scored ${score}% ≥ ${fromStage.criteria}% → ${next.name}${isHire ? " 🎉" : ""}`)],
      }),
      candId,
    );
  }

  function addCandidate() {
    if (!form.name.trim()) return;
    const applied = job.stages[0];
    const c: Candidate = {
      id: nid("cand"), name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
      resume: form.resume.trim(), appliedAt: new Date().toISOString(), stageId: applied.id,
      match: null, scores: {}, history: [hist(applied.name, "entered", "Applied for this position")],
    };
    onChange({ ...job, candidates: [c, ...job.candidates] });
    setForm({ name: "", email: "", phone: "", resume: "" });
    setAdding(false);
  }


  const hiredCount = job.stages.length
    ? job.candidates.filter((c) => c.stageId === job.stages[job.stages.length - 1].id).length
    : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🗂 {job.title || "Untitled job"} — pipeline</h2>
          <div className="sub">
            {MODE_LABEL[job.mode]} · ₹{job.ctcMin || "?"}–{job.ctcMax || "?"} LPA · {job.openings} opening(s) · hired {hiredCount}/{job.openings}
            {job.lastDate ? ` · apply by ${job.lastDate}` : ""}
          </div>
        </div>
        <div className="page-head-actions">
          <Button size="sm" onClick={() => onChange({ ...job, candidates: [...job.candidates, ...demoCandidates(job)] })}>
            ✨ Demo candidates
          </Button>
          <Button size="sm" variant="primary" onClick={() => setAdding((a) => !a)}>＋ Apply candidate</Button>
        </div>
      </div>

      {adding && (
        <Card style={{ marginBottom: 14 }}>
          <div className="card-head"><h3>🧑‍💻 New application</h3><Badge tone="blue">lands in Applied</Badge></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            <input className="input" placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <textarea className="input" rows={3} style={{ gridColumn: "1 / -1" }} placeholder="Paste resume text — the AI screener matches it against the job skills" value={form.resume} onChange={(e) => setForm({ ...form, resume: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Button variant="primary" onClick={addCandidate}>Submit application</Button>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="kanban">


        {job.stages.map((s) => {
          const inStage = job.candidates.filter((c) => c.stageId === s.id);
          const isLast = s.id === job.stages[job.stages.length - 1].id;
          return (
            <div
              key={s.id}
              className={`kanban-col${dragOver === s.id ? " over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(s.id); }}
              onDragLeave={() => setDragOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); setDragOver(null); if (dragId) drop(dragId, s.id); setDragId(null); }}
            >
              <div className="kanban-head" style={{ borderTopColor: isLast ? "var(--green)" : "var(--accent-1)" }}>
                <input className="stage-name" value={s.name} readOnly />
                <span className="count">{inStage.length}</span>
              </div>
              <div className="jr-crit-tag" title={`Pass criteria: ${s.criteria}%`}>gate ≥ {s.criteria}%</div>
              <div className="kanban-cards">
                {inStage.map((c) => (
                  <div
                    key={c.id}
                    className="kanban-card"
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    onClick={() => setOpenCand(openCand === c.id ? null : c.id)}
                  >
                    <b>{c.name}</b>
                    <em>{c.email || c.phone || "—"}</em>
                    {c.match != null && <div className="jr-match"><span style={{ width: `${c.match}%` }} /></div>}
                    <div className="jr-mini">{c.match != null ? `AI match ${c.match}%` : "not screened"}</div>
                    {openCand === c.id && (
                      <div className="jr-detail" onClick={(e) => e.stopPropagation()}>
                        <b>Round scores</b>
                        <div className="chips" style={{ margin: "6px 0" }}>
                          {job.stages.filter((st) => c.scores[st.id] != null).map((st) => (
                            <span key={st.id} className={`chip ${c.scores[st.id] >= st.criteria ? "on" : ""}`}>{st.name}: {c.scores[st.id]}%</span>
                          ))}
                          {Object.keys(c.scores).length === 0 && <span className="chip">no scores yet</span>}
                        </div>
                        <b>Resume</b>
                        <p className="jr-resume">{c.resume || "—"}</p>
                      </div>
                    )}
                    {openCand === c.id && !isLast && s.criteria > 0 && (
                      <div className="jr-actions" onClick={(e) => e.stopPropagation()}>
                        {s.id === job.stages[0].id && c.match == null && (
                          <button onClick={() => analyze(c.id)}>🤖 AI screen</button>
                        )}
                        {scoring?.id === c.id ? (
                          <>
                            <input
                              autoFocus
                              className="input"
                              type="number" min={0} max={100}
                              placeholder="score %"
                              value={scoring.value}
                              onChange={(e) => setScoring({ id: c.id, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") submitScore(c.id, scoring.value); }}
                            />
                            <button onClick={() => submitScore(c.id, scoring.value)}>✓</button>
                          </>
                        ) : (
                          <button onClick={() => setScoring({ id: c.id, value: "" })}>📝 Score {s.name}</button>
                        )}
                        <button className="danger" onClick={() => drop(c.id, FALLOUT_ID)}>✕ not qualified</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Fallout lane */}
        <div
          className={`kanban-col jr-fallout${dragOver === FALLOUT_ID ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(FALLOUT_ID); }}
          onDragLeave={() => setDragOver((o) => (o === FALLOUT_ID ? null : o))}
          onDrop={(e) => { e.preventDefault(); setDragOver(null); if (dragId) drop(dragId, FALLOUT_ID); setDragId(null); }}
        >
          <div className="kanban-head" style={{ borderTopColor: "var(--red)" }}>
            <input className="stage-name" value={FALLOUT_NAME} readOnly />
            <span className="count">{job.candidates.filter((c) => c.stageId === FALLOUT_ID).length}</span>
          </div>
          <div className="jr-crit-tag">fallout — where &amp; why</div>
          <div className="kanban-cards">
            {job.candidates.filter((c) => c.stageId === FALLOUT_ID).map((c) => {
              const f = [...c.history].reverse().find((h) => h.result === "fallout");
              return (
                <div key={c.id} className="kanban-card" draggable onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)}>
                  <b>{c.name}</b>
                  <em>fell at {f?.stage ?? "?"}</em>
                  <div className="jr-mini">{f?.note ?? ""}</div>
                  {openCand === c.id && (
                    <div className="jr-detail" onClick={(e) => e.stopPropagation()}>
                      <b>History</b>
                      {c.history.map((h, i) => (
                        <div key={i} className={`jr-hist ${h.result}`}>{h.stage} · {h.note}</div>
                      ))}
                    </div>
                  )}
                  <div className="jr-actions" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setOpenCand(openCand === c.id ? null : c.id)}>🕘 history</button>
                    <button
                      onClick={() => {
                        const applied = job.stages[0];
                        applyToAll((x) => ({ ...x, stageId: applied.id, history: [...x.history, hist(applied.name, "reinstated", "Re-opened by HR")] }), c.id);
                      }}
                    >
                      ↩ re-open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="kanban-col add" style={{ minWidth: 0 }}>
          <div className="sub" style={{ fontSize: 12 }}>
            💡 Drag cards forward only after scoring a round. Backward drags are HR overrides and are logged in candidate history.
          </div>
        </div>
      </div>
    </div>
  );
}

