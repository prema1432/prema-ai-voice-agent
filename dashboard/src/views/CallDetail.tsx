import { useEffect, useState } from "react";
import { api, CallSession } from "../api";
import { Badge, Button, Card, EmptyState, LangPill, StatusBadge, fmtDate } from "../components";
import { navigate } from "../router";

type TranscriptTurn = { role: string; text: string; language?: string };

export default function CallDetail({ id }: { id: string }) {
  const [call, setCall] = useState<CallSession | null>(null);

  useEffect(() => {
    api.getCall(id).then(setCall).catch(() => setCall(null));
  }, [id]);

  if (!call) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate("calls")}>
          ← Back to calls
        </Button>
        <EmptyState icon="🔍" title="Call not found" sub="It may have been deleted, or the backend is offline." />
      </div>
    );
  }

  const transcript = (call.transcript ?? []) as TranscriptTurn[];
  const dur = call.duration_seconds;
  const mm = dur != null ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}` : null;

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("calls")}>
        ← Back to calls
      </Button>

      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            📞 {call.phone ?? "Browser call"}
            <StatusBadge status={call.outcome ?? call.status} />
            {call.lead_score != null && <Badge tone={call.lead_score >= 60 ? "green" : call.lead_score >= 35 ? "amber" : "red"}>score {call.lead_score}/100</Badge>}
          </h2>
          <div className="sub">
            {fmtDate(call.created_at)} · agent {call.agent_name ?? "—"} ·{" "}
            {call.language ? <LangPill code={call.language} /> : null}
          </div>
        </div>
      </div>

      {call.error && (
        <div className="msg err" style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}>
          ⚠️ {call.error}
        </div>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <Card title="Conversation transcript">
            {transcript.length === 0 ? (
              <EmptyState icon="💬" title="No transcript captured" sub="The call ended before any turns were recorded." />
            ) : (
              <div className="transcript" style={{ maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
                {transcript.map((t, i) => (
                  <div key={i} className={`bubble ${t.role === "agent" ? "agent" : "user"}`}>
                    <div className="meta">
                      {t.role === "agent" ? (call.agent_name ?? "Agent") : "Caller"}
                      {t.language ? ` · ${t.language}` : ""}
                    </div>
                    {t.text}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Call summary">
            {call.summary ? (
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--text)" }}>
                {call.summary}
              </p>
            ) : (
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                No summary generated for this call.
              </span>
            )}
          </Card>

          <Card title="Details" style={{ marginTop: 16 }}>
            <div className="kv">
              <dt>Call ID</dt>
              <dd>{call.id}</dd>
              {call.campaign_id && (
                <>
                  <dt>Campaign</dt>
                  <dd>{call.campaign_id}</dd>
                </>
              )}
              {call.lead_id && (
                <>
                  <dt>Lead</dt>
                  <dd>{call.lead_id}</dd>
                </>
              )}
              <dt>Status</dt>
              <dd>{call.status}</dd>
              <dt>Duration</dt>
              <dd>{mm ?? "—"}</dd>
              <dt>Agent</dt>
              <dd>{call.agent_name ?? "—"}</dd>
            </div>
          </Card>

          <Card title="AI verdict" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Badge tone={call.outcome ? "blue" : "gray"}>{call.outcome ?? "no outcome"}</Badge>
              {call.lead_score != null && (
                <Badge tone={call.lead_score >= 60 ? "green" : "amber"}>lead score {call.lead_score}</Badge>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}