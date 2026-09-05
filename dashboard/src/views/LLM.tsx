import { useEffect, useMemo, useState } from "react";
import { LlmStatus, LlmUsage, api } from "../api";
import { Badge, Bars, Button, Card, EmptyState, StatCard } from "../components";
import { navigate } from "../router";

const fmtTok = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const fmtCost = (n: number) =>
  n >= 1 ? `$${n.toFixed(3)}` : n >= 0.001 ? `$${n.toFixed(5)}` : `$${n.toFixed(6)}`;

export default function LlmPage() {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [usage, setUsage] = useState<LlmUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    api.llmStatus().then(setStatus).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    api.llmUsage(days).then(setUsage).catch((e) => setErr(String(e)));
  }, [days]);

  const t = usage?.total;
  const inputTokens = t?.prompt_tokens ?? 0;
  const outputTokens = t?.completion_tokens ?? 0;
  const paidCost = t && t.cost > 0 ? t.cost : 0;

  const dailyCosts = useMemo(
    () => (usage?.per_day ?? []).map((d) => d.cost),
    [usage],
  );
  const dailyCalls = useMemo(
    () => (usage?.per_day ?? []).map((d) => d.calls),
    [usage],
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🧠 LLM &amp; Cost</h2>
          <div className="sub">Live model, thinking effort, token usage and cost monitoring</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button size="sm" variant="ghost" onClick={() => navigate("llm/models")}>
            📚 Browse models
          </Button>
          {[1, 7, 30].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "primary" : "default"} onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      {/* Current model card */}
      <Card style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>⚙️ Currently in use</h3>
          <Badge tone={status?.enabled ? "green" : "red"}>
            {status?.enabled ? "● LLM enabled" : "● key missing"}
          </Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
          <div>
            <div className="lbl" style={{ marginTop: 0 }}>Chat model (OpenRouter)</div>
            <div style={{ fontSize: 17, fontWeight: 700, wordBreak: "break-all" }}>
              {status?.model ?? "…"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Free fallbacks: {status?.free_fallbacks?.join(", ") || "—"}</div>
          </div>
          <div>
            <div className="lbl" style={{ marginTop: 0 }}>Thinking effort</div>
            <div>
              <Badge tone={status?.thinking_effort ? "violet" : "gray"}>
                {status?.thinking_effort ? `🧠 ${status.thinking_effort}` : "off"}
              </Badge>{" "}
              {status?.send_reasoning && <Badge tone="blue">reasoning sent</Badge>}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              Reasoning visible to the agent but not spoken.
            </div>
          </div>
          <div>
            <div className="lbl" style={{ marginTop: 0 }}>Summary model</div>
            <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-all" }}>{status?.summary_model ?? "—"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              Usage tracking {status?.usage_enabled ? "on" : "off"} · {status?.base_url}
            </div>
          </div>
        </div>
      </Card>

      {!usage ? (
        <Card>
          <EmptyState icon="🧠" title="Loading usage…" />
        </Card>
      ) : (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <StatCard label="Calls (window)" value={t?.calls ?? 0} sub={`last ${usage.window_days} days · ${t?.free_calls ?? 0} free`} icon="📡" tone="indigo" />
            <StatCard label="Input tokens" value={fmtTok(inputTokens)} sub="prompt / context" icon="⬇️" tone="cyan" />
            <StatCard label="Output tokens" value={fmtTok(outputTokens)} sub="completions" icon="⬆️" tone="violet" />
            <StatCard label="Cost" value={paidCost > 0 ? fmtCost(paidCost) : "$0.000"} sub={t && t.cost <= 0 ? "all calls were free 🎉" : "OpenRouter charges"} icon="💰" tone="green" />
          </div>

          <div className="grid-2">
            <Card title={<span>📈 Calls per day</span>}>
              {dailyCalls.length === 0 ? (
                <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No LLM calls in this window yet.
                </div>
              ) : (
                <>
                  <Bars data={dailyCalls} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
                    <span>{usage.per_day[0]?._id}</span>
                    <span>{usage.per_day[usage.per_day.length - 1]?._id}</span>
                  </div>
                </>
              )}
            </Card>

            <Card title={<span>💰 Spend per day</span>}>
              {dailyCosts.every((c) => c === 0) ? (
                <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No paid usage — you're on free models. 🎉
                </div>
              ) : (
                <>
                  <Bars data={dailyCosts} color="var(--green)" />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
                    <span>{usage.per_day[0]?._id}</span>
                    <span>{usage.per_day[usage.per_day.length - 1]?._id}</span>
                  </div>
                </>
              )}
            </Card>
          </div>

          {usage.per_model.length > 0 && (
            <Card title={<span>🧩 Models used</span>} style={{ marginTop: 18 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th style={{ textAlign: "right" }}>Calls</th>
                    <th style={{ textAlign: "right" }}>Input</th>
                    <th style={{ textAlign: "right" }}>Output</th>
                    <th style={{ textAlign: "right" }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.per_model.map((m) => (
                    <tr key={m._id}>
                      <td style={{ fontWeight: 600 }}>{m._id}</td>
                      <td style={{ textAlign: "right" }}>{m.calls}</td>
                      <td style={{ textAlign: "right" }} className="num">{fmtTok(m.prompt_tokens)}</td>
                      <td style={{ textAlign: "right" }} className="num">{fmtTok(m.completion_tokens)}</td>
                      <td style={{ textAlign: "right" }} className="num">{m.cost > 0 ? fmtCost(m.cost) : "free"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card title={<span>🕘 Recent LLM calls</span>} style={{ marginTop: 18 }}>
            {usage.recent.length === 0 ? (
              <EmptyState icon="🗒" title="Nothing logged yet" sub="Once you talk to an agent or run a campaign, every LLM call is logged here." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Model</th>
                      <th>Purpose</th>
                      <th style={{ textAlign: "right" }}>In → Out</th>
                      <th style={{ textAlign: "right" }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.recent.map((r, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                          {new Date(r.ts).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={{ fontWeight: 600 }}>{r.model}</td>
                        <td style={{ color: "var(--text-muted)" }}>{r.purpose}</td>
                        <td style={{ textAlign: "right" }} className="num">
                          {fmtTok(r.prompt_tokens)} → {fmtTok(r.completion_tokens)}
                        </td>
                        <td style={{ textAlign: "right" }} className="num">
                          {r.free ? <Badge tone="green">free</Badge> : r.cost > 0 ? fmtCost(r.cost) : "$0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
