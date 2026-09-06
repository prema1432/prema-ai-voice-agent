/* ============================================================
   Demo candidates — ready-made applicants at varied pipeline
   positions, generated deterministically for a given job so a
   board can be explored without real applications.
   ============================================================ */
import { analyzeResume, aiEvaluate, FALLOUT_ID, Candidate, JobReq, nid } from "./model";

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
      answers: {},
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
