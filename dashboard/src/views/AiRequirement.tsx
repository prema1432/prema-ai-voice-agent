import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, StatusBadge } from "../components";

type ReqStatus = "draft" | "scoping" | "approved" | "rejected";

interface Requirement {
  id: string;
  title: string;
  channel: "voice" | "chat" | "form" | "workflow";
  language: string;
  summary: string;
  features: string[];
  compliance: string[];
  status: ReqStatus;
  created_at: string;
}

const KEY = "prema.ai.requirements";
const STORE = "📞";
const CHANNEL_LABEL: Record<Requirement["channel"], string> = {
  voice: "AI Voice call",
  chat: "AI Chat bot",
  form: "Intelligent form",
  workflow: "Automation",
};
const CHANNEL_ICON: Record<Requirement["channel"], string> = {
  voice: "📞",
  chat: "💬",
  form: "📝",
  workflow: "⚙️",
};

function load(): Requirement[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Requirement[];
  } catch {
    return [];
  }
}

function nid() {
  return `req-${Date.now().toString(36)}`;
}

export default function AiRequirement() {
  const [rows, setRows] = useState<Requirement[]>(() => load());
  const [editing, setEditing] = useState<Requirement | null>(null);
  const [featuresText, setFeaturesText] = useState("");
  const [complianceText, setComplianceText] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(rows));
    } catch {
      /* ignore */
    }
  }, [rows]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      approved: rows.filter((r) => r.status === "approved").length,
      scoping: rows.filter((r) => r.status === "scoping").length,
    }),
    [rows],
  );

  function startNew() {
    setEditing({
      id: nid(),
      title: "",
      channel: "voice",
      language: "",
      summary: "",
      features: [],
      compliance: [],
      status: "draft",
      created_at: new Date().toISOString(),
    });
    setFeaturesText("");
    setComplianceText("");
  }

  function save() {
    if (!editing?.title.trim()) return;
    const feats = featuresText.split("\n").map((s) => s.trim()).filter(Boolean);
    const comp = complianceText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (rows.some((r) => r.id === editing.id)) {
      setRows(rows.map((r) => (r.id === editing.id ? { ...editing, features: feats, compliance: comp } : r)));
    } else {
      setRows([{ ...editing, features: feats, compliance: comp }, ...rows]);
    }
    setEditing(null);
  }

  function setStatus(id: string, status: ReqStatus) {
    setRows(rows.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🧠 AI Requirement</h2>
          <div className="sub">Capture and scope a new AI automation — voice, chat, form or workflow</div>
        </div>
        <div className="page-head-actions">
          <Button variant="primary" onClick={startNew}>＋ New requirement</Button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card tone-indigo"><span className="tone-line" /><span className="label">Requirements</span><div className="value">{stats.total}</div><div className="sub">total scoped</div></div>
        <div className="stat-card tone-green"><span className="tone-line" /><span className="label">Approved</span><div className="value">{stats.approved}</div><div className="sub">ready to build</div></div>
        <div className="stat-card tone-amber"><span className="tone-line" /><span className="label">In scoping</span><div className="value">{stats.scoping}</div><div className="sub">needs refinement</div></div>

      {editing && (
        <Card title={rows.some((r) => r.id === editing.id) ? "✏️ Edit requirement" : "➕ New requirement"} style={{ marginBottom: 20 }}>
          <div className="req-form">
            <div>
              <label className="lbl">Title</label>
              <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Insurance renewal follow-up bot" />
            </div>
            <div>
              <label className="lbl">Channel</label>
              <select className="select" value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value as Requirement["channel"] })}>
                <option value="voice">📞 AI Voice call</option>
                <option value="chat">💬 AI Chat bot</option>
                <option value="form">📝 Intelligent form</option>
                <option value="workflow">⚙️ Automation</option>
              </select>
            </div>
            <div>
              <label className="lbl">Primary language</label>
              <input className="input" value={editing.language} onChange={(e) => setEditing({ ...editing, language: e.target.value })} placeholder="Hinglish / Hindi / English / Telugu…" />
            </div>
            <div>
              <label className="lbl">Summary</label>
              <textarea className="input" rows={2} value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} placeholder="What should the automation achieve?" />
            </div>
            <div>
              <label className="lbl">Key features (one per line)</label>
              <textarea className="input" rows={4} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} placeholder={"Book appointments\nAnswer FAQs\nQualify budget"} />
            </div>
            <div>
              <label className="lbl">Compliance notes (one per line)</label>
              <textarea className="input" rows={3} value={complianceText} onChange={(e) => setComplianceText(e.target.value)} placeholder={"AI disclosure\nRecord consent\nDND opt-out"} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button variant="primary" onClick={save}>Save requirement</Button>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      {rows.length === 0 && !editing ? (
        <Card><EmptyState icon="🧠" title="No requirements yet" sub="Create your first AI automation requirement" /></Card>
      ) : (
        <div className="req-grid">
          {rows.map((r) => (
            <Card key={r.id} className="req-card" onClick={() => { setEditing(r); setFeaturesText(r.features.join("\n")); setComplianceText(r.compliance.join("\n")); }}>
              <div className="req-head">
                <span className="req-av">{CHANNEL_ICON[r.channel]}</span>
                <div>
                  <b>{r.title || "Untitled requirement"}</b>
                  <em>{CHANNEL_LABEL[r.channel]} · {r.language || "any language"}</em>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="req-summary">{r.summary || "No summary yet."}</p>
              {(r.features.length > 0 || r.compliance.length > 0) && (
                <div className="chips req-chips">
                  {r.features.slice(0, 4).map((f) => <span key={f} className="chip on">{f}</span>)}
                  {r.compliance.slice(0, 2).map((c) => <span key={c} className="chip">{c}</span>)}
                </div>
              )}
              <div className="req-actions">
                <button onClick={(e) => { e.stopPropagation(); setStatus(r.id, r.status === "approved" ? "scoping" : "approved"); }}>
                  {r.status === "approved" ? "↩ move to scoping" : "✓ approve"}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setStatus(r.id, r.status === "rejected" ? "scoping" : "rejected"); }} className="danger">
                  ✕ reject
                </button>
                <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this requirement?")) setRows(rows.filter((x) => x.id !== r.id)); }}>
                  🗑 delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
      </div>