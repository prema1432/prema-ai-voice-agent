import { useCallback, useEffect, useMemo, useState } from "react";
import { api, CallSession, Campaign } from "../api";
import { Badge, Button, Card, EmptyState, LangPill, StatusBadge, timeAgo } from "../components";
import ViewToggle, { useView } from "../components/ViewToggle";
import { navigate } from "../router";

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function CallsView() {
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [view, setView] = useView("calls");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setCalls(await api.listCalls(campaignId || undefined));
    } catch {
      /* backend offline */
    }
  }, [campaignId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    api.listCampaigns().then(setCampaigns).catch(() => undefined);
  }, []);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    calls.forEach((c) => {
      const st = c.outcome ?? c.status;
      if (st) s.add(st);
    });
    return Array.from(s).sort();
  }, [calls]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return calls.filter((c) => {
      if (status && c.outcome !== status && c.status !== status) return false;
      if (!needle) return true;
      const snippet = (c.transcript ?? []).map((t) => t.text ?? "").join(" ");
      const hay = `${c.phone ?? ""} ${c.agent_name ?? ""} ${c.outcome ?? ""} ${c.status ?? ""} ${snippet}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [calls, q, status]);

  const turnCount = (c: CallSession) => (c.transcript ?? []).length;
  const snippetOf = (c: CallSession) => (c.transcript ?? [])[0]?.text;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Call Logs</h2>
          <div className="sub">Every conversation session across campaigns</div>
        </div>
        <div className="page-head-actions">
          <select className="select" style={{ width: 220 }} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button onClick={load}>🔄 Refresh</Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <input
            className="input"
            placeholder="Search phone, agent, outcome, transcript…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="chips">
          <button className={`chip ${status === "" ? "on" : ""}`} onClick={() => setStatus("")}>All</button>
          {statuses.map((s) => (
            <button key={s} className={`chip ${status === s ? "on" : ""}`} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="📞"
            title={calls.length === 0 ? "No calls yet" : "Nothing matches"}
            sub={
              calls.length === 0
                ? "Start a campaign or talk to an agent in the Voice Lab to see sessions here."
                : "Try a different search term or status filter."
            }
          />
        </Card>
      ) : view === "cards" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map((c) => (
            <Card key={c.id} onClick={() => navigate(`calls/${c.id}`)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 9, padding: 15 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13.5, fontWeight: 600 }}>{c.phone ?? "browser-call"}</span>
                <StatusBadge status={c.outcome ?? c.status} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.language && <LangPill code={c.language} />}
                {c.agent_name && <Badge tone="gray">👤 {c.agent_name}</Badge>}
                {c.lead_score != null && (
                  <Badge tone={c.lead_score >= 60 ? "green" : c.lead_score >= 35 ? "amber" : "red"}>score {c.lead_score}</Badge>
                )}
              </div>
              {snippetOf(c) && (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, flex: 1 }}>
                  “{snippetOf(c)}”
                </div>
              )}
              <div style={{ borderTop: "1px dashed var(--border-soft)", paddingTop: 9, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {turnCount(c)} turn{turnCount(c) === 1 ? "" : "s"}
                  {c.duration_seconds != null ? ` · ⏱ ${fmtDur(c.duration_seconds)}` : ""}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{timeAgo(c.created_at)} →</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((c) => {
            const turns = turnCount(c);
            const snippet = snippetOf(c);
            return (
              <Card key={c.id} onClick={() => navigate(`calls/${c.id}`)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 13.5, fontWeight: 600 }}>
                    {c.phone ?? "browser-call"}
                  </span>
                  <StatusBadge status={c.outcome ?? c.status} />
                  {c.language && <LangPill code={c.language} />}
                  {c.agent_name && (
                    <Badge tone="gray">👤 {c.agent_name}</Badge>
                  )}
                  {c.lead_score != null && (
                    <Badge tone={c.lead_score >= 60 ? "green" : c.lead_score >= 35 ? "amber" : "red"}>
                      score {c.lead_score}
                    </Badge>
                  )}
                  <span style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                    {c.duration_seconds != null && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>⏱ {fmtDur(c.duration_seconds)}</span>
                    )}
                    <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{timeAgo(c.created_at)}</span>
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 9,
                    paddingTop: 9,
                    borderTop: "1px dashed var(--border-soft)",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {turns} turn{turns === 1 ? "" : "s"}
                  </span>
                  {snippet && (
                    <span
                      style={{
                        fontSize: 12.5,
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "60%",
                      }}
                    >
                      “{snippet}”
                    </span>
                  )}
                  {c.summary && (
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-faint)" }}>📄 summary →</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}