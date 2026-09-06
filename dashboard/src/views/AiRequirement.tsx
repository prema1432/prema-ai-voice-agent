import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState } from "../components";
import { JobReq, MODE_LABEL, funnelStats, loadJobs, newJob, normalizeJob, saveJobs } from "./aireq/model";
import JobEditor from "./aireq/JobEditor";
import Board from "./aireq/Board";
import "./aireq/aireq.css";
import "./aireq/aireq-ui.css";
import { JobPreviewCard } from "./aireq/PublicJob";
import { navigate } from "../router";

/**
 * Routed view for the AI Requirement module. Every job screen has its own
 * URL so each opens in a dedicated page (no stacked single-page switching):
 *   /ai-requirement           → list
 *   /ai-requirement/new       → create job
 *   /ai-requirement/job/:id   → pipeline board
 *   /ai-requirement/job/:id/:tab → edit | funnel | share | pipeline
 */
export type AireqView =
  | { kind: "list" }
  | { kind: "editor"; id?: string }
  | { kind: "pipeline"; id: string }
  | { kind: "funnel"; id: string }
  | { kind: "share"; id: string };

const jobPath = (id: string, tab?: string) =>
  `ai-requirement/job/${id}${tab ? `/${tab}` : ""}`;

export default function AiRequirement({ view }: { view: AireqView }) {
  const [jobs, setJobs] = useState<JobReq[]>(() => loadJobs());
  useEffect(() => saveJobs(jobs), [jobs]);

  const upsert = (j: JobReq) => {
    setJobs((prev) => (prev.some((x) => x.id === j.id) ? prev.map((x) => (x.id === j.id ? j : x)) : [j, ...prev]));
  };
  const removeJob = (id: string) => setJobs((prev) => prev.filter((x) => x.id !== id));

  const active = view.kind !== "list" && view.kind !== "editor"
    ? jobs.find((j) => j.id === view.id)
    : undefined;

  // Editor screen — new job (no id) or editing an existing one.
  if (view.kind === "editor") {
    const existing = view.id ? jobs.find((j) => j.id === view.id) : undefined;
    const creating = !view.id;
    if (view.id && !existing) {
      return (
        <div>
          <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => navigate("ai-requirement")}>← All jobs</button>
          <Card><EmptyState icon="🕳️" title="Job not found" sub="It may have been deleted. Go back to the job list." /></Card>
        </div>
      );
    }
    return (
      <div>
        <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => navigate("ai-requirement")}>← All jobs</button>
        <div className="page-head">
          <div>
            <h2>{creating ? "✨ Create a job requirement" : `✏️ Editing — ${existing!.title || "Untitled job"}`}</h2>
            <div className="sub">
              {creating
                ? "Three steps: describe the role → choose what to ask candidates → set the hiring rounds and gates."
                : "Update the role, application form or pipeline stages — changes apply when you save."}
            </div>
          </div>
        </div>
        <JobEditor
          job={existing ?? normalizeJob(newJob())}
          onSave={(j) => {
            upsert(j);
            navigate(jobPath(j.id));
          }}
          onCancel={() => navigate(creating ? "ai-requirement" : jobPath(view.id!))}
        />
      </div>
    );
  }

  // Pipeline board for one job.
  if (view.kind === "pipeline") {
    if (!active) return <MissingJob onBack={() => navigate("ai-requirement")} />;
    return (
      <div>
        <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => navigate("ai-requirement")}>← All jobs</button>
        <Board job={active} onChange={upsert} />
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Button onClick={() => navigate(jobPath(active.id, "funnel"))}>📊 Funnel &amp; fallout</Button>
          <Button onClick={() => navigate(jobPath(active.id, "edit"))}>✏️ Edit job &amp; stages</Button>
          <Button variant="ghost" onClick={() => navigate(jobPath(active.id, "share"))}>🔗 Share &amp; preview</Button>
        </div>
      </div>
    );
  }

  // Funnel analytics for one job.
  if (view.kind === "funnel") {
    if (!active) return <MissingJob onBack={() => navigate("ai-requirement")} />;
    return (
      <div>
        <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => navigate(jobPath(active.id))}>← Back to pipeline</button>
        <Funnel job={active} />
      </div>
    );
  }

  // Share / candidate-preview page for one published job.
  if (view.kind === "share") {
    if (!active) return <MissingJob onBack={() => navigate("ai-requirement")} />;
    const url = `${location.origin}/jobs/${active.id}`;
    const shareText = encodeURIComponent(`Apply for ${active.title || "this opening"} — ${url}`);
    return (
      <div>
        <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => navigate(jobPath(active.id))}>← Back to pipeline</button>
        <div className="page-head">
          <div>
            <h2>👁 Job preview — candidate view</h2>
            <div className="sub">Exactly what applicants see at the public link below</div>
          </div>
        </div>
        <Card style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h3>🔗 Application link</h3>
            <Badge tone={active.status === "published" ? "green" : "gray"}>{active.status}</Badge>
          </div>
          <div className="jr-share-row">
            <code className="jr-link">{url}</code>
            <Button size="sm" variant="primary" onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); }}>📋 Copy</Button>
            <Button size="sm" onClick={() => window.open(url, "_blank")}>↗ Open</Button>
            <a className="jr-share-btn" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
            <a className="jr-share-btn" href={`mailto:?subject=${encodeURIComponent(`Job opening: ${active.title || "Apply now"}`)}&body=${shareText}`}>✉️ Email</a>
          </div>
          <div className="sub" style={{ marginTop: 8 }}>
            Share this unique URL on job boards or with candidates — applications land straight in the <b>Applied</b> stage.
          </div>
        </Card>
        <JobPreviewCard job={active} />
      </div>
    );
  }

  return <JobList jobs={jobs} upsert={upsert} remove={removeJob} />;
}

function MissingJob({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={onBack}>← All jobs</button>
      <Card>
        <EmptyState icon="🕳️" title="Job not found" sub="It may have been deleted from another tab. Go back to the job list." />
      </Card>
    </div>
  );
}

/** Job list — the module landing page. */
function JobList({
  jobs, upsert, remove,
}: {
  jobs: JobReq[];
  upsert: (j: JobReq) => void;
  remove: (id: string) => void;
}) {
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copyShare(id: string) {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    const url = `${location.origin}/jobs/${job.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
  }

  const published = jobs.filter((j) => j.status === "published").length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🧠 AI Requirement</h2>
          <div className="sub">Hiring pipelines — JD, stage criteria gates, AI resume screening, fallout tracking</div>
        </div>
        <div className="page-head-actions">
          <Button variant="primary" onClick={() => navigate("ai-requirement/new")}>＋ New job requirement</Button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card tone-indigo"><span className="tone-line" /><span className="label">Job requirements</span><div className="value">{jobs.length}</div><div className="sub">{published} published</div></div>
        <div className="stat-card tone-green"><span className="tone-line" /><span className="label">Candidates</span><div className="value">{jobs.reduce((n, j) => n + j.candidates.length, 0)}</div><div className="sub">across all pipelines</div></div>
        <div className="stat-card tone-violet"><span className="tone-line" /><span className="label">Hired</span><div className="value">{jobs.reduce((n, j) => n + funnelStats(j).hired, 0)}</div><div className="sub">positions filled</div></div>
        <div className="stat-card tone-red"><span className="tone-line" /><span className="label">Fallout</span><div className="value">{jobs.reduce((n, j) => n + funnelStats(j).fallout, 0)}</div><div className="sub">not qualified</div></div>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon="🧠"
            title="No job requirements yet"
            sub="Create a job, set pass criteria per stage, publish it — then candidates flow from Applied through AI screening to Hired."
          />
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <Button variant="primary" onClick={() => navigate("ai-requirement/new")}>＋ Create your first job</Button>
          </div>
        </Card>
      ) : (
        <div className="req-grid">
          {jobs.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              shareOpen={shareFor === j.id}
              copied={copied === j.id}
              onShare={() => {
                if (j.status !== "published") {
                  if (window.confirm(`Publish "${j.title || "this job"}" first so candidates can apply?`)) {
                    upsert({ ...j, status: "published" });
                    setShareFor(j.id);
                  }
                  return;
                }
                setShareFor(shareFor === j.id ? null : j.id);
              }}
              onCopy={() => copyShare(j.id)}
              onOpen={() => navigate(jobPath(j.id))}
              onPreview={() => navigate(jobPath(j.id, "share"))}
              onEdit={() => navigate(jobPath(j.id, "edit"))}
              onToggle={() => {
                const publishedNow = j.status !== "published";
                upsert({ ...j, status: publishedNow ? "published" : "closed" });
                if (publishedNow) setShareFor(j.id); // surface the share link right away
              }}
              onDelete={() => { if (window.confirm(`Delete "${j.title}" and its ${j.candidates.length} candidates?`)) remove(j.id); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({
  job, onOpen, onPreview, onEdit, onToggle, onDelete, onShare, onCopy, shareOpen, copied,
}: {
  job: JobReq;
  onOpen: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onShare: () => void;
  onCopy: () => void;
  shareOpen: boolean;
  copied: boolean;
}) {
  const st = useMemo(() => funnelStats(job), [job]);
  const fill = Math.min(100, Math.round((st.hired / Math.max(1, job.openings)) * 100));
  const shareUrl = `${location.origin}/jobs/${job.id}`;
  const shareText = encodeURIComponent(`Apply for ${job.title || "this opening"} — ${shareUrl}`);
  return (
    <Card className="req-card">
      <div className="req-head">
        <span className="req-av">💼</span>
        <div>
          <b>{job.title || "Untitled job"}</b>
          <em>{MODE_LABEL[job.mode]} · ₹{job.ctcMin || "?"}–{job.ctcMax || "?"} LPA · {job.stages.length} stages</em>
        </div>
        <Badge tone={job.status === "published" ? "green" : job.status === "closed" ? "red" : "gray"}>{job.status}</Badge>
      </div>
      <p className="req-summary">{job.description || "No description yet."}</p>
      <div className="chips req-chips">
        {job.skills.slice(0, 4).map((s) => <span key={s} className="chip on">{s}</span>)}
        {job.lastDate && <span className="chip">⏳ apply by {job.lastDate}</span>}
      </div>
      <div className="jr-fill">
        <div className="jr-fill-bar"><span style={{ width: `${fill}%` }} /></div>
        <em>{st.hired}/{job.openings} filled · {st.total} applied · {st.fallout} fallout</em>
      </div>
      <div className="req-actions">
        <button onClick={onOpen}>🗂 pipeline</button>
        <button onClick={onPreview}>👁 share</button>
        <button onClick={onShare} className={shareOpen ? "on" : ""}>🔗 copy link</button>
        <button onClick={onEdit}>✏️ edit</button>
        <button onClick={onToggle} className={job.status === "published" ? "soft" : "primary"}>
          {job.status === "published" ? "⏸ close" : "🚀 publish"}
        </button>
        <button className="danger" onClick={onDelete}>🗑</button>
      </div>

      {shareOpen && (
        <div className="jr-share">
          <div className="jr-share-head">
            <b>🔗 Candidate application link</b>
            <span className="chip">{job.status === "published" ? "live — accept applications" : "draft — publish to go live"}</span>
          </div>
          <div className="jr-share-row">
            <code className="jr-link">{shareUrl}</code>
            <button className="jr-share-btn primary" onClick={onCopy}>{copied ? "✓ Copied" : "📋 Copy"}</button>
            <a className="jr-share-btn" href={shareUrl} target="_blank" rel="noreferrer">↗ Open</a>
            <a className="jr-share-btn" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
            <a className="jr-share-btn" href={`mailto:?subject=${encodeURIComponent(`Job opening: ${job.title || "Apply now"}`)}&body=${shareText}`}>✉️ Email</a>
          </div>
          <div className="sub" style={{ marginTop: 6 }}>
            Share this unique link anywhere — every application lands in the <b>{job.stages[0]?.name ?? "Applied"}</b> stage below and you'll see the candidate here instantly.
          </div>
        </div>
      )}
    </Card>
  );
}

/** Stage-by-stage funnel bars + fallout breakdown (which stage kills candidates). */
function Funnel({ job }: { job: JobReq }) {
  const st = useMemo(() => funnelStats(job), [job]);
  const max = Math.max(1, ...st.perStage.map((p) => p.count), st.fallout);
  const falloutEntries = Object.entries(st.falloutByStage).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div className="page-head">
        <div>
          <h2>📊 {job.title} — funnel</h2>
          <div className="sub">{st.total} applied · {st.hired} hired · {st.fallout} fallout</div>
        </div>
      </div>

      <Card>
        <div className="card-head"><h3>Pipeline funnel</h3><Badge tone="blue">candidates per stage</Badge></div>
        <div className="stack">
          {st.perStage.map((p, i) => {
            const prev = i === 0 ? st.total : st.perStage[i - 1].count;
            const conv = prev > 0 ? Math.round((p.count / prev) * 100) : 0;
            const scored = job.candidates.filter((c) => c.stageId === p.id && c.scores[p.id] != null);
            const avg = scored.length ? Math.round(scored.reduce((s, c) => s + (c.scores[p.id] ?? 0), 0) / scored.length) : null;
            const waiting = p.count - scored.length;
            return (
              <div key={p.id} className="jr-funnel-row">
                <span className="jr-funnel-name">{p.name}</span>
                <span className="jr-crit-tag">≥ {p.criteria}%</span>
                <div className="jr-funnel-bar">
                  <span style={{ width: `${(p.count / max) * 100}%` }} />
                </div>
                <b className="jr-funnel-count">{p.count}</b>
                <span className="jr-funnel-meta">
                  {i > 0 && <em title="Conversion from previous stage">↳ {conv}%</em>}
                  {avg != null && <em title="Average score of evaluated candidates">avg {avg}%</em>}
                  {waiting > 0 && <em className="jr-wait" title="Waiting for evaluation">{waiting} waiting</em>}
                </span>
              </div>
            );
          })}
          <div className="jr-funnel-row">
            <span className="jr-funnel-name" style={{ color: "var(--red)" }}>Not Qualified</span>
            <span className="jr-crit-tag">fallout</span>
            <div className="jr-funnel-bar jr-fallout-bar">
              <span style={{ width: `${(st.fallout / max) * 100}%` }} />
            </div>
            <b className="jr-funnel-count">{st.fallout}</b>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <div className="card-head"><h3>Fallout heatmap — where candidates drop</h3></div>
        {falloutEntries.length === 0 ? (
          <EmptyState icon="🎉" title="No fallout yet" sub="Every candidate so far is still live in the pipeline" />
        ) : (
          <div className="chips">
            {falloutEntries.map(([stage, n]) => (
              <span key={stage} className="chip jr-fallout-chip">{stage}: {n} dropped ({Math.round((n / Math.max(1, st.fallout)) * 100)}%)</span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}