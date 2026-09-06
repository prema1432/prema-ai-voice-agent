/* ============================================================
   Stage validation process — what a stage actually evaluates.
   Every stage carries a dynamic process config:
     screen    → AI scores dimensions of the application/resume
     mcq       → a question bank with options; candidate answers are
                 checked and each question is scored
     interview → open questions an AI interviewer asks; answers are
                 checked against the model answer and scored
   enrichWithProcess() turns a base resume score into a process-aware
   evaluation with a per-dimension breakdown and per-question Q&A.
   Deterministic (hash-based) so re-evaluating never flickers.
   ============================================================ */

export type ProcessKind = "screen" | "mcq" | "interview";

export interface StageQuestion {
  id: string;
  q: string;
  type: "mcq" | "open";
  /** Choices for mcq questions. */
  options?: string[];
  /** Index of the correct mcq option. */
  answerIndex?: number;
  /** Keywords the AI interviewer looks for in open answers. */
  modelAnswer?: string;
  points: number;
}

export interface StageProcess {
  kind: ProcessKind;
  /** Dimensions evaluated for screen stages (free labels). */
  fields: string[];
  questions: StageQuestion[];
}

export interface EvalDetail {
  label: string;
  score: number;
  max: number;
}

export interface EvalQA {
  q: string;
  kind: "mcq" | "open";
  answer: string;
  result: "correct" | "partial" | "wrong";
  points: number;
  earned: number;
  comment: string;
}

const nid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

const mcq = (q: string, options: string[], answerIndex: number, points = 10): StageQuestion =>
  ({ id: nid("q"), q, type: "mcq", options, answerIndex, points });

const open = (q: string, modelAnswer: string, points = 10): StageQuestion =>
  ({ id: nid("q"), q, type: "open", modelAnswer, points });

/** Sample starters per known default stage — recruiters edit them per job. */
function samplesFor(name: string): StageQuestion[] {
  if (name === "Aptitude Round") {
    return [
      mcq("A train 220 m long passes a pole in 11 s. Speed (km/h)?", ["52", "72", "88", "64"], 1),
      mcq("If x/3 = y/4 then x : y = ?", ["3 : 4", "4 : 3", "9 : 16", "16 : 9"], 0),
      mcq("Bought at ₹90, sold at ₹108. Profit %?", ["18%", "20%", "15%", "25%"], 1),
    ];
  }
  if (name === "Coding MCQ" || name === "Coding Round") {
    return [
      mcq("Which array method builds a new array by applying a function to each element?", ["map", "forEach", "reduce", "filter"], 0),
      mcq("Which HTTP status means the resource was created?", ["200", "201", "204", "301"], 1),
      mcq("What does O(n log n) typically describe for a good sort?", ["Best case", "Average case", "Worst case", "Memory"], 2),
    ];
  }
  if (name === "Technical Interview" || name === "Live Q&A" || name === "Live Coding / QA") {
    return [open("Walk me through how you'd design a scalable API for this role.", "cache, load balance, database, authentication, rate limit")];
  }
  if (name === "HR Interview") {
    return [open("Tell us about a time you handled a conflict at work.", "communication, listened, resolved, team")];
  }
  if (name === "Final Interview" || name === "Leadership Round" || name === "Product Sense") {
    return [open("Why should we hire you, and where do you see yourself in 3 years?", "growth, product, impact, team")];
  }
  return [];
}

const screenFields: Record<string, string[]> = {
  "Resume Screening": ["Skills match", "Experience", "Education", "Resume depth"],
  "Coding Assignment": ["Architecture", "Code quality", "Testing"],
};

/** Default dynamic process for a stage name — shown until the recruiter tunes it. */
export function defaultProcessFor(name: string): StageProcess {
  const n = name.replace(/^AI\s*/i, "").trim();
  if (n === "Applied" || n === "Hired") return { kind: "screen", fields: [], questions: [] };
  const samples = samplesFor(n);
  if (samples.length && samples.every((s) => s.type === "mcq")) {
    return { kind: "mcq", fields: screenFields[n] ?? [], questions: samples };
  }
  if (samples.length) {
    return { kind: "interview", fields: screenFields[n] ?? [], questions: samples };
  }
  return { kind: "screen", fields: screenFields[n] ?? [], questions: [] };
}

export const PROCESS_KIND_META: Record<ProcessKind, { label: string; icon: string; desc: string }> = {
  screen: { label: "Screen", icon: "🔍", desc: "AI scores application dimensions against the role" },
  mcq: { label: "MCQ test", icon: "✅", desc: "Candidate answers scored questions, AI checks them" },
  interview: { label: "AI interviewer", icon: "🎙️", desc: "Open questions; AI reviews the answer vs a model answer" },
};

/** Stable 0–100 hash so simulated answers never flicker between renders. */
function hashPct(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100;
}

interface BaseFacts {
  resume: string;
  skillsMatched: number;
  skillsTotal: number;
  experiencePct: number;
  educationPct: number;
  depthPct: number;
}

/** Deterministic answer + score for one question of a candidate. */
function answerQuestion(q: StageQuestion, candKey: string, facts: BaseFacts): EvalQA {
  const seed = hashPct(candKey + q.id);
  if (q.type === "open") {
    const keys = (q.modelAnswer ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    const hit = keys.filter((k) => facts.resume.toLowerCase().includes(k)).length;
    const cov = keys.length ? hit / keys.length : 0.5;
    // AI interviewer gives a human-ish partial for genuinely short replies.
    const score = keys.length ? Math.max(20, Math.min(100, Math.round(cov * 100 + 5))) : seed;
    return {
      q: q.q, kind: "open",
      answer: facts.resume.trim() ? `${facts.resume.trim().slice(0, 110)}${facts.resume.length > 110 ? "…" : ""}` : "(no answer given)",
      result: score >= 80 ? "correct" : score >= 40 ? "partial" : "wrong",
      points: q.points, earned: Math.round((q.points * score) / 100),
      comment: keys.length ? `AI interviewer: ${hit}/${keys.length} key points covered` : "AI interviewer: reviewed response",
    };
  }
  const opts = q.options ?? [];
  const answerIndex = Math.min(q.answerIndex ?? 0, Math.max(0, opts.length - 1));
  const correct = (seed % 5) < 3; // deterministic ~60% hit rate
  // Pick the option the candidate chose: the right one, or a wrong neighbour.
  const chosen = correct ? answerIndex : opts.length > 1 ? (answerIndex + 1 + (seed % (opts.length - 1))) % opts.length : answerIndex;
  return {
    q: q.q, kind: "mcq",
    answer: opts[Math.min(chosen, opts.length - 1)] ?? "—",
    result: correct ? "correct" : "wrong",
    points: q.points, earned: correct ? q.points : 0,
    comment: correct ? "Correct answer" : `Expected: ${opts[answerIndex] ?? "—"}`,
  };
}

/**
 * Enrich the base (resume) score with the stage's process: per-dimension
 * breakdown + per-question Q&A, and a blended overall score when the stage
 * runs a question bank. `screen` stages keep the resume-based score.
 */
export function enrichWithProcess(
  stage: StageProcess,
  candKey: string,
  base: number,
  facts: BaseFacts,
): { score: number; detail: EvalDetail[]; qa: EvalQA[] } {
  const detail: EvalDetail[] = [];
  if (stage.fields.length === 0 && stage.kind === "screen") {
    detail.push({ label: "Application", score: base, max: 100 });
  }
  if (stage.fields.length) {
    if (stage.fields.includes("Skills match") || stage.fields.length === 0) {
      detail.push({ label: "Skills", score: facts.skillsTotal ? Math.round((facts.skillsMatched / facts.skillsTotal) * 100) : 60, max: 100 });
    }
    stage.fields.forEach((f) => {
      if (f === "Skills match" || f === "Skills") return;
      if (f === "Experience") detail.push({ label: "Experience", score: facts.experiencePct, max: 100 });
      else if (f === "Education") detail.push({ label: "Education", score: facts.educationPct, max: 100 });
      else if (/depth/i.test(f)) detail.push({ label: f, score: facts.depthPct, max: 100 });
      else detail.push({ label: f, score: Math.round(base * 0.9), max: 100 });
    });
  }

  if (stage.kind === "screen" || stage.questions.length === 0) {
    return { score: base, detail, qa: [] };
  }

  const qa = stage.questions.map((q) => answerQuestion(q, candKey, facts));
  const totalPts = qa.reduce((s, x) => s + x.points, 0);
  const earnedPts = qa.reduce((s, x) => s + x.earned, 0);
  const stageScore = totalPts ? Math.round((earnedPts / totalPts) * 100) : 50;
  const weight = stage.kind === "interview" ? 0.5 : 0.6; // interviews lean on the resume too
  detail.push({
    label: stage.kind === "interview" ? "Interview answers" : "Question score",
    score: stageScore,
    max: 100,
  });
  const score = Math.max(5, Math.min(98, Math.round(base * (1 - weight) + stageScore * weight)));
  return { score, detail, qa };
}