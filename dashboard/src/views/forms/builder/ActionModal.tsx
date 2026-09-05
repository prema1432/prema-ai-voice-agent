import { useEffect, useState } from "react";
import { Campaign, FormAction, api } from "../../../api";
import { Button } from "../../../components";

const TYPES = [
  { v: "webhook", l: "🌐 Webhook", d: "POST the submission JSON to any URL" },
  { v: "google_sheet", l: "📊 Google Sheets", d: "Send each row to an Apps Script URL" },
  { v: "email", l: "✉️ Email", d: "Send a notification email (SMTP)" },
  { v: "notification", l: "🔔 In-app notification", d: "Show a dashboard notification" },
  { v: "campaign_lead", l: "📞 Campaign lead", d: "Drop the submitter into a calling campaign" },
];

const tokensHint = "Use {{field_id}} to insert submitted values.";

export default function ActionModal({
  action,
  onClose,
  onSave,
}: {
  action?: FormAction;
  onClose: () => void;
  onSave: (a: FormAction) => void;
}) {
  const [a, setA] = useState<FormAction>(
    action ?? { id: `act_${Date.now().toString(36)}_${Math.floor(Math.random() * 999)}`, type: "webhook", name: "Webhook", enabled: true, config: {} },
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    api.listCampaigns().then(setCampaigns).catch(() => {});
  }, []);

  const cfg = a.config as Record<string, string>;
  const setCfg = (key: string, value: string) =>
    setA((prev) => ({ ...prev, config: { ...prev.config, [key]: value } }));

  function pickType(t: string) {
    const meta = TYPES.find((x) => x.v === t);
    setA((prev) => ({ ...prev, type: t, name: meta?.l.replace(/^\S+\s/, "") ?? t }));
  }

  const save = () => {
    if (!a.name.trim()) a.name = a.type;
    onSave(a);
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="card pop" style={{ maxWidth: 660, width: "100%", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h3>⚙ Action workflow</h3>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
          Runs automatically when someone submits the form. {tokensHint}
        </div>

        <label className="lbl">Action type</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          {TYPES.map((t) => (
            <button key={t.v} type="button" className={`card-hover ${a.type === t.v ? "sel" : ""}`} style={{
              border: a.type === t.v ? "1.5px solid var(--accent-1)" : "1px solid var(--border-soft)",
              background: a.type === t.v ? "rgba(99,102,241,.08)" : "var(--bg-soft)",
              borderRadius: 10, padding: "8px 10px", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
            }} onClick={() => pickType(t.v)}>
              <div style={{ fontWeight: 650, fontSize: 12.5 }}>{t.l}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.d}</div>
            </button>
          ))}
        </div>

        <label className="lbl">Action name</label>
        <input className="input" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} />

        {a.type === "webhook" && (
          <div>
            <label className="lbl">Webhook URL *</label>
            <input className="input" value={cfg.url ?? ""} placeholder="https://example.com/hook" onChange={(e) => setCfg("url", e.target.value)} />
            <label className="lbl" style={{ marginTop: 10 }}>Headers (JSON, optional)</label>
            <input className="input" style={{ fontFamily: "monospace" }} value={cfg.headers ?? ""} placeholder='{"X-Token": "secret"}' onChange={(e) => setCfg("headers", e.target.value)} />
          </div>
        )}

        {a.type === "google_sheet" && (
          <div>
            <label className="lbl">Google Apps Script / Sheets URL *</label>
            <input className="input" value={cfg.url ?? ""} placeholder="https://script.google.com/macros/s/…/exec" onChange={(e) => setCfg("url", e.target.value)} />
            <div className="msg ok" style={{ fontSize: 12, marginTop: 8 }}>
              📊 The row (form answers) is POSTed as JSON with an <code>answers</code> object — paste a small doPost(e) script that appends it.
            </div>
          </div>
        )}

        {a.type === "email" && (
          <div>
            <label className="lbl">To (comma separated)</label>
            <input className="input" value={cfg.to ?? ""} placeholder="sales@example.com, {{email}}" onChange={(e) => setCfg("to", e.target.value)} />
            <label className="lbl" style={{ marginTop: 10 }}>Subject</label>
            <input className="input" value={cfg.subject ?? ""} placeholder="New lead: {{name}}" onChange={(e) => setCfg("subject", e.target.value)} />
            <label className="lbl" style={{ marginTop: 10 }}>Body (HTML ok; blank = auto list of answers)</label>
            <textarea className="input" style={{ height: 90 }} value={cfg.body ?? ""} placeholder="A {{name}} ({{phone}}) submitted…" onChange={(e) => setCfg("body", e.target.value)} />
          </div>
        )}

        {a.type === "notification" && (
          <div>
            <label className="lbl">Title</label>
            <input className="input" value={cfg.title ?? ""} placeholder="📝 New form submission" onChange={(e) => setCfg("title", e.target.value)} />
            <label className="lbl" style={{ marginTop: 10 }}>Message</label>
            <input className="input" value={cfg.message ?? ""} placeholder="{{name}} just submitted the form" onChange={(e) => setCfg("message", e.target.value)} />
          </div>
        )}

        {a.type === "campaign_lead" && (
          <div>
            <label className="lbl">Campaign</label>
            <select className="select" value={cfg.campaign_id ?? ""} onChange={(e) => setCfg("campaign_id", e.target.value)}>
              <option value="">— choose campaign —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="lbl">Phone field key</label>
                <input className="input" value={cfg.phone_field ?? "phone"} onChange={(e) => setCfg("phone_field", e.target.value)} />
              </div>
              <div>
                <label className="lbl">Name field key</label>
                <input className="input" value={cfg.name_field ?? "name"} onChange={(e) => setCfg("name_field", e.target.value)} />
              </div>
            </div>
            <div className="msg ok" style={{ fontSize: 12, marginTop: 8 }}>
              📞 Creates (or updates) a lead in that campaign — your calling agents can then dial the submitter.
            </div>
          </div>
        )}

        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, marginTop: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={a.enabled !== false} onChange={(e) => setA({ ...a, enabled: e.target.checked })} />
          Enabled
        </label>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!a.name.trim()}>💾 Save action</Button>
        </div>
      </div>
    </div>
  );
}
