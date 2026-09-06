/* ============================================================
   AI Requirement — hiring pipeline data model.
   Job requisition → stage machine (criteria gates) → candidates
   flow through with scored passes / tagged fallout. Client-side
   store, consistent with the other local-first modules.
   ============================================================ */

export type WorkMode = "remote" | "hybrid" | "onsite";

export interface Stage {
  id: string;
  name: string;
  /** Pass % required to leave this stage and move to the next one. */
  criteria: number;
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
  /** stageId → score achieved in that stage. */
  scores: Record<string, number>;
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
  skills: string[];
  minExp: number;
  status: "draft" | "published" | "closed";
  createdAt: string;
  stages: Stage[];
  candidates: Candidate[];
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
  const mk = (name: string, criteria: number): Stage => ({ id: nid("st"), name, criteria });
  return [
    mk("Applied", 0),
    mk("Resume Screening", 70),
    mk("Aptitude Round", 60),
    mk("Coding MCQ", 65),
    mk("Coding Assignment", 70),
    mk("Live Q&A (AI)", 75),
    mk("Face-to-Face Panel", 75),
  mk("HR Round", 70),
  mk("Hired", 100),
  ];
}

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
      history: [{ at: new Date(Date.now() - (i + 1) * 86400000).toISOString(), stage: applied.name, result: "entered", note: "Applied via job link" }],
    };
    // Simulate the first two past AI screening with different outcomes.
    if (i < 2) {
      const crit = screening.criteria;
      c.scores[applied.id] = score;
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