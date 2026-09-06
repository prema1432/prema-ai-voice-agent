import { useState } from "react";
import { Badge, Button, Card } from "../../components";
import {
  aiEvaluate, Candidate, EVAL_ICON, FALLOUT_ID, FALLOUT_NAME, HistoryEntry, JobReq, MODE_LABEL,
  StageEval, demoCandidates, nid,
} from "./model";
import { screenArrival } from "./screen";

/** Visual animated pipeline flow — dynamically renders all stages as connected nodes. */
function PipelineFlow({ job, onStageClick }: { job: JobReq; onStageClick?: (id: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const countAt = (id: string) => job.candidates.filter((c) => c.stageId === id).length;
  const last = job.stages[job.stages.length - 1];
  const hired = last ? countAt(last.id) : 0;
  const total = job.candidates.length;

  return (
    <div className="jr-flow">
      <div className="jr-flow-track">
        {job.stages.map((s, i) => {
          const count = countAt(s.id);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isHovered = hovered === s.id;
          const isLast = s.id === last?.id;
          return (
            <div key={s.id} className="jr-flow-node-wrap">
              <button
                className={`jr-flow-node${isHovered ? " hover" : ""}${isLast ? " hired" : ""}`}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onStageClick?.(s.id)}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="jr-flow-ic">{EVAL_ICON[s.evalType]}</span>
                <span className="jr-flow-name">{s.name}</span>
                <span className="jr-flow-count">{count}</span>
                {s.criteria > 0 && !isLast && (
                  <span className="jr-flow-gate">≥{s.criteria}%</span>
                )}
                <span className="jr-flow-bar"><span style={{ width: `${pct}%` }} /></span>
              </button>
              {i < job.stages.length - 1 && (
                <div className="jr-flow-arr">
                  <span className="jr-flow-arr-line" />
                  <span className="jr-flow-arr-head">▶</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="jr-flow-summary">
        <span>👥 {total} applicant{total !== 1 ? "s" : ""}</span>
        <span>🎯 {hired}/{job.openings} hired</span>
        <span>📊 {job.stages.length} stages</span>
      </div>
    </div>
  );
}

type Form = { name: string; email: string; phone: string; resume: string };

/** Kanban pipeline for one job: stages with pass-criteria gates + fallout lane. */
export default function Board({ job, onChange }: { job: JobReq; onChange: (j: JobReq) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [openCand, setOpenCand] = useState<string | null>(null);
  const [scoring, setScoring] = useState<{ id: string; value: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Form>({ name: "", email: "", phone: "", resume: "" });
  const [copiedLink, setCopiedLink] = useState(false);

  const shareUrl = `${location.origin}/jobs/${job.id}`;

  const stageIdx = (id: string) => job.stages.findIndex((s) => s.id === id);
  const hist = (stage: string, result: HistoryEntry["result"], note: string): HistoryEntry => ({
    at: new Date().toISOString(), stage, result, note,
  });

  function applyToAll(fn: (c: Candidate) => Candidate, candId: string) {
    onChange({ ...job, candidates: job.candidates.map((c) => (c.id === candId ? fn(c) : c)) });
  }

  /** AI evaluate the candidate at their current stage (AI / AI+Human stages). */
  function runAI(candId: string) {
    const c = job.candidates.find((x) => x.id === candId);
    const idx = c ? stageIdx(c.stageId) : -1;
    const stage = idx >= 0 ? job.stages[idx] : undefined;
    if (!c || !stage || stage.evalType === "human") return;
    const ev = aiEvaluate(job, stage, c);
    const failName = stage.failLabel ?? `${stage.name} Failed`;
    if (stage.evalType === "ai_human") {
      // AI recommends; a human confirms or overrides before any movement.
      applyToAll(
        (x) => ({
          ...x,
          pendingAI: ev,
          history: [...x.history, hist(stage.name, "note", `🤖 AI recommends ${ev.score}% — ${ev.recommendation}`)],
        }),
        candId,
      );
      return;
    }
    const next = job.stages[idx + 1];
    const pass = ev.score >= stage.criteria;
    const isHire = pass && next && next.id === job.stages[job.stages.length - 1].id;
    applyToAll(
      (x) => ({
        ...x,
        match: x.match ?? (idx === 0 ? ev.score : x.match),
        scores: { ...x.scores, [stage.id]: ev.score },
        evals: { ...x.evals, [stage.id]: ev },
        stageId: pass ? next.id : FALLOUT_ID,
        history: [
          ...x.history,
          hist(stage.name, pass ? (isHire ? "hired" : "passed") : "fallout",
            pass ? `AI ${ev.score}% ≥ ${stage.criteria}% → ${isHire ? "HIRED 🎉" : next.name}` : `AI ${ev.score}% < ${stage.criteria}% — ${failName}`),
        ],
      }),
      candId,
    );
  }

  /** Human decision on an AI+Human stage: accept the AI recommendation or override it. */
  function confirmAI(candId: string, accept: boolean) {
    const c = job.candidates.find((x) => x.id === candId);
    const idx = c ? stageIdx(c.stageId) : -1;
    const stage = idx >= 0 ? job.stages[idx] : undefined;
    if (!c || !stage || !c.pendingAI) return;
    const ev = c.pendingAI;
    const next = job.stages[idx + 1];
    const pass = accept && ev.score >= stage.criteria;
    const isHire = pass && next && next.id === job.stages[job.stages.length - 1].id;
    const failName = stage.failLabel ?? `${stage.name} Failed`;
    applyToAll(
      (x) => ({
        ...x,
        pendingAI: undefined,
        scores: { ...x.scores, [stage.id]: ev.score },
        evals: { ...x.evals, [stage.id]: { ...ev, by: "ai_human" } },
        stageId: pass ? next.id : FALLOUT_ID,
        history: [
          ...x.history,
          hist(stage.name, pass ? (isHire ? "hired" : "passed") : "fallout",
            pass
              ? `Human confirmed AI ${ev.score}% → ${isHire ? "HIRED 🎉" : next.name}`
              : accept ? `AI ${ev.score}% < ${stage.criteria}% — ${failName}` : `Human overrode AI recommendation — ${failName}`),
        ],
      }),
      candId,
    );
  }

  /** Record a human score for the candidate's current stage → auto pass/fallout. */
  function submitScore(candId: string, raw: string) {
    const c = job.candidates.find((x) => x.id === candId);
    const idx = c ? stageIdx(c.stageId) : -1;
    const stage = idx >= 0 ? job.stages[idx] : undefined;
    const value = Number(raw);
    if (!c || !stage || Number.isNaN(value)) return;
    const next = job.stages[idx + 1];
    const pass = value >= stage.criteria;
    const isHire = pass && next && next.id === job.stages[job.stages.length - 1].id;
    const failName = stage.failLabel ?? `${stage.name} Failed`;
    const ev: StageEval = {
      at: new Date().toISOString(), by: "human", score: value,
      skillsMatched: 0, skillsTotal: 0, experience: 0, education: 0,
      missing: [], strengths: [`Human interview score ${value}%`],
      concerns: pass ? [] : [`Below the ${stage.criteria}% gate`],
      recommendation: pass ? `Move to ${next?.name ?? "next stage"}` : `Do not advance — ${failName}`,
    };
    applyToAll(
      (x) => ({
        ...x,
        scores: { ...x.scores, [stage.id]: value },
        evals: { ...x.evals, [stage.id]: ev },
        pendingAI: undefined,
        stageId: pass ? next.id : FALLOUT_ID,
        history: [
          ...x.history,
          hist(stage.name, pass ? (isHire ? "hired" : "passed") : "fallout",
            pass ? `Human scored ${value}% ≥ ${stage.criteria}% → ${isHire ? "HIRED 🎉" : next.name}` : `Human scored ${value}% — ${failName}`),
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
      resume: form.resume.trim(), answers: {}, appliedAt: new Date().toISOString(), stageId: applied.id,
      match: null, scores: {}, evals: {}, history: [hist(applied.name, "entered", "Applied for this position")],
    };
    // New applications are auto-validated stage by stage (AI stages only).
    onChange(screenArrival({ ...job, candidates: [c, ...job.candidates] }, c.id));
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
          <Button
            size="sm"
            variant={job.status === "published" ? "primary" : "default"}
            title={job.status === "published" ? shareUrl : "Publish the job first to open applications"}
            onClick={() => {
              navigator.clipboard?.writeText(shareUrl).catch(() => {});
              setCopiedLink(true);
              window.setTimeout(() => setCopiedLink(false), 1600);
            }}
          >
            {copiedLink ? "✓ Link copied" : "🔗 Share link"}
          </Button>
          <Button size="sm" onClick={() => onChange({ ...job, candidates: [...job.candidates, ...demoCandidates(job)] })}>
            ✨ Demo candidates
          </Button>
          <Button size="sm" variant="primary" onClick={() => setAdding((a) => !a)}>＋ Apply candidate</Button>
        </div>
      </div>

      {job.status === "published" && (
        <div className="jr-share" style={{ marginBottom: 16 }}>
          <div className="jr-share-head">
            <b>🔗 Application link — share with candidates</b>
            <span className="chip">live</span>
          </div>
          <div className="jr-share-row">
            <code className="jr-link">{shareUrl}</code>
            <Button size="sm" variant="primary" onClick={() => { navigator.clipboard?.writeText(shareUrl).catch(() => {}); setCopiedLink(true); window.setTimeout(() => setCopiedLink(false), 1600); }}>
              {copiedLink ? "✓ Copied" : "📋 Copy"}
            </Button>
            <a className="jr-share-btn" href={shareUrl} target="_blank" rel="noreferrer">↗ Open</a>
            <a className="jr-share-btn" href={`https://wa.me/?text=${encodeURIComponent(`Apply for ${job.title || "this opening"} — ${shareUrl}`)}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
          </div>
        </div>
      )}

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

      <PipelineFlow job={job} />

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
              <div className="jr-crit-tag" title={`Pass criteria: ${s.criteria}%`}>{EVAL_ICON[s.evalType]} · gate ≥ {s.criteria}%</div>
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
                        <b>Journey</b>
                        <div className="jr-journey">
                          {job.stages.map((st) => {
                            const done = c.scores[st.id] != null;
                            const cur = st.id === c.stageId;
                            return (
                              <div key={st.id} className={`jr-step ${done ? "done" : cur ? "cur" : ""}`}>
                                <span className="jr-step-ic">{done ? "✅" : cur ? "🔵" : "⚪"}</span>
                                <span className="jr-step-lbl">{st.name}{done ? ` — ${c.scores[st.id]}%` : ""}</span>
                              </div>
                            );
                          })}
                        </div>
                        {job.applyFields.filter((f) => c.answers[f.id]).length > 0 && (
                          <>
                            <b>Application answers</b>
                            {job.applyFields.filter((f) => c.answers[f.id]).map((f) => (
                              <div key={f.id} className="jr-ans"><b>{f.label}:</b> {c.answers[f.id]}</div>
                            ))}
                          </>
                        )}
                        {(() => {
                          const ev = c.pendingAI ?? c.evals[c.stageId]
                            ?? [...job.stages].reverse().map((st) => c.evals[st.id]).find(Boolean);
                          if (!ev) return <p className="jr-resume">{c.resume || "—"}</p>;
                          return (
                            <div className="jr-eval">
                              <div className="chips" style={{ margin: "4px 0" }}>
                                <span className="chip on">Overall {ev.score}%</span>
                                {ev.skillsTotal > 0 && <span className="chip">Skills {ev.skillsMatched}/{ev.skillsTotal}</span>}
                                {ev.experience > 0 && <span className="chip">Experience {ev.experience}%</span>}
                                {ev.education > 0 && <span className="chip">Education {ev.education}%</span>}
                                {ev.by === "human" && <span className="chip">🧑 human</span>}
                                {ev.by === "ai_human" && <span className="chip">🤝 AI + Human</span>}
                              </div>
                              {ev.missing.length > 0 && <div className="jr-mini">Missing: {ev.missing.join(", ")}</div>}
                              {ev.strengths.map((s, i) => <div key={`s${i}`} className="jr-mini">✅ {s}</div>)}
                              {ev.concerns.map((s, i) => <div key={`c${i}`} className="jr-mini">⚠️ {s}</div>)}
                              <div className="jr-mini jr-reco">💡 {ev.recommendation}</div>
                            </div>
                          );
                        })()}
                        <b>Resume</b>
                        <p className="jr-resume">{c.resume || "—"}</p>
                      </div>
                    )}
                    {openCand === c.id && !isLast && s.criteria > 0 && (
                      <div className="jr-actions" onClick={(e) => e.stopPropagation()}>
                        {s.evalType !== "human" && !c.pendingAI && (
                          <button onClick={() => runAI(c.id)}>🤖 AI evaluate</button>
                        )}
                        {s.evalType === "ai_human" && c.pendingAI && (
                          <>
                            <button onClick={() => confirmAI(c.id, true)}>🤝 Accept AI ({c.pendingAI.score}%)</button>
                            <button className="danger" onClick={() => confirmAI(c.id, false)}>✕ Override</button>
                          </>
                        )}
                        {s.evalType === "human" && (scoring?.id === c.id ? (
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
                        ))}
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

