import { useState } from "react";
import { AgentPersona, Campaign, LANGUAGES, api } from "../../api";
import { Button } from "../../components";

const TOOLS = [
  "book_appointment",
  "set_callback",
  "check_availability",
  "send_whatsapp",
  "transfer_human",
  "end_call",
  "opt_out_dnd",
  "update_crm",
];

const emptyReq =
  "You are a polite sales agent. Greet the lead, understand their need, share the offer, and try to close politely.";

export default function CampaignModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Campaign;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const isEdit = Boolean(initial);
  const agent = (initial?.agent ?? {}) as Partial<AgentPersona>;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [lang, setLang] = useState(initial?.languages?.[0] ?? "te");
  const [dialProvider, setDialProvider] = useState(initial?.dial_provider ?? "mock");
  const [concurrency, setConcurrency] = useState(initial?.concurrency ?? 1);
  const [goal, setGoal] = useState(initial?.expected_leads ? String(initial.expected_leads) : "");
  const [agentName, setAgentName] = useState(agent.name ?? "Priya");
  const [requirements, setRequirements] = useState(agent.requirements ?? emptyReq);
  const [tools, setTools] = useState<string[]>(agent.tools_enabled ?? ["book_appointment", "set_callback", "end_call"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleTool = (t: string) =>
    setTools((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  function payload() {
    const persona: AgentPersona = {
      name: agentName.trim() || "Priya",
      requirements,
      primary_language: lang,
      fallback_languages: ["hinglish", "en"],
      auto_language_switch: true,
      tools_enabled: tools,
      max_call_seconds: 600,
    };
    return {
      name: name.trim(),
      description: description.trim(),
      language: lang,
      languages: [lang],
      dial_provider: dialProvider,
      concurrency: Math.max(1, Math.min(50, concurrency)),
      expected_leads: goal ? Math.max(1, parseInt(goal, 10) || 1) : null,
      agent: persona,
    };
  }

  async function save() {
    if (!name.trim()) {
      setErr("Campaign name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (initial) {
        const body = {
          ...payload(),
          active: true,
          // Preserve untouched fields the backend requires on full PUT.
          created_at: initial.created_at ?? new Date().toISOString(),
          schedule_start: initial.schedule_start ?? null,
          schedule_end: initial.schedule_end ?? null,
          team_agent_ids: initial.team_agent_ids ?? [],
          agent_config_id: null,
        };
        await api.updateCampaign(initial.id, body);
      } else {
        await api.createCampaign(payload());
      }
      onSaved(initial?.id);
    } catch (e) {
      setErr(String(e).slice(0, 300));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="card pop"
        style={{ maxWidth: 720, width: "100%", maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head">
          <h3>{isEdit ? "✎ Edit campaign" : "🚀 New campaign"}</h3>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>

        {err && <div className="msg err">{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="lbl">Campaign name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali Offer — Oct batch" />
          </div>
          <div>
            <label className="lbl">Primary language</label>
            <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Dial provider</label>
            <select className="select" value={dialProvider} onChange={(e) => setDialProvider(e.target.value)}>
              <option value="mock">🖥️ Mock (browser / Voice Lab)</option>
              <option value="asterisk">📞 Asterisk + SIP (real calls)</option>
            </select>
          </div>
          <div>
            <label className="lbl">🤖 Agents to spin (max concurrent calls)</label>
            <input type="number" min={1} max={50} className="input" value={concurrency} onChange={(e) => setConcurrency(parseInt(e.target.value, 10) || 1)} />
          </div>
          <div>
            <label className="lbl">🎯 Expected leads (minimum goal)</label>
            <input type="number" min={1} className="input" placeholder="e.g. 20" value={goal} onChange={(e) => setGoal(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
        </div>

        <label className="lbl" style={{ marginTop: 12 }}>Description (shown on the dashboard)</label>
        <textarea className="input" style={{ height: 54, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary of this batch — offer, region, goal…" />

        <div className="card-head" style={{ marginTop: 12, marginBottom: 8 }}>
          <h3 style={{ fontSize: 13.5 }}>👤 Campaign agent</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <div>
            <label className="lbl">Agent name</label>
            <input className="input" value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g. Priya" />
          </div>
          <div>
            <label className="lbl">Requirements / persona prompt</label>
            <textarea className="input" style={{ height: 110, resize: "vertical" }} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
          </div>
        </div>

        <label className="lbl" style={{ marginTop: 12 }}>Tools the agent may call</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
          {TOOLS.map((t) => (
            <button key={t} type="button" className={`chip ${tools.includes(t) ? "on" : ""}`} onClick={() => toggleTool(t)}>
              ⚙ {t}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : isEdit ? "💾 Save changes" : "🚀 Create campaign"}
          </Button>
        </div>
      </div>
    </div>
  );
}
