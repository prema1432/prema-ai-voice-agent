import { useMemo, useState } from "react";
import { Button, Card, EmptyState } from "../components";

type WidgetType = "form" | "chat" | "stats" | "voice";

interface Widget {
  id: string;
  name: string;
  type: WidgetType;
  tone: string;
  config: Record<string, string | number>;
  created_at: string;
}

const KEY = "prema.widgets";
const nid = () => `wid-${Date.now().toString(36)}`;

const WIDGET_DEFS: { type: WidgetType; icon: string; label: string; blurb: string }[] = [
  { type: "form", icon: "📝", label: "Form widget", blurb: "Embed a published form inline on any site" },
  { type: "chat", icon: "💬", label: "Chat widget", blurb: "AI chat bubble that answers with your agent persona" },
  { type: "stats", icon: "📊", label: "Stats widget", blurb: "Live campaign counters for your landing page" },
  { type: "voice", icon: "📞", label: "Voice widget", blurb: "Call-to-action bubble that starts a Voice Lab call" },
];

function blank(name: string, type: WidgetType): Widget {
  return { id: nid(), name, type, tone: "#6366f1", config: {}, created_at: new Date().toISOString() };
}

export default function Widgets() {
  const [rows, setRows] = useState<Widget[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Widget[];
    } catch {
      return [];
    }
  });
  const [edit, setEdit] = useState<Widget | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function persist(next: Widget[]) {
    setRows(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const embed = useMemo(() => {
    if (!edit) return "";
    const cfg = encodeURIComponent(JSON.stringify(edit.config));
    return `<script src="${location.origin}/widgets.js?w=${edit.id}&c=${cfg}" defer></script>`;
  }, [edit]);

  function copyEmbed(w: Widget) {
    const cfg = encodeURIComponent(JSON.stringify(w.config));
    const code = `<script src="${location.origin}/widgets.js?w=${w.id}&c=${cfg}" defer></script>`;
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(w.id);
    setTimeout(() => setCopied(null), 1600);
  }

  const bg = (tone: string) => tone || "#6366f1";

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🧩 Widgets</h2>
          <div className="sub">Build embeddable form, chat, voice and stats widgets for any website</div>
        </div>
      </div>

      <div className="wid-defs">
        {WIDGET_DEFS.map((d) => (
          <Card key={d.type} className="wid-def" onClick={() => { setEdit(blank(`${d.label} · ${rows.length + 1}`, d.type)); }}>
            <span className="wid-def-icon">{d.icon}</span>
            <b>{d.label}</b>
            <p>{d.blurb}</p>
            <span className="wid-add">＋ Create</span>
          </Card>
        ))}
      </div>

      {edit && (
        <Card title="🛠 Configure widget" style={{ marginBottom: 20 }}>
          <div className="req-form">
            <div>
              <label className="lbl">Widget name</label>
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Accent colour</label>
              <input className="input" type="color" value={edit.tone} onChange={(e) => setEdit({ ...edit, tone: e.target.value })} style={{ height: 40, padding: 4, cursor: "pointer" }} />
            </div>
            {edit.type === "form" && (
              <div>
                <label className="lbl">Form slug</label>
                <input className="input" value={String(edit.config.slug ?? "")} onChange={(e) => setEdit({ ...edit, config: { ...edit.config, slug: e.target.value } })} placeholder="my-form-slug" />
              </div>
            )}
            {edit.type === "chat" && (
              <div>
                <label className="lbl">Welcome message</label>
                <input className="input" value={String(edit.config.welcome ?? "")} onChange={(e) => setEdit({ ...edit, config: { ...edit.config, welcome: e.target.value } })} placeholder="Hi! How can I help you today?" />
              </div>
            )}
            {edit.type === "stats" && (
              <div>
                <label className="lbl">Campaign id (optional)</label>
                <input className="input" value={String(edit.config.campaign_id ?? "")} onChange={(e) => setEdit({ ...edit, config: { ...edit.config, campaign_id: e.target.value } })} placeholder="leave empty for global stats" />
              </div>
            )}
            {edit.type === "voice" && (
              <div>
                <label className="lbl">Agent id (optional)</label>
                <input className="input" value={String(edit.config.agent_id ?? "")} onChange={(e) => setEdit({ ...edit, config: { ...edit.config, agent_id: e.target.value } })} />
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>Opens the Voice Lab in a new tab with this agent preloaded.</div>
              </div>
            )}
          </div>

          <div className="wid-preview" style={{ ["--wt" as string]: bg(edit.tone) }}>
            {edit.type === "form" && <div className="wp-box">📝 {edit.name}</div>}
            {edit.type === "chat" && (
              <div className="wp-chat">
                <div className="wp-bubble">{(edit.config.welcome as string) || "Hi! How can I help?"}</div>
                <div className="wp-dots"><i /><i /><i /></div>
              </div>
            )}
            {edit.type === "stats" && <div className="wp-box">📊 128 calls · 64 connected · ₹0 STT/TTS</div>}
            {edit.type === "voice" && (
              <div className="wp-voice">
                <span>📞</span>
                <div><b>Talk to an AI agent</b><em>Tap to try it live</em></div>
              </div>
            )}
          </div>

          <div className="lbl" style={{ marginTop: 16 }}>Embed code</div>
          <pre className="embed-code"><code>{embed}</code></pre>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => copyEmbed(edit)}>{copied === edit.id ? "✓ Copied!" : "⧉ Copy embed code"}</Button>
            <Button onClick={() => persist(rows.some((r) => r.id === edit.id) ? rows.map((r) => (r.id === edit.id ? edit : r)) : [edit, ...rows])}>
              Save widget
            </Button>
            <Button onClick={() => setEdit(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card><EmptyState icon="🧩" title="No widgets yet" sub="Create a widget above and drop the embed code on any site" /></Card>
      ) : (
        <div className="wid-grid">
          {rows.map((w) => {
            const d = WIDGET_DEFS.find((x) => x.type === w.type);
            return (
              <Card key={w.id} className="wid-row" onClick={() => setEdit(w)}>
                <span className="wid-ic" style={{ background: `linear-gradient(135deg, ${bg(w.tone)}, ${bg(w.tone)}99)` }}>{d?.icon}</span>
                <div>
                  <b>{w.name}</b>
                  <em>{d?.label} · {new Date(w.created_at).toLocaleDateString()}</em>
                </div>
                <button onClick={(e) => { e.stopPropagation(); copyEmbed(w); }}>{copied === w.id ? "✓" : "⧉"}</button>
                <button className="danger" onClick={(e) => { e.stopPropagation(); if (confirm("Delete widget?")) persist(rows.filter((x) => x.id !== w.id)); }}>✕</button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}