/* ============================================================
   AI Requirement — hiring pipeline data model.
   Job requisition → stage machine (criteria gates) → candidates
   flow through with scored passes / tagged fallout. Client-side
   store, consistent with the other local-first modules.
   ============================================================ */

export type WorkMode = "remote" | "hybrid" | "onsite";
/** Who evaluates this stage: AI, a human interviewer, or AI recommending + human deciding. */
export type EvalType = "ai" | "human" | "ai_human";

export const EVAL_LABEL: Record<EvalType, string> = {
  ai: "🤖 AI",
  human: "🧑 Human",
  ai_human: "🤝 AI + Human",
};

export const EVAL_COLOR: Record<EvalType, string> = {
  ai: "var(--accent-1, #6366f1)",
  human: "var(--green, #10b981)",
  ai_human: "var(--amber, #f59e0b)",
};

export const EVAL_DESC: Record<EvalType, string> = {
  ai: "AI evaluates automatically",
  human: "Human interviewer decides",
  ai_human: "AI recommends, human decides",
};

export const EVAL_ICON: Record<EvalType, string> = {
  ai: "🤖",
  human: "🧑",
  ai_human: "🤝",
};

export interface StagePreset {
  name: string;
  icon: string;
  evalType: EvalType;
  criteria: number;
  difficulty: Difficulty;
}

/** Preset stage suggestions shown in the dropdown. Users can still type a custom name. */
export const STAGE_PRESETS: StagePreset[] = [
  { name: "Applied", icon: "📝", evalType: "ai", criteria: 0, difficulty: "easy" },
  { name: "Resume Screening", icon: "📄", evalType: "ai", criteria: 70, difficulty: "medium" },
  { name: "Aptitude Round", icon: "🧠", evalType: "ai", criteria: 60, difficulty: "medium" },
  { name: "Coding MCQ", icon: "💻", evalType: "ai", criteria: 65, difficulty: "hard" },
  { name: "Coding Answer", icon: "⌨️", evalType: "ai", criteria: 70, difficulty: "hard" },
  { name: "Live Coding / QA", icon: "🎤", evalType: "ai_human", criteria: 75, difficulty: "hard" },
  { name: "Technical Interview", icon: "🛠", evalType: "human", criteria: 75, difficulty: "hard" },
  { name: "System Design", icon: "🏗", evalType: "human", criteria: 70, difficulty: "extreme" },
  { name: "Case Study", icon: "📊", evalType: "ai_human", criteria: 65, difficulty: "medium" },
  { name: "Product Sense", icon: "💡", evalType: "human", criteria: 70, difficulty: "medium" },
  { name: "Role Play", icon: "🎭", evalType: "ai_human", criteria: 70, difficulty: "medium" },
  { name: "HR Interview", icon: "🤝", evalType: "human", criteria: 70, difficulty: "easy" },
  { name: "Leadership Round", icon: "🌟", evalType: "human", criteria: 70, difficulty: "hard" },
  { name: "Final Interview", icon: "🏆", evalType: "human", criteria: 75, difficulty: "extreme" },
  { name: "Hired", icon: "🎉", evalType: "human", criteria: 100, difficulty: "easy" },
];

export type Difficulty = "easy" | "medium" | "hard" | "extreme";

export const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; icon: string; color: string; weight: number }> = {
  easy: { label: "Easy", icon: "🟢", color: "#10b981", weight: 1 },
  medium: { label: "Medium", icon: "🟡", color: "#f59e0b", weight: 1.2 },
  hard: { label: "Hard", icon: "🟠", color: "#f97316", weight: 1.5 },
  extreme: { label: "Extreme Hard", icon: "🔴", color: "#ef4444", weight: 2 },
};

export interface MailConfig {
  currentStage: { subject: string; body: string };
  nextStage: { subject: string; body: string };
}

export const DEFAULT_MAIL: MailConfig = {
  currentStage: { subject: "Update on your application: {{stage}}", body: "Hi {{name}},\n\nYou are now at the {{stage}} stage for {{job}}.\n\nNext: {{nextStage}}\n\n— Prema AI" },
  nextStage: { subject: "Congratulations! Moving to {{nextStage}}", body: "Hi {{name}},\n\nYou passed {{stage}} ({{score}}%). Moving to {{nextStage}}.\n\n— Prema AI" },
};

export interface Stage {
  id: string;
  name: string;
  icon: string;
  criteria: number;
  evalType: EvalType;
  failLabel?: string;
  difficulty: Difficulty;
  mail: MailConfig;
}

/** Rich AI/human evaluation attached to a candidate per stage. */
export interface StageEval {
  at: string;
  by: EvalType;
  score: number;
  skillsMatched: number;
  skillsTotal: number;
  /** Experience vs requirement, %. */
  experience: number;
  /** Education vs requirement, %. */
  education: number;
  missing: string[];
  strengths: string[];
  concerns: string[];
  recommendation: string;
}

export interface HistoryEntry {
  at: string;
  stage: string;
  result: "entered" | "passed" | "fallout" | "reinstated" | "hired" | "note";
  note: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  resume: string;
  appliedAt: string;
  stageId: string;
  /** AI resume-vs-JD match % (set when analyzed). */
  match: number | null;
  /** stageId → score achieved in that stage (mirror of evals, for quick gating). */
  scores: Record<string, number>;
  /** stageId → full evaluation (AI or human) produced at that stage. */
  evals: Record<string, StageEval>;
  /** For ai_human stages: AI evaluation waiting for human confirmation. */
  pendingAI?: StageEval;
  history: HistoryEntry[];
}

export interface JobReq {
  id: string;
  title: string;
  description: string;
  mode: WorkMode;
  ctcMin: number;
  ctcMax: number;
  openings: number;
  /** ISO date — last date to apply. */
  lastDate: string;
  /** Application opening date. */
  startDate: string;
  location: string;
  education: string;
  employmentType: "full_time" | "part_time" | "contract" | "internship";
  additionalReq: string;
  skills: string[];
  minExp: number;
  status: "draft" | "published" | "closed";
  createdAt: string;
  stages: Stage[];
  candidates: Candidate[];
}

/** A reusable stage pipeline template — create once, apply to any job. */
export interface StageTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  stages: Stage[];
  createdAt: string;
}

const TEMPLATE_KEY = "prema.hiring.stageTemplates";

export function loadTemplates(): StageTemplate[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TEMPLATE_KEY) ?? "[]") as StageTemplate[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveTemplates(templates: StageTemplate[]) {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
  } catch {
    /* ignore */
  }
}

export function newTemplate(): StageTemplate {
  return {
    id: nid("tmpl"),
    name: "",
    icon: "📋",
    description: "",
    stages: defaultStages(),
    createdAt: new Date().toISOString(),
  };
}

/** Shared id for the "Not Qualified" fallout lane. */
export const FALLOUT_ID = "__fallout__";
export const FALLOUT_NAME = "Not Qualified";

let seq = 0;
export const nid = (p: string) => `${p}_${Date.now().toString(36)}_${++seq}`;

export const MODE_LABEL: Record<WorkMode, string> = {
  remote: "🏠 Remote",
  hybrid: "🏢 Hybrid",
  onsite: "🚶 Onsite",
};

/** Default stage template — order matters; "Hired" must be last. */
export function defaultStages(): Stage[] {
  const mk = (name: string, icon: string, criteria: number, evalType: EvalType, difficulty: Difficulty, failLabel?: string): Stage => ({
    id: nid("st"), name, icon, criteria, evalType, difficulty, failLabel,
    mail: { ...DEFAULT_MAIL },
  });
  return [
    mk("Applied", "📥", 0, "ai", "easy", "Not Eligible"),
    mk("Resume Screening", "📄", 70, "ai", "medium", "Resume Rejected"),
    mk("Aptitude Round", "🧠", 70, "ai", "medium", "Aptitude Failed"),
    mk("Coding MCQ", "💻", 70, "ai", "hard", "Coding MCQ Failed"),
    mk("Coding Assignment", "⌨️", 70, "ai", "hard", "Coding Failed"),
    mk("Live Q&A", "🎤", 70, "ai_human", "hard", "Live QA Failed"),
    mk("HR Interview", "🤝", 70, "human", "easy", "HR Rejected"),
    mk("Technical Interview", "🛠", 70, "human", "hard", "Technical Rejected"),
    mk("Final Interview", "🏁", 70, "human", "extreme", "Final Rejected"),
    mk("Hired", "🎉", 100, "human", "easy"),
  ];
}

export const EMPLOYMENT_LABEL: Record<JobReq["employmentType"], string> = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract", internship: "Internship",
};

export function newJob(): JobReq {
  return {
    id: nid("job"),
    title: "",
    description: "",
    mode: "remote",
    ctcMin: 0,
    ctcMax: 0,
    openings: 1,
    lastDate: "",
    startDate: "",
    location: "",
    education: "",
    employmentType: "full_time",
    additionalReq: "",
    skills: [],
    minExp: 0,
    status: "draft",
    createdAt: new Date().toISOString(),
    stages: defaultStages(),
    candidates: [],
  };
}

const KEY = "prema.hiring.jobs";

export function loadJobs(): JobReq[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as JobReq[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveJobs(jobs: JobReq[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

/**
 * Deterministic "AI" resume screening: skill-keyword coverage vs the JD,
 * plus experience / depth / education heuristics. No network, no model —
 * a transparent stand-in for a real LLM screener.
 */
export function analyzeResume(
  job: JobReq,
  resume: string,
): { score: number; matched: string[]; missing: string[] } {
  const text = resume.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of job.skills) {
    const k = s.trim().toLowerCase();
    if (k && text.includes(k)) matched.push(s);
    else missing.push(s);
  }
  const coverage = job.skills.length ? matched.length / job.skills.length : 0.6;
  const years = /(\d+)\+?\s*(years|yrs)/i.exec(resume);
  const exp = years ? Math.min(1, Number(years[1]) / Math.max(1, job.minExp || 1)) : 0.5;
  const depth = Math.min(1, resume.split(/\s+/).filter(Boolean).length / 220);
  const edu = /b\.?tech|b\.?e\b|m\.?tech|mca|bca|bachelor|master|degree/i.test(resume) ? 1 : 0.7;
  const score = Math.round(100 * (coverage * 0.5 + exp * 0.2 + depth * 0.15 + edu * 0.15));
  return { score: Math.max(5, Math.min(98, score)), matched, missing };
}

/** Stable 0-99 hash so demo/simulated scores never flicker between renders. */
function hashPct(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100;
}

/**
 * Full AI evaluation for a candidate at a stage — sub-scores, strengths,
 * concerns and a recommendation. Resume-based for the first two stages;
 * later rounds add deterministic per-stage variance around the resume base.
 */
export function aiEvaluate(job: JobReq, stage: Stage, cand: Candidate): StageEval {
  const { score: base, matched, missing } = analyzeResume(job, cand.resume);
  const idx = job.stages.findIndex((s) => s.id === stage.id);
  const variance = idx <= 1 ? 0 : (hashPct(cand.id + stage.id) % 25) - 12;
  const score = Math.max(5, Math.min(98, base + variance));
  const years = /(\d+)\+?\s*(years|yrs)/i.exec(cand.resume);
  const expYears = years ? Number(years[1]) : 0;
  const experience = Math.min(100, Math.round((expYears / Math.max(1, job.minExp || 1)) * 100));
  const education = /b\.?tech|b\.?e\b|m\.?tech|mca|bca|bachelor|master|degree/i.test(cand.resume) ? 100 : 60;
  const next = job.stages[idx + 1];
  const pass = score >= stage.criteria;
  const strengths: string[] = [];
  if (matched.length) strengths.push(`Strong in ${matched.slice(0, 3).join(", ")}`);
  if (experience >= 100) strengths.push(`${expYears} yrs meets the ${job.minExp} yrs bar`);
  if (education === 100) strengths.push("Relevant degree");
  const concerns: string[] = [];
  if (missing.length) concerns.push(`Missing skills: ${missing.join(", ")}`);
  if (experience < 100) concerns.push(`Experience ${expYears} yrs below ${job.minExp} yrs requirement`);
  if (!pass) concerns.push(`Overall ${score}% is under the ${stage.criteria}% gate`);
  const failName = stage.failLabel ?? `${stage.name} Failed`;
  return {
    at: new Date().toISOString(),
    by: stage.evalType === "human" ? "human" : "ai",
    score,
    skillsMatched: matched.length,
    skillsTotal: matched.length + missing.length,
    experience,
    education,
    missing,
    strengths: strengths.length ? strengths : ["Application complete"],
    concerns,
    recommendation: pass
      ? next && next.id !== job.stages[job.stages.length - 1].id
        ? `Move to ${next.name}`
        : "Recommend for hire 🎉"
      : `Do not advance — ${score}% < ${stage.criteria}% (${failName})`,
  };
}

const DEMO: { name: string; email: string; phone: string; years: number; extra: string }[] = [
  { name: "Aarav Sharma", email: "aarav@mail.com", phone: "91 90000 11111", years: 4, extra: "B.Tech CSE. Led React and Node services in production." },
  { name: "Diya Patel", email: "diya@mail.com", phone: "91 90000 22222", years: 2, extra: "B.E. Information Technology. Built REST APIs and dashboards." },
  { name: "Rohan Verma", email: "rohan@mail.com", phone: "91 90000 33333", years: 6, extra: "M.Tech. Mentored juniors, owned microservices and CI/CD." },
  { name: "Sneha Reddy", email: "sneha@mail.com", phone: "91 90000 44444", years: 1, extra: "BCA graduate, eager learner, internship project experience." },
  { name: "Kabir Singh", email: "kabir@mail.com", phone: "91 90000 55555", years: 3, extra: "B.Tech. Freelance full-stack projects and open source." },
];

/** Five ready-made candidates at varied pipeline positions (deterministic). */
export function demoCandidates(job: JobReq): Candidate[] {
  const applied = job.stages[0];
  const screening = job.stages[1];
  return DEMO.map((d, i) => {
    const n = Math.max(1, job.skills.length);
    const skills = job.skills.filter((_, si) => si % n !== (n - 1 - (i % n)) % n);
    const resume = `${d.years} years of experience. Skills: ${skills.join(", ")}. ${d.extra}`;
    const { score } = analyzeResume(job, resume);
    const c: Candidate = {
      id: nid("cand"),
      name: d.name,
      email: d.email,
      phone: d.phone,
      resume,
      appliedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      stageId: applied.id,
      match: score,
      scores: {},
      evals: {},
      history: [{ at: new Date(Date.now() - (i + 1) * 86400000).toISOString(), stage: applied.name, result: "entered", note: "Applied via job link" }],
    };
    // Simulate the first two past AI screening with different outcomes.
    if (i < 2) {
      const crit = screening.criteria;
      c.scores[applied.id] = score;
      c.evals[applied.id] = aiEvaluate(job, screening, c);
      if (score >= crit) {
        c.stageId = screening.id;
        c.history.push({ at: new Date().toISOString(), stage: applied.name, result: "passed", note: `AI match ${score}% ≥ ${crit}%` });
      } else {
        c.stageId = FALLOUT_ID;
        c.history.push({ at: new Date().toISOString(), stage: applied.name, result: "fallout", note: `AI match ${score}% < ${crit}%` });
      }
    }
    return c;
  });
}

/** Aggregate funnel numbers for a job's board. */
export function funnelStats(job: JobReq) {
  const perStage = job.stages.map((s) => ({
    id: s.id,
    name: s.name,
    criteria: s.criteria,
    count: job.candidates.filter((c) => c.stageId === s.id).length,
  }));
  const fallout = job.candidates.filter((c) => c.stageId === FALLOUT_ID);
  const falloutByStage: Record<string, number> = {};
  for (const c of fallout) {
    const f = [...c.history].reverse().find((h) => h.result === "fallout");
    if (f) falloutByStage[f.stage] = (falloutByStage[f.stage] ?? 0) + 1;
  }
  const last = job.stages[job.stages.length - 1];
  return {
    perStage,
    total: job.candidates.length,
    fallout: fallout.length,
    falloutByStage,
    hired: last ? job.candidates.filter((c) => c.stageId === last.id).length : 0,
  };
}