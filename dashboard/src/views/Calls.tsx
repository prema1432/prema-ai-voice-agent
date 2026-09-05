import { useCallback, useEffect, useState } from "react";
import { api, CallSession, Campaign } from "../api";

export default function CallsView() {
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCalls(await api.listCalls(campaignId || undefined));
    } catch {
      /* backend offline */
    }
  }, [campaignId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // live-ish refresh while campaigns run
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    api.listCampaigns().then(setCampaigns).catch(() => undefined);
  }, []);

  const outcomeColor: Record<string, string> = {
    interested: "#e6f7e6",
    not_interested: "#fdeaea",
    callback_requested: "#fff6e0",
    dnd: "#f0e6f7",
    failed: "#fdeaea",
    connected: "#e8f4fd",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Call sessions</h3>
        <select
          style={{ padding: 6, border: "1px solid #ccc", borderRadius: 6 }}
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {calls.length === 0 && <p style={{ color: "#777" }}>No calls yet.</p>}

      {calls.map((c) => (
        <div key={c.id} style={{ border: "1px solid #e2e2e2", borderRadius: 10, marginBottom: 10 }}>
          <div
            onClick={() => setOpenId(openId === c.id ? null : c.id)}
            style={{ display: "flex", gap: 12, padding: "12px 14px", cursor: "pointer", alignItems: "center", flexWrap: "wrap" }}
          >
            <strong>{c.phone ?? "browser-call"}</strong>
            <span style={{ fontSize: 12, color: "#666" }}>{c.agent_name}</span>
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 99,
                background: outcomeColor[c.outcome ?? ""] ?? "#eee",
              }}
            >
              {c.outcome ?? c.status}
            </span>
            {c.lead_score != null && (
              <span style={{ fontSize: 12, color: "#555" }}>score: {c.lead_score}</span>
            )}
            {c.language && <span style={{ fontSize: 12, color: "#888" }}>{c.language}</span>}
            {c.duration_seconds != null && (
              <span style={{ fontSize: 12, color: "#888" }}>{c.duration_seconds}s</span>
            )}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#999" }}>
              {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
            </span>
          </div>

          {openId === c.id && (
            <div style={{ borderTop: "1px solid #eee", padding: 14, background: "#fafafa" }}>
              {c.summary && (
                <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                  <strong>Summary:</strong> {c.summary}
                </p>
              )}
              {c.error && <p style={{ color: "#b00", fontSize: 13 }}>Error: {c.error}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(c.transcript ?? []).map((t, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: t.role === "agent" ? "flex-start" : "flex-end",
                      background: t.role === "agent" ? "#eef4ff" : "#fff",
                      border: "1px solid #e6e6e6",
                      padding: "6px 10px",
                      borderRadius: 10,
                      maxWidth: "80%",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "#888", fontSize: 11 }}>
                      {t.role} {t.language ? `· ${t.language}` : ""} —{" "}
                    </span>
                    {t.text}
                  </div>
                ))}
                {(c.transcript ?? []).length === 0 && <span style={{ color: "#999", fontSize: 13 }}>No transcript captured.</span>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
