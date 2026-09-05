import { useCallback, useEffect, useState } from "react";
import { api, Campaign } from "../api";
import { Badge, Button, Card, EmptyState, LangPill, Progress, StatusBadge } from "../components";
import { navigate } from "../router";
import CampaignModal from "./campaigns/CampaignModal";
import { ScheduleChip } from "./campaigns/RunPlanner";

type CampaignStats = {
  total?: number;
  by_status?: Record<string, number>;
  by_outcome?: Record<string, number>;
  calls?: Record<string, number>;
  dialer_running?: boolean;
};

const FILTERS = ["all", "draft", "scheduled", "running", "paused"] as const;

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    try {
      setCampaigns(await api.listCampaigns());
    } catch {
      setMsg({ ok: false, text: "Could not reach backend." });
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = campaigns.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (!q.trim()) return true;
    const hay = `${c.name} ${c.description ?? ""} ${c.agent?.name ?? ""} ${c.languages?.join(" ")}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  async function act(c: Campaign, action: "start" | "pause" | "delete" | "cancel") {
    setBusy(true);
    setMsg(null);
    try {
      if (action === "start") await api.startCampaign(c.id);
      if (action === "pause") await api.pauseCampaign(c.id);
      if (action === "delete") {
        if (!window.confirm(`Delete campaign "${c.name}" and its leads? This cannot be undone.`)) return;
        await api.deleteCampaign(c.id);
      }
      if (action === "cancel") await api.cancelSchedule(c.id);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  const running = campaigns.filter((c) => c.status === "running").length;
  const totalLeads = campaigns.reduce((s, c) => {
    const st = (c.stats ?? {}) as CampaignStats;
    return s + (st.total ?? 0);
  }, 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>📋 Campaigns &amp; Leads</h2>
          <div className="sub">
            {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} · {totalLeads} leads total
            {running > 0 ? ` · ${running} running right now` : ""}
          </div>
        </div>
        <div className="page-head-actions">
          <Button variant="primary" onClick={() => setShowNew(true)}>
            🚀 New campaign
          </Button>
        </div>
      </div>

      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      <div className="toolbar">
        <div className="search">
          <input
            className="input"
            placeholder="Search name, description, agent…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="🗂️"
            title={campaigns.length === 0 ? "No campaigns yet" : "Nothing matches"}
            sub={
              campaigns.length === 0
                ? "Create your first campaign — then add leads from a CSV or the form and press Start."
                : "Try a different search term or status filter."
            }
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((c) => {
            const stats = (c.stats ?? {}) as CampaignStats;
            const by = stats.by_status ?? {};
            const total = stats.total ?? 0;
            const done = (by.completed ?? 0) + (by.failed ?? 0) + (by.dnd ?? 0) + (by.skipped ?? 0);
            const pct = total > 0 ? (done / total) * 100 : 0;
            const runningDialer = stats.dialer_running === true;
            const callCounts = stats.calls ?? {};
            const callsTotal = Object.values(callCounts).reduce((s, v) => s + Number(v), 0);
            const outcome = stats.by_outcome ?? {};

            return (
              <Card key={c.id} className="campaign-row">
                {/* header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ cursor: "pointer", flex: "1 1 260px", minWidth: 220 }} onClick={() => navigate(`campaigns/${c.id}`)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <StatusBadge status={c.status} />
                      <span style={{ fontWeight: 750, fontSize: 15 }}>{c.name}</span>
                      <LangPill code={c.languages?.[0]} />
                      {c.status === "running" && (
                        <Badge tone={runningDialer ? "green" : "red"}>
                          ● dialer {runningDialer ? "live" : "stopped"}
                        </Badge>
                      )}
                    </div>
                    {c.description && (
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 5, maxWidth: 560 }}>
                        {c.description}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <Badge tone="blue">👤 {c.agent?.name ?? "—"}</Badge>
                      <Badge tone="gray">⚙ {c.dial_provider}</Badge>
                      <Badge tone="gray">🤖 {c.concurrency || 1} agent(s)</Badge>
                      {c.expected_leads ? (
                        <Badge tone="green">🎯 ≥ {c.expected_leads} leads</Badge>
                      ) : null}
                      {c.schedule_start && c.status === "scheduled" && <ScheduleChip campaign={c} />}
                    </div>
                  </div>

                  <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {c.status === "running" ? (
                      <Button size="sm" disabled={busy} onClick={() => act(c, "pause")}>⏸ Pause</Button>
                    ) : c.status === "scheduled" ? (
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => act(c, "cancel")}>✕ Cancel run</Button>
                    ) : (
                      <Button size="sm" variant="primary" disabled={busy} onClick={() => act(c, "start")}>▶ Start</Button>
                    )}
                    <Button size="sm" onClick={() => setEditing(c)}>✎ Edit</Button>
                    <a className="btn sm" href={api.exportCsv(c.id)} download>⬇ CSV</a>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => act(c, "delete")}>🗑</Button>
                  </div>
                </div>

                {/* stats */}
                <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 220px", minWidth: 180 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: "var(--text-muted)" }}>Dialer progress</span>
                      <span style={{ color: "var(--text)" }}>{done}/{total} done</span>
                    </div>
                    <Progress value={pct} />
                    <div style={{ display: "flex", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
                      {Object.entries(by).map(([k, v]) => (
                        <Badge key={k} tone={k === "completed" ? "green" : k === "failed" || k === "dnd" ? "red" : "gray"}>
                          {k}: {v}
                        </Badge>
                      ))}
                      {Object.keys(by).length === 0 && (
                        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>no leads yet</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 22, fontSize: 12.5, color: "var(--text-muted)", flexWrap: "wrap" }}>
                    <div style={{ lineHeight: 1.9 }}>
                      <div>📞 Calls: <b style={{ color: "var(--text)" }}>{callsTotal}</b></div>
                      <div>🔥 Interested: <b style={{ color: "var(--text)" }}>{outcome.interested ?? 0}</b></div>
                      <div>↩️ Callbacks: <b style={{ color: "var(--text)" }}>{outcome.callback_requested ?? 0}</b></div>
                    </div>
                    <div style={{ lineHeight: 1.9 }}>
                      <div>🕐 Created: {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</div>
                      <div>🗂 Stage: <b style={{ color: "var(--text)" }}>{c.status}</b></div>
                    </div>
                  </div>
                </div>

                {/* footer actions */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--border-soft)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button size="sm" variant="primary" onClick={() => navigate(`campaigns/${c.id}`)}>
                    ➕ Leads &amp; details
                  </Button>
                  <Button size="sm" onClick={() => navigate(`crm/${c.id}`)}>🗂 CRM pipeline</Button>
                  {c.status !== "scheduled" && (
                    <Button size="sm" onClick={() => navigate(`campaigns/${c.id}`)}>
                      ⏰ Schedule a run
                    </Button>
                  )}
                  {c.status === "scheduled" && c.schedule_start && (
                    <Badge tone="violet">⏰ fires {new Date(c.schedule_start).toLocaleString()}</Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showNew && (
        <CampaignModal
          onClose={() => setShowNew(false)}
          onSaved={(id) => {
            setShowNew(false);
            load();
            if (id) navigate(`campaigns/${id}`);
            else navigate("campaigns");
          }}
        />
      )}
      {editing && (
        <CampaignModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
