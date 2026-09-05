import { useState } from "react";
import { LANGUAGES, Lead, api } from "../../api";
import { Button } from "../../components";

const STATUSES = ["new", "dialing", "in_progress", "completed", "failed", "dnd", "skipped"];

export default function LeadEditModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: () => void;
}) {
  const extra = (lead.extra ?? {}) as Record<string, unknown>;
  const [name, setName] = useState(lead.name ?? "");
  const [phone, setPhone] = useState(lead.phone);
  const [language, setLanguage] = useState(lead.language ?? "");
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(typeof extra.notes === "string" ? extra.notes : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!phone.trim()) {
      setErr("Phone is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.updateLead(lead.id, {
        name: name.trim() || null,
        phone: phone.trim(),
        language: language || null,
        status,
        notes: notes.trim() || null,
      });
      onSaved();
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
        style={{ maxWidth: 520, width: "100%", maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head">
          <h3>✎ Edit lead</h3>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>

        {err && <div className="msg err">{err}</div>}

        <label className="lbl">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead name" />

        <label className="lbl">Phone *</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ fontFamily: "monospace" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="lbl">Language</label>
            <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="">— default —</option>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Status</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="lbl">Notes / guidelines for the agent</label>
        <textarea
          className="input"
          style={{ height: 90, resize: "vertical" }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. visited the shop once, asked for 10% off…"
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : "💾 Save lead"}
          </Button>
        </div>
      </div>
    </div>
  );
}
