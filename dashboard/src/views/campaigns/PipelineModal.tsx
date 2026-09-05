import { useState } from "react";
import { CrmStage, api } from "../../api";
import { Button } from "../../components";

const SWATCHES = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];

let seq = 0;
const nid = () => `stage_${Date.now().toString(36)}_${++seq}`;

/**
 * Per-campaign CRM pipeline configuration: order, names, colors and terminal
 * flags for every column on the drag-and-drop board.
 */
export default function PipelineModal({
  campaignId,
  stages,
  onClose,
  onSaved,
}: {
  campaignId: string;
  stages: CrmStage[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<CrmStage[]>(stages);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const patch = (id: string, p: Partial<CrmStage>) =>
    setRows((rs) => rs.map((s) => (s.id === id ? { ...s, ...p } : s)));

  function move(id: string, dir: -1 | 1) {
    setRows((rs) => {
      const i = rs.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addStage() {
    setRows((rs) => [
      ...rs,
      { id: nid(), name: `Stage ${rs.length + 1}`, color: SWATCHES[rs.length % SWATCHES.length], terminal: false },
    ]);
  }

  function remove(id: string) {
    setRows((rs) => (rs.length <= 1 ? rs : rs.filter((s) => s.id !== id)));
  }

  async function save() {
    const clean = rows.map((s, i) => ({ ...s, name: (s.name.trim() || `Stage ${i + 1}`).slice(0, 40) }));
    setBusy(true);
    setErr(null);
    try {
      await api.saveCrmStages(campaignId, clean);
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
        style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head">
          <h3>🗂 CRM pipeline configuration</h3>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
          These columns appear on the drag-and-drop board. Terminal stages (🎉 Won / 🚫 Lost) record the final outcome
          when a lead is dropped there. Every change is audit-logged.
        </div>

        {err && <div className="msg err">{err}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                border: "1px solid var(--border-soft)", borderRadius: 10, padding: "6px 8px",
                background: "var(--bg-soft)",
              }}
            >
              <button className="btn ghost sm" disabled={i === 0} onClick={() => move(s.id, -1)}>↑</button>
              <button className="btn ghost sm" disabled={i === rows.length - 1} onClick={() => move(s.id, 1)}>↓</button>
              <input type="color" value={s.color} style={{ width: 34, height: 28, padding: 1, border: "none", background: "transparent", cursor: "pointer" }} onChange={(e) => patch(s.id, { color: e.target.value })} title="Column color" />
              <input
                className="input"
                style={{ flex: "1 1 140px", minWidth: 110, padding: "6px 8px" }}
                value={s.name}
                onChange={(e) => patch(s.id, { name: e.target.value })}
                placeholder="Stage name"
              />
              <button
                type="button"
                className={`chip ${s.terminal ? "on" : ""}`}
                onClick={() => patch(s.id, { terminal: !s.terminal })}
                title="Terminal stage: dropping a lead here records the final outcome"
              >
                {s.terminal ? "🎯 terminal" : "○ open"}
              </button>
              <button className="btn ghost sm del" disabled={rows.length <= 1} onClick={() => remove(s.id)} title="Remove stage">🗑</button>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={addStage} style={{ marginTop: 10 }}>
          ➕ Add stage
        </Button>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : "💾 Save pipeline"}
          </Button>
        </div>
      </div>
    </div>
  );
}
