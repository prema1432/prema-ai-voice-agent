import { useEffect, useMemo, useState } from "react";
import { api, Campaign, CrmBoard, CrmStage, Lead } from "../api";
import { Badge, Card, EmptyState, LangPill, StatCard } from "../components";

let tempStageSeq = 0;
const newStageId = () => `stage_${Date.now().toString(36)}_${++tempStageSeq}`;

/**
 * Campaign CRM board — drag leads across pipeline stages. Stage config is
 * stored per campaign and editable inline (add / rename / color / delete).
 */
export default function Crm({ campaignId }: { campaignId?: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [activeId, setActiveId] = useState<string | undefined>(campaignId);
  const [board, setBoard] = useState<CrmBoard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [savingStages, setSavingStages] = useState(false);

  // Load campaign list for the picker.
  useEffect(() => {
    api.listCampaigns().then(setCampaigns).catch((e) => setErr(String(e)));
  }, []);

  // Auto-select the first campaign when none given.
  useEffect(() => {
    if (!activeId && campaigns && campaigns.length > 0) setActiveId(campaigns[0].id);
  }, [campaigns, activeId]);

  const loadBoard = (id?: string) => {
    if (!id) {
      setBoard(null);
      return;
    }
    api.crmBoard(id).then(setBoard).catch((e) => setErr(String(e)));
  };

  useEffect(() => {
    loadBoard(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  async function moveLead(leadId: string, toStage: string) {
    if (!activeId || !board) return;
    const fromStage = Object.entries(board.columns).find(([, leads]) =>
      leads.some((l) => l.id === leadId),
    )?.[0];
    if (fromStage === toStage) return;
    // Optimistic move; revert silently on failure.
    const prev = board;
    setBoard({
      ...prev,
      columns: Object.fromEntries(
        Object.entries(prev.columns).map(([sid, leads]) => [
          sid,
          sid === fromStage
            ? leads.filter((l) => l.id !== leadId)
            : sid === toStage
              ? [...leads, leads.find((l) => l.id === leadId) ?? { id: leadId } as Lead]
              : leads,
        ]),
      ),
    });
    try {
      await api.moveLead(activeId, leadId, toStage);
    } catch (e) {
      setErr(String(e));
      setBoard(prev);
    }
  }

  async function saveStages(next: CrmStage[]) {
    if (!activeId) return;
    setSavingStages(true);
    try {
      const res = await api.saveCrmStages(activeId, next);
      setBoard((b) => (b ? { ...b, stages: res.stages } : b));
    } catch (e) {
      setErr(String(e));
    } finally {
      setSavingStages(false);
    }
  }

  function renameStage(id: string, name: string) {
    if (!board) return;
    saveStages(board.stages.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  function removeStage(id: string) {
    if (!board) return;
    saveStages(board.stages.filter((s) => s.id !== id));
  }

  function addStage(name: string) {
    if (!board || !name.trim()) return;
    saveStages([
      ...board.stages,
      { id: newStageId(), name: name.trim().slice(0, 40), color: "#6366f1", terminal: false },
    ]);
  }

  const byCount = useMemo(() => {
    if (!board) return {};
    return Object.fromEntries(board.stages.map((s) => [s.id, board.columns[s.id]?.length ?? 0]));
  }, [board]);

  if (!activeId || !board) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h2>🗂 CRM Board</h2>
            <div className="sub">Drag leads through your campaign pipeline</div>
          </div>
        </div>
        {err && <div className="msg err">{err}</div>}
        {campaigns && campaigns.length === 0 && (
          <Card>
            <EmptyState icon="🗂" title="No campaigns yet" sub="Create a campaign and add leads to start moving them through a pipeline." />
          </Card>
        )}
        {campaigns && campaigns.length > 0 && (
          <Card>
            <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
          </Card>
        )}
      </div>
    );
  }

  const leadName = (l: Lead) => l.name ?? l.phone;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🗂 {board && campaigns?.find((c) => c.id === activeId)?.name} CRM</h2>
          <div className="sub">Drag cards between columns to update each lead's pipeline stage</div>
        </div>
        <div className="page-head-actions">
          <select className="select" style={{ width: "auto", minWidth: 240 }} value={activeId} onChange={(e) => setActiveId(e.target.value)}>
            {campaigns?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <StatCard label="Leads" value={board.totals.leads} icon="👥" tone="indigo" />
        <StatCard label="In pipeline" value={board.totals.in_progress} icon="🔄" tone="cyan" />
        <StatCard label="Won" value={board.totals.won} icon="🎉" tone="green" />
        <StatCard label="Lost" value={board.totals.lost} icon="🚫" tone="red" />
      </div>

      <div className="kanban">
        {board.stages.map((s) => (
          <div
            key={s.id}
            className={`kanban-col ${dragOver === s.id ? "over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(s.id);
            }}
            onDragLeave={() => setDragOver((d) => (d === s.id ? null : d))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const lid = e.dataTransfer.getData("text/lead-id");
              if (lid) moveLead(lid, s.id);
            }}
          >
            <div className="kanban-head" style={{ borderTopColor: s.color }}>
              <input
                className="stage-name"
                defaultValue={s.name}
                style={{ color: s.color }}
                disabled={savingStages}
                onBlur={(e) => renameStage(s.id, e.target.value)}
              />
              <span className="count">{byCount[s.id] ?? 0}</span>

              <button className="btn ghost sm del" title="Remove stage" onClick={() => removeStage(s.id)} disabled={board.stages.length <= 1}>
                ✕
              </button>
            </div>
            <div className="kanban-cards">
              {(board.columns[s.id] ?? []).map((l) => (
                <div
                  key={l.id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/lead-id", l.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <b>{leadName(l)}</b>
                    {s.terminal && l.last_outcome ? <Badge tone={l.last_outcome === "won" ? "green" : "red"}>{l.last_outcome}</Badge> : null}
                  </div>
                  <div className="mono">{l.phone}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <LangPill code={l.language} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.call_count ?? 0} 📞</span>
                  </div>
                  {l.last_outcome && l.last_outcome !== "won" && l.last_outcome !== "lost" && (
                    <div style={{ marginTop: 5 }}>
                      <Badge tone="gray">{l.last_outcome}</Badge>
                    </div>
                  )}
                </div>
              ))}
              {(board.columns[s.id] ?? []).length === 0 && (
                <div className="kanban-empty">Drop leads here</div>
              )}
            </div>
          </div>
        ))}

        {/* Add-stage slot */}
        <AddStageColumn onAdd={addStage} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 12 }}>
        💡 Moves are recorded in the audit log and forwarded to integrations subscribed to <code>lead.moved</code>.
      </div>
    </div>
  );
}

/** Compact column used to append a new stage. */
function AddStageColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="kanban-col add">
      <input
        className="input"
        style={{ padding: 7, fontSize: 12.5 }}
        placeholder="➕ New stage…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onAdd(name);
            setName("");
          }
        }}
      />
    </div>
  );
}
