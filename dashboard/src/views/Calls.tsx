import { useCallback, useEffect, useState } from "react";
import { api, CallSession, Campaign } from "../api";
import { Badge, Button, Card, EmptyState, LangPill, StatusBadge, timeAgo } from "../components";
import { navigate } from "../router";

export default function CallsView() {
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");

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

      {calls.length === 0 ? (
        <Card>
          <EmptyState
            icon="📞"
            title="No calls yet"
            sub="Start a campaign or talk to an agent in the Voice Lab to see sessions here."
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {calls.map((c) => {
            const turnCount = (c.transcript ?? []).length;
            const snippet = (c.transcript ?? [])[0]?.text;
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
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        ⏱ {Math.floor(c.duration_seconds / 60)}:{String(c.duration_seconds % 60).padStart(2, "0")}
                      </span>
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
                    {turnCount} turn{turnCount === 1 ? "" : "s"}
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