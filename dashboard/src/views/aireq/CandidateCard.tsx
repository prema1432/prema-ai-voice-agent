/* ============================================================
   CandidateCard — one kanban card with the full story.
   Shows the candidate's scored journey, application answers, the
   stage evaluation in detail (per-dimension bars + per-question
   Q&A with points for MCQ / AI-interviewer stages) and TWO ways
   to validate a stage: the stage's automatic method (🤖 AI
   evaluate / 🤝 accept AI) plus a ✍️ manual second-opinion score.
   ============================================================ */
import { useState } from "react";
import { Candidate, JobReq, Stage, StageEval } from "./model";

const RESULT_META: Record<string, { label: string; cls: string }> = {
  correct: { label: "✓ Correct", cls: "ok" },
  partial: { label: "◐ Partial", cls: "part" },
  wrong: { label: "✕ Wrong", cls: "no" },
};

/** Latest evaluation for the candidate (pending AI rec, current stage, or last done). */
function latestEval(job: JobReq, c: Candidate): StageEval | undefined {
  return c.pendingAI ?? c.evals[c.stageId]
    ?? [...job.stages].reverse().map((st) => c.evals[st.id]).find(Boolean);
}

function EvalBlocks({ ev }: { ev: StageEval }) {
  return (
    <div className="jr-eval">
      <div className="chips" style={{ margin: "4px 0" }}>
        <span className="chip on">Overall {ev.score}%</span>
        {ev.skillsTotal > 0 && <span className="chip">Skills {ev.skillsMatched}/{ev.skillsTotal}</span>}
        {ev.experience > 0 && <span className="chip">Experience {ev.experience}%</span>}
        {ev.education > 0 && <span className="chip">Education {ev.education}%</span>}
        {ev.by === "human" && <span className="chip">🧑 human</span>}
        {ev.by === "ai_human" && <span className="chip">🤝 AI + Human</span>}
        {ev.qa && ev.qa.length > 0 && (
          <span className="chip">
            Questions {ev.qa.filter((x) => x.result !== "wrong").length}/{ev.qa.length} passed
          </span>
        )}
      </div>

      {/* Per-dimension breakdown (screen stages) */}
      {ev.detail && ev.detail.length > 0 && (
        <div className="jr-dim">
          <div className="jr-dim-title">Per-dimension scores</div>
          {ev.detail.map((d, i) => (
            <div key={i} className="jr-dim-row">
              <span>{d.label}</span>
              <div className="jr-dim-bar"><span style={{ width: `${(d.score / Math.max(1, d.max)) * 100}%` }} /></div>
              <b>{d.score}/{d.max}</b>
            </div>
          ))}
        </div>
      )}

      {/* Per-question Q&A (MCQ / AI interviewer) */}
      {ev.qa && ev.qa.length > 0 && (
        <div className="jr-qa">
          <div className="jr-dim-title">Question-by-question</div>
          {ev.qa.map((x, i) => {
            const m = RESULT_META[x.result];
            return (
              <div key={i} className={`jr-qa-row ${x.result}`}>
                <div className="jr-qa-q">
                  <b>Q{i + 1}</b> {x.kind === "mcq" ? "✅" : "🎙️"} {x.q}
                  <span className={`jr-qa-tag ${m?.cls ?? ""}`}>{m?.label}</span>
                </div>
                <div className="jr-qa-ans">
                  <em>Candidate:</em> {x.answer || "—"}
                  {x.comment && <span className="jr-qa-cmt"> · {x.comment}</span>}
                </div>
                <div className="jr-qa-pts">+{x.earned}/{x.points} pts</div>
              </div>
            );
          })}
        </div>
      )}

      {ev.missing.length > 0 && <div className="jr-mini">Missing: {ev.missing.join(", ")}</div>}
      {ev.strengths.map((s, i) => <div key={`s${i}`} className="jr-mini">✅ {s}</div>)}
      {ev.concerns.map((s, i) => <div key={`c${i}`} className="jr-mini">⚠️ {s}</div>)}
      <div className="jr-mini jr-reco">💡 {ev.recommendation}</div>
    </div>
  );
}

export default function CandidateCard({
  job, candidate: c, stage, isLast,
  onRunAI, onConfirm, onSubmitScore, onFallout,
  onDragStart, onDragEnd,
}: {
  job: JobReq;
  candidate: Candidate;
  stage: Stage;
  isLast: boolean;
  onRunAI: (candId: string) => void;
  onConfirm: (candId: string, accept: boolean) => void;
  onSubmitScore: (candId: string, value: string) => void;
  onFallout: (candId: string) => void;
  onDragStart: (candId: string) => void;
  onDragEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [score, setScore] = useState("");

  const ev = open ? latestEval(job, c) : undefined;
  const hasAnswers = job.applyFields.filter((f) => c.answers[f.id]).length > 0;

  return (
    <div
      className="kanban-card"
      draggable
      onDragStart={() => onDragStart(c.id)}
      onDragEnd={onDragEnd}
      onClick={() => setOpen((o) => !o)}
    >
      <b>{c.name}</b>
      <em>{c.email || c.phone || "—"}</em>
      {c.match != null && <div className="jr-match"><span style={{ width: `${c.match}%` }} /></div>}
      <div className="jr-mini">{c.match != null ? `AI match ${c.match}%` : "not screened"}</div>

      {open && (
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

          {hasAnswers && (
            <>
              <b>Application answers</b>
              {job.applyFields.filter((f) => c.answers[f.id]).map((f) => (
                <div key={f.id} className="jr-ans"><b>{f.label}:</b> {c.answers[f.id]}</div>
              ))}
            </>
          )}

          {ev ? <EvalBlocks ev={ev} /> : <p className="jr-resume">{c.resume || "—"}</p>}

          <b>Resume</b>
          <p className="jr-resume">{c.resume || "—"}</p>
        </div>
      )}

      {open && !isLast && stage.criteria > 0 && (
        <div className="jr-actions" onClick={(e) => e.stopPropagation()}>
          {/* Option 1 — the stage's automatic validation */}
          {stage.evalType !== "human" && !c.pendingAI && (
            <button onClick={() => onRunAI(c.id)}>
              {stage.evalType === "ai_human" ? "🤖 Get AI recommendation" : "🤖 AI evaluate"}
            </button>
          )}
          {stage.evalType === "ai_human" && c.pendingAI && (
            <>
              <button onClick={() => onConfirm(c.id, true)}>🤝 Accept AI ({c.pendingAI.score}%)</button>
              <button className="danger" onClick={() => onConfirm(c.id, false)}>✕ Override</button>
            </>
          )}

          {/* Option 2 — manual second opinion, available on every stage */}
          {scoreOpen ? (
            <>
              <input
                autoFocus
                className="input"
                type="number" min={0} max={100}
                placeholder="2nd-opinion score %"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { onSubmitScore(c.id, score); setScoreOpen(false); setScore(""); } }}
              />
              <button onClick={() => { onSubmitScore(c.id, score); setScoreOpen(false); setScore(""); }}>✓</button>
            </>
          ) : (
            <button className="op2" onClick={() => setScoreOpen(true)}>✍️ 2nd opinion (manual)</button>
          )}
          <button className="danger" onClick={() => onFallout(c.id)}>✕ not qualified</button>
        </div>
      )}
    </div>
  );
}
