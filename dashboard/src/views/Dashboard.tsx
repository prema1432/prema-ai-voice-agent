import { useEffect, useMemo, useState } from "react";
import { api, CallSession, Campaign } from "../api";
import { Button, Card, EmptyState, LangPill, StatCard, StatusBadge, timeAgo } from "../components";
import { ColumnsChart, Donut, LegendRow, LineTrend, TrendChart } from "../components/Charts";
import { navigate } from "../router";

type CampaignStats = {
  total?: number;
  by_status?: Record<string, number>;
  by_outcome?: Record<string, number>;
  calls?: Record<string, number>;
  dialer_running?: boolean;
};

type DayPoint = { day: string; total: number; connected: number; avgScore: number };

/* ── Dynamic colour system (aligned with the recharts palette) ── */
const C = {
  indigo: "#6366f1",
  violet: "#8b5cf6",
  cyan: "#0ea5e9",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  pink: "#ec4899",
  slate: "#64748b",
};
const OUTCOME_COLORS: Record<string, string> = {
  connected: C.green,
  completed: C.green,
  interested: C.indigo,
  "no-answer": C.amber,
  callback: C.violet,
  busy: "#f97316",
  failed: C.red,
  dnd: C.slate,
  unknown: C.cyan,
};
const PALETTE = [C.indigo, C.violet, C.cyan, C.green, C.amber, C.pink, "#22d3ee", "#84cc16"];
const DAY = 86_400_000;

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

/* Real series bucketed from live call sessions. */
function buildDaily(calls: CallSession[], days: number): DayPoint[] {
  const buckets = new Map<string, { total: number; connected: number; s: number; n: number }>();
  const labels = new Map<string, string>();
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const k = dateKey(d);
    buckets.set(k, { total: 0, connected: 0, s: 0, n: 0 });
    labels.set(k, `${d.getMonth() + 1}/${d.getDate()}`);
  }
  for (const c of calls) {
    const b = buckets.get(dateKey(new Date(c.created_at ?? "")));
    if (!b) continue;
    b.total += 1;
    if (c.outcome === "connected" || c.outcome === "interested" || c.status === "connected") b.connected += 1;
    if (c.lead_score != null) {
      b.s += c.lead_score;
      b.n += 1;
    }
  }
  return [...buckets.entries()].map(([k, b]) => ({
    day: labels.get(k) ?? k,
    total: b.total,
    connected: b.connected,
    avgScore: b.n ? Math.round(b.s / b.n) : 0,
  }));
}

/* Deterministic demo series so analytics stay alive when the API is offline. */
function demoDaily(days: number): DayPoint[] {
  const out: DayPoint[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const w = i / days;
    out.push({
      day: `${d.getMonth() + 1}/${d.getDate()}`,
      total: Math.max(4, Math.round(16 + 9 * Math.sin(i * 1.7) + (1 - w) * 12)),
      connected: Math.max(2, Math.round(8 + 5 * Math.sin(i * 1.3 + 1) + (1 - w) * 7)),
      avgScore: Math.round(58 + 16 * Math.sin(i * 0.9 + 2)),
    });
  }
  return out;
}

function demoMix(daily: DayPoint[]) {
  const total = daily.reduce((s, d) => s + d.total, 0);
  const connected = daily.reduce((s, d) => s + d.connected, 0);
  const rest = Math.max(0, total - connected);
  const na = Math.round(rest * 0.45);
  const busy = Math.round(rest * 0.25);
  return {
    outcomes: [
      { name: "connected", value: connected },
      { name: "no-answer", value: na },
      { name: "busy", value: busy },
      { name: "failed", value: Math.max(0, rest - na - busy) },
    ],
    languages: [
      { name: "Telugu", value: Math.round(total * 0.34) },
      { name: "Hindi", value: Math.round(total * 0.26) },
      { name: "English", value: Math.round(total * 0.18) },
      { name: "Tamil", value: Math.round(total * 0.12) },
      { name: "Kannada", value: Math.round(total * 0.1) },
    ],
    campaigns: [
      { name: "Festive Offers", leads: 412 },
      { name: "Loan Renewal", leads: 318 },
      { name: "Insurance Q3", leads: 264 },
      { name: "DTH Upgrade", leads: 197 },
      { name: "Feedback", leads: 121 },
    ],
  };
}

/* ── Tech stack, in detail ───────────────────────────────── */
const TECH_STACK = [
  {
    cat: "Frontend",
    icon: "⚛️",
    tone: C.indigo,
    items: [
      { name: "React 18 + TypeScript", desc: "Strict typed SPA, no framework lock-in" },
      { name: "Vite 5", desc: "Instant HMR dev server, optimised prod build" },
      { name: "Recharts", desc: "SVG area / line / bar / donut charts" },
      { name: "Framer Motion", desc: "Spring physics & 3D scroll animation" },
    ],
  },
  {
    cat: "Backend API",
    icon: "🛠️",
    tone: C.cyan,
    items: [
      { name: "FastAPI (Python)", desc: "Async routers, OpenAPI docs at /docs" },
      { name: "MongoDB + Motor", desc: "Async document store for all state" },
      { name: "Pydantic models", desc: "Validated request/response contracts" },
      { name: "Event bus", desc: "Audit, notifications & webhook fan-out" },
    ],
  },
  {
    cat: "Voice Pipeline",
    icon: "🎙️",
    tone: C.violet,
    items: [
      { name: "WebRTC / WebSocket", desc: "Realtime audio streaming to browser" },
      { name: "Silero VAD", desc: "Turn-taking & barge-in detection" },
      { name: "Whisper STT", desc: "Hindi, Telugu, Tamil, Kannada + more" },
      { name: "Neural TTS", desc: "Natural voices with SSML pacing" },
    ],
  },
  {
    cat: "AI / LLM",
    icon: "🧠",
    tone: C.pink,
    items: [
      { name: "OpenRouter gateway", desc: "GPT, Claude, Gemini, Llama — one API" },
      { name: "Tool calling", desc: "CRM updates, booking, DND opt-out" },
      { name: "Prompt studio", desc: "Per-agent persona & script templates" },
      { name: "Lead scoring", desc: "0–100 intent score on every call" },
    ],
  },
  {
    cat: "Telephony",
    icon: "☎️",
    tone: C.amber,
    items: [
      { name: "Asterisk ARI", desc: "Self-hosted dialer, per-campaign runner" },
      { name: "SIP trunks", desc: "Indian DIDs, TRAI-compliant windows" },
      { name: "Call recording", desc: "Retention policy per workspace" },
      { name: "DND engine", desc: "Opt-out lists & quiet-hours guardrails" },
    ],
  },
  {
    cat: "Infra & PWA",
    icon: "🐳",
    tone: C.green,
    items: [
      { name: "Docker + Nginx", desc: "Single-box deploy, SPA fallback routing" },
      { name: "Service worker", desc: "Offline shell + asset caching" },
      { name: "Manifest + icons", desc: "Installable desktop & mobile app" },
      { name: "Health probes", desc: "LLM key, STT/TTS/VAD & telephony" },
    ],
  },
];

export default function Dashboard({ health }: { health: Record<string, unknown> | null }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [range, setRange] = useState<7 | 14 | 30>(14);

  useEffect(() => {
    Promise.all([api.listCampaigns(), api.listCalls()])
      .then(([cs, cl]) => {
        setCampaigns(cs);
        setCalls(cl);
      })
      .catch(() => undefined);
  }, []);

  const demo = campaigns.length === 0 && calls.length === 0;
  const daily = useMemo<DayPoint[]>(
    () => (demo ? demoDaily(range) : buildDaily(calls, range)),
    [calls, range, demo],
  );
  const mix = useMemo(
    () => (demo ? demoMix(daily) : { outcomes: [], languages: [], campaigns: [] }),
    [demo, daily],
  );

  const outcomeData = useMemo(() => {
    if (demo) return mix.outcomes;
    const m = new Map<string, number>();
    for (const c of calls) {
      const k = c.outcome ?? c.status ?? "unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [calls, demo, mix]);

  const langData = useMemo(() => {
    if (demo) return mix.languages;
    const m = new Map<string, number>();
    for (const c of calls) m.set(c.language ?? "unknown", (m.get(c.language ?? "unknown") ?? 0) + 1);
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [calls, demo, mix]);

  const campaignLeads = useMemo(() => {
    if (demo) return mix.campaigns;
    return campaigns.slice(0, 8).map((c) => {
      const name = c.name.length > 14 ? `${c.name.slice(0, 13)}…` : c.name;
      return { name, leads: ((c.stats ?? {}) as CampaignStats).total ?? 0 };
    });
  }, [campaigns, demo, mix]);

  const leadTotal = campaigns.reduce((s, c) => s + (((c.stats ?? {}) as CampaignStats).total ?? 0), 0);
  const running = campaigns.filter((c) => c.status === "running").length;
  const connected = calls.filter((c) => c.outcome === "connected" || c.status === "connected").length;
  const scored = calls.filter((c) => c.lead_score != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, c) => s + (c.lead_score ?? 0), 0) / scored.length)
    : demo
      ? Math.round(daily.reduce((s, d) => s + d.avgScore, 0) / Math.max(1, daily.length))
      : 0;
  const hotLeads = demo
    ? Math.round(daily.reduce((s, d) => s + d.connected, 0) * 0.4)
    : calls.filter((c) => (c.lead_score ?? 0) >= 60).length;
  const connectRate = calls.length ? Math.round((connected / calls.length) * 100) : demo ? 62 : 0;
  const totalCalls = demo ? daily.reduce((s, d) => s + d.total, 0) : calls.length;

  const legendFor = (data: { name: string; value: number }[]) =>
    data.slice(0, 6).map((d, i) => ({
      name: d.name,
      value: d.value,
      color: OUTCOME_COLORS[d.name] ?? PALETTE[i % PALETTE.length],
    }));

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <div className="sub">Live analytics across campaigns, calls, languages & cost</div>
        </div>
        <div className="page-head-actions">
          {demo && <span className="demo-pill">✨ Demo data — backend offline or empty</span>}
          <Button variant="primary" onClick={() => navigate("campaigns")}>
            ＋ New campaign
          </Button>
          <Button onClick={() => navigate("voicelab")}>🎤 Voice Lab</Button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Call sessions" value={totalCalls} icon="📞" tone="indigo" sub={`last ${range} days`} />
        <StatCard label="Connect rate" value={`${connectRate}%`} icon="✅" tone="green" sub={`${connected} connected`} />
        <StatCard label="Avg lead score" value={avgScore} icon="⭐" tone="violet" sub="AI-scored intent" />
        <StatCard label="Hot leads (≥60)" value={hotLeads} icon="🔥" tone="amber" sub="ready for follow-up" />
        <StatCard label="Total leads" value={leadTotal || "—"} icon="👥" tone="cyan" sub="across campaigns" />
        <StatCard
          label="Campaigns"
          value={campaigns.length || (demo ? mix.campaigns.length : 0)}
          icon="📋"
          tone="red"
          sub={`${running} running now`}
        />
      </div>

      <Card
        title="Call volume & connections"
        action={
          <div className="range-tabs">
            {([7, 14, 30] as const).map((r) => (
              <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>
                {r}d
              </button>
            ))}
          </div>
        }
      >
        <TrendChart
          data={daily}
          xKey="day"
          series={[
            { key: "total", name: "Calls", color: C.indigo },
            { key: "connected", name: "Connected", color: C.green },
          ]}
          height={250}
        />
      </Card>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <Card title="Call outcomes">
          {outcomeData.length === 0 ? (
            <EmptyState icon="📊" title="No outcomes yet" sub="Outcome mix appears after your first calls" />
          ) : (
            <>
              <Donut
                data={outcomeData.map((d, i) => ({
                  ...d,
                  color: OUTCOME_COLORS[d.name] ?? PALETTE[i % PALETTE.length],
                }))}
                centerValue={totalCalls}
                centerLabel="total calls"
              />
              <LegendRow items={legendFor(outcomeData)} />
            </>
          )}
        </Card>
        <Card title="Average lead score trend">
          <LineTrend data={daily} xKey="day" yKey="avgScore" name="Avg score" color={C.violet} height={248} />
        </Card>
      </div>
      <div className="grid-2" style={{ marginTop: 18 }}>
        <Card title="Calls by language">
          {langData.length === 0 ? (
            <EmptyState icon="🌐" title="No language data" sub="Pick a language in Voice Lab to see this" />
          ) : (
            <ColumnsChart
              data={langData.slice(0, 7)}
              xKey="name"
              yKey="value"
              name="Calls"
              colors={PALETTE}
              height={230}
            />
          )}
        </Card>
        <Card title="Leads per campaign">
          {campaignLeads.length === 0 ? (
            <EmptyState icon="📋" title="No campaigns yet" sub="Create one to light this up" />
          ) : (
            <ColumnsChart
              data={campaignLeads}
              xKey="name"
              yKey="leads"
              name="Leads"
              colors={[C.cyan, C.indigo, C.violet, C.green, C.amber, C.pink, "#22d3ee", "#84cc16"]}
              height={230}
            />
          )}
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
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
                const done = (by.completed ?? 0) + (by.failed ?? 0) + (by.dnd ?? 0) + (by.skipped ?? 0);
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
          {calls.length === 0 ? (
            <EmptyState icon="📞" title="No calls yet" sub="Run a campaign or talk in the Voice Lab" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {calls.slice(0, 5).map((c) => (
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
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>score {c.lead_score}</span>
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
      <Card title="Tech stack — what powers every pixel and phone call" style={{ marginTop: 18 }}>
        <div className="tech-grid">
          {TECH_STACK.map((g) => (
            <div className="tech-card" key={g.cat} style={{ ["--tc" as string]: g.tone }}>
              <div className="tech-head">
                <span className="tech-ic">{g.icon}</span>
                <b>{g.cat}</b>
              </div>
              <ul className="tech-items">
                {g.items.map((it) => (
                  <li key={it.name}>
                    <b>{it.name}</b>
                    <span>{it.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
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