import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState } from "../components";
import { JobReq, MODE_LABEL, funnelStats, loadJobs, newJob, saveJobs } from "./aireq/model";
import JobEditor from "./aireq/JobEditor";
import Board from "./aireq/Board";
import "./aireq/aireq.css";
import { JobPreviewCard } from "./aireq/PublicJob";

type View = { kind: "list" } | { kind: "pipeline"; id: string } | { kind: "funnel"; id: string } | { kind: "preview"; id: string };

/** AI Requirement — hiring pipelines: JD + stage machine with pass criteria. */
export default function AiRequirement() {
  const [jobs, setJobs] = useState<JobReq[]>(() => loadJobs());
  const [view, setView] = useState<View>({ kind: "list" });
  const [editing, setEditing] = useState<JobReq | null>(null);

  useEffect(() => saveJobs(jobs), [jobs]);

  const upsert = (j: JobReq) => {
    setJobs((prev) => (prev.some((x) => x.id === j.id) ? prev.map((x) => (x.id === j.id ? j : x)) : [j, ...prev]));
  };

  const active = view.kind !== "list" ? jobs.find((j) => j.id === (view as { id: string }).id) : undefined;
  useEffect(() => {
    if (view.kind !== "list" && !active) setView({ kind: "list" });
  }, [view, active]);

  if (editing) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h2>🧠 AI Requirement — job setup</h2>
            <div className="sub">Describe the role, then tune the pipeline stages and their pass criteria</div>
          </div>
        </div>
        <JobEditor
          job={editing}
          onSave={(j) => {
            upsert(j);
            setEditing(null);
            setView({ kind: "pipeline", id: j.id });
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  if (view.kind === "preview" && active) {
    const url = `${location.origin}/jobs/${active.id}`;
    return (
      <div>
        <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => setView({ kind: "list" })}>
          ← All jobs
        </button>
        <div className="page-head">
          <div>
            <h2>👁 Job preview — candidate view</h2>
            <div className="sub">Exactly what applicants see at the public link below</div>
          </div>
        </div>
        <Card style={{ marginBottom: 14 }}>
          <div className="card-head"><h3>🔗 Application link</h3><Badge tone={active.status === "published" ? "green" : "gray"}>{active.status}</Badge></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code className="jr-link">{url}</code>
            <Button size="sm" onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); }}>📋 Copy</Button>
            <Button size="sm" onClick={() => window.open(url, "_blank")}>↗ Open</Button>
          </div>
          <div className="sub" style={{ marginTop: 8 }}>Share this URL on job boards or with candidates — applications land straight in the <b>Applied</b> stage.</div>
        </Card>
        <JobPreviewCard job={active} />
      </div>
    );
  }

  if (view.kind === "pipeline" && active) {
    return (
      <div>
        <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => setView({ kind: "list" })}>
          ← All jobs
        </button>
        <Board job={active} onChange={upsert} />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Button onClick={() => setView({ kind: "funnel", id: active.id })}>📊 Funnel & fallout</Button>
          <Button onClick={() => setEditing(active)}>✏️ Edit job & stages</Button>
        </div>
      </div>
    );
  }

  if (view.kind === "funnel" && active) {
    return (
      <div>
        <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => setView({ kind: "pipeline", id: active.id })}>
          ← Back to pipeline
        </button>
        <Funnel job={active} />
      </div>
    );
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
          <Button variant="primary" onClick={() => setEditing(newJob())}>＋ New job requirement</Button>
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
            <Button variant="primary" onClick={() => setEditing(newJob())}>＋ Create your first job</Button>
          </div>
        </Card>
      ) : (
        <div className="req-grid">
          {jobs.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              onOpen={() => setView({ kind: "pipeline", id: j.id })}
              onPreview={() => setView({ kind: "preview", id: j.id })}
              onEdit={() => setEditing(j)}
              onToggle={() => upsert({ ...j, status: j.status === "published" ? "closed" : "published" })}
              onDelete={() => { if (confirm(`Delete "${j.title}" and its ${j.candidates.length} candidates?`)) setJobs(jobs.filter((x) => x.id !== j.id)); }}
            />
          ))}
        </div>
      )}
    </div>
  );

function JobCard({
  job, onOpen, onPreview, onEdit, onToggle, onDelete,
}: {
  job: JobReq;
  onOpen: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const st = useMemo(() => funnelStats(job), [job]);
  const fill = Math.min(100, Math.round((st.hired / Math.max(1, job.openings)) * 100));
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
        <button onClick={onPreview}>👁 preview</button>
        <button onClick={onEdit}>✏️ edit</button>
        <button onClick={onToggle}>{job.status === "published" ? "⏸ close" : "🚀 publish"}</button>
        <button className="danger" onClick={onDelete}>🗑</button>
      </div>
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
}