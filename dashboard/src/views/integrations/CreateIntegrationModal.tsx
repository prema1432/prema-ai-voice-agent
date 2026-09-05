import { useState } from "react";
import { IntegrationCatalogType, api } from "../../api";
import { Button } from "../../components";

const ALL_EVENTS = [
  "campaign.started", "campaign.paused", "campaign.completed",
  "leads.added", "lead.moved", "call.ended", "agent.created", "*",
];

/**
 * Modal to add a dynamic integration. Fields derive from the chosen type's
 * catalog entry — new types only need a catalog row, not new UI.
 */
export function CreateIntegrationModal({
  types,
  events,
  onClose,
  onCreated,
}: {
  types: Record<string, IntegrationCatalogType>;
  events: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState("webhook");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selected, setSelected] = useState<string[]>(["*"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meta = types[type];

  function toggleEvent(ev: string) {
    setSelected((s) => {
      if (ev === "*") return s.includes("*") ? [] : ["*"];
      if (s.includes("*")) return [ev];
      return s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev];
    });
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await api.createIntegration({
        type,
        name: name.trim() || `${meta.label} ${Date.now().toString(36)}`,
        description: desc.trim(),
        enabled: true,
        config: { url: url.trim(), secret: secret.trim() },
        events: selected.length ? selected : ["*"],
      });
      onCreated();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="card pop" style={{ maxWidth: 620, width: "100%", maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h3>🔌 Add integration</h3>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>

        <label className="lbl">Type</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 7 }}>
          {Object.entries(types).map(([key, t]) => (
            <button
              key={key}
              className={`btn sm ${type === key ? "primary" : ""}`}
              style={{ justifyContent: "flex-start", padding: "8px 10px" }}
              onClick={() => { setType(key); setSecret(""); }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {meta && (
          <div className="msg ok" style={{ marginTop: 10, fontSize: 12 }}>
            {meta.blurb}
          </div>
        )}

        <label className="lbl">Name</label>
        <input className="input" value={name} placeholder={`e.g. My ${meta?.label ?? "integration"}`} onChange={(e) => setName(e.target.value)} />

        <label className="lbl">Endpoint URL (where events are POSTed)</label>
        <input className="input" value={url} placeholder="https://your-service.com/hook" onChange={(e) => setUrl(e.target.value)} />

        <label className="lbl">Secret / token (sent as X-Webhook-Secret)</label>
        <input className="input" value={secret} placeholder="optional" onChange={(e) => setSecret(e.target.value)} />

        <label className="lbl">Description</label>
        <input className="input" value={desc} placeholder="optional note" onChange={(e) => setDesc(e.target.value)} />

        <label className="lbl">Subscribe to events</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(events.length ? events : ALL_EVENTS).map((ev) => (
            <button
              key={ev}
              className={`btn sm ${selected.includes(ev) ? "primary" : ""}`}
              onClick={() => toggleEvent(ev)}
            >
              {ev}
            </button>
          ))}
        </div>

        {err && <div className="msg err" style={{ marginTop: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={submit}>
            {busy ? <><span className="spinner" /> Creating…</> : "✨ Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
