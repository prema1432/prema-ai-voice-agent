/* ============================================================
   Automatic stage validation on application.
   A new applicant always lands in the first (Applied) stage;
   each consecutive pure-AI stage is then validated automatically
   — pass → next stage, fail → Not Qualified with a reason.
   Human / AI+Human stages pause there for a person to decide.
   ============================================================ */
import {
  aiEvaluate, Candidate, FALLOUT_ID, HistoryEntry, JobReq,
} from "./model";

/** Public summary of what an application led to (shown to the applicant). */
export interface ScreenOutcome {
  /** Stage the candidate ended in after auto-validation. */
  stageName: string;
  landed: boolean;
  /** True when the run stopped for a human / AI+Human decision. */
  awaitingHuman: boolean;
  failedAt?: string;
  reason?: string;
}

/** Where did the auto-validated run leave the candidate? */
export function outcomeFor(job: JobReq, c: Candidate): ScreenOutcome {
  const last = job.stages[job.stages.length - 1];
  if (c.stageId === FALLOUT_ID) {
    const f = [...c.history].reverse().find((h) => h.result === "fallout");
    return { stageName: "Not Qualified", landed: false, awaitingHuman: false, failedAt: f?.stage, reason: f?.note };
  }
  const idx = job.stages.findIndex((s) => s.id === c.stageId);
  const stage = idx >= 0 ? job.stages[idx] : undefined;
  const hired = last && c.stageId === last.id;
  return {
    stageName: hired ? "Hired 🎉" : stage?.name ?? "Applied",
    landed: true,
    awaitingHuman: !!stage && stage.evalType !== "ai" && !hired,
  };
}

/**
 * Auto-validate a candidate from their current stage forwards through every
 * consecutive pure-AI stage. Returns the updated job. Non-AI stages (human /
 * AI+Human) and the terminal Hired stage stop the cascade for human review.
 */
export function screenArrival(job: JobReq, candId: string): JobReq {
  const start = job.candidates.find((c) => c.id === candId);
  if (!start) return job;
  let idx = job.stages.findIndex((s) => s.id === start.stageId);
  if (idx < 0) return job;

  let cur: Candidate = start;
  let result = job;
  while (idx < job.stages.length) {
    const stage = job.stages[idx];
    const isLast = idx === job.stages.length - 1;
    // Only pure-AI stages validate themselves; humans/AI+Human wait for a decision.
    if (stage.evalType !== "ai" || isLast) break;

    const ev = aiEvaluate(job, stage, cur);
    const next = job.stages[idx + 1];
    const pass = ev.score >= stage.criteria;
    const isHire = pass && next !== undefined && idx + 1 === job.stages.length - 1;
    const failName = stage.failLabel ?? `${stage.name} Failed`;
    const h: HistoryEntry = {
      at: new Date().toISOString(),
      stage: stage.name,
      result: pass ? (isHire ? "hired" : "passed") : "fallout",
      note: pass
        ? `Auto-validated ${ev.score}% ≥ ${stage.criteria}% → ${isHire ? "HIRED 🎉" : next.name}`
        : `Auto-validation failed: ${ev.score}% < ${stage.criteria}% — ${failName}`,
    };
    cur = {
      ...cur,
      match: cur.match ?? (idx === 0 ? ev.score : cur.match),
      scores: { ...cur.scores, [stage.id]: ev.score },
      evals: { ...cur.evals, [stage.id]: ev },
      stageId: pass ? next.id : FALLOUT_ID,
      history: [...cur.history, h],
    };
    result = { ...result, candidates: result.candidates.map((c) => (c.id === candId ? cur : c)) };
    if (!pass) break;
    idx += 1;
  }
  return result;
}