import { useEffect, useState } from "react";
import { api, CallSession, Campaign } from "../api";
import { Button, Card, EmptyState, StatCard, StatusBadge, LangPill, timeAgo } from "../components";
import { navigate } from "../router";

type CampaignStats = {
  total?: number;
  by_status?: Record<string, number>;
  by_outcome?: Record<string, number>;
  calls?: Record<string, number>;
  dialer_running?: boolean;
};

export default function Dashboard({ health }: { health: Record<string, unknown> | null }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calls, setCalls] = useState<CallSession[]>([]);

  useEffect(() => {
    Promise.all([api.listCampaigns(), api.listCalls()])
      .then(([cs, cl]) => {
        setCampaigns(cs);
        setCalls(cl);
      })
      .catch(() => undefined);
  }, []);

  const leadTotal = campaigns.reduce((s, c) => s + (((c.stats ?? {}) as CampaignStats).total ?? 0), 0);
  const running = campaigns.filter((c) => c.status === "running").length;
  const connected = calls.filter((c) => c.outcome === "connected" || c.status === "connected").length;
  const interested = calls.reduce((s, c) => s + (c.lead_score != null && c.lead_score >= 60 ? 1 : 0), 0);
  const recent = calls.slice(0, 6);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <div className="sub">Campaign overview & recent agent activity</div>
        </div>
        <div className="page-head-actions">
          <Button variant="primary" onClick={() => navigate("campaigns")}>
            ＋ New campaign
          </Button>
          <Button onClick={() => navigate("voicelab")}>🎤 Try Voice Lab</Button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Campaigns" value={campaigns.length} icon="📋" tone="indigo" sub={`${running} running now`} />
        <StatCard label="Total leads" value={leadTotal} icon="👥" tone="violet" sub="across all campaigns" />
        <StatCard label="Call sessions" value={calls.length} icon="📞" tone="cyan" sub={`${connected} connected`} />
        <StatCard label="Hot leads (≥60)" value={interested} icon="🔥" tone="green" sub="by AI lead score" />
      </div>

      <div className="grid-2">
        <Card
          title="Active campaigns"
          action={
            <Button size="sm" onClick={() => navigate("campaigns")}>
              View all →
            </Button>
          }
        >
          {campaigns.length === 0 ? (
            <EmptyState icon="🗂️" title="No campaigns yet" sub="Create your first outbound campaign" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {campaigns.slice(0, 5).map((c) => {
                const st = (c.stats ?? {}) as CampaignStats;
                const by = st.by_status ?? {};
                const total = st.total ?? 0;
                const done =
                  (by.completed ?? 0) + (by.failed ?? 0) + (by.dnd ?? 0) + (by.skipped ?? 0);
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`campaigns/${c.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--border-soft)",
                      cursor: "pointer",
                      background: "var(--bg-soft)",
                      flexWrap: "wrap",
                    }}
                  >
                    <StatusBadge status={c.status} />
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</span>
                    <LangPill code={c.languages?.[0]} />
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
                      {total} leads · {done} done
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Recent calls"
          action={
            <Button size="sm" onClick={() => navigate("calls")}>
              View all →
            </Button>
          }
        >
          {recent.length === 0 ? (
            <EmptyState icon="📞" title="No calls yet" sub="Run a campaign or talk in the Voice Lab" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recent.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`calls/${c.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border-soft)",
                    cursor: "pointer",
                    background: "var(--bg-soft)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}>
                    {c.phone ?? "browser-call"}
                  </span>
                  <StatusBadge status={c.outcome ?? c.status} />
                  {c.lead_score != null && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      score {c.lead_score}
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-faint)" }}>
                    {timeAgo(c.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="System status" style={{ marginTop: 18 }}>
        <div className="kv" style={{ display: "flex", flexWrap: "wrap", gap: "10px 34px" }}>
          {[
            ["LLM model", String(health?.llm_model ?? "—")],
            ["API key", health?.llm_key_set ? "configured ✓" : "missing ✗"],
            ["STT backend", String(health?.stt_backend ?? "—")],
            ["TTS backend", String(health?.tts_backend ?? "—")],
            ["VAD backend", String(health?.vad_backend ?? "—")],
            ["Telephony", String(health?.telephony ?? "—")],
          ].map(([k, v]) => (
            <span key={k} style={{ fontSize: 12.5 }}>
              <span style={{ color: "var(--text-muted)" }}>{k}: </span>
              <code>{v}</code>
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}