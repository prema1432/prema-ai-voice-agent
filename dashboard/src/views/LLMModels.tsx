import { useEffect, useMemo, useState } from "react";
import { LlmCatalog, LlmModel, LlmUsage, api } from "../api";
import { Badge, Button, Card, EmptyState } from "../components";
import ViewToggle, { useView } from "../components/ViewToggle";
import { navigate } from "../router";

const fmtCtx = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : n ? String(n) : "—";

const fmtPrice = (v: number | null | undefined) =>
  v == null ? "—" : v === 0 ? "free" : `$${v < 0.01 ? v.toFixed(3) : v.toFixed(2)}/1M`;

const shortDesc = (s: string, n = 150) =>
  s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;

type Filter = "all" | "free" | "paid";
type Sort = "default" | "context" | "prompt" | "name";

export default function LLMModels() {
  const [cat, setCat] = useState<LlmCatalog | null>(null);
  const [usage, setUsage] = useState<LlmUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("default");
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [view, setView] = useView("llm-models");

  const load = () => {
    api.llmModels().then(setCat).catch((e) => setErr(String(e)));
    api.llmUsage(30).then(setUsage).catch(() => {});
  };
  useEffect(load, []);

  const perModel = useMemo(() => {
    const map = new Map<string, { calls: number; cost: number }>();
    for (const m of usage?.per_model ?? []) {
      map.set(m._id, { calls: m.calls, cost: m.cost });
    }
    return map;
  }, [usage]);

  const models = useMemo(() => {
    let list = [...(cat?.models ?? [])];
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (m) =>
          m.id.toLowerCase().includes(term) ||
          m.name.toLowerCase().includes(term) ||
          m.description.toLowerCase().includes(term),
      );
    }
    if (filter === "free") list = list.filter((m) => m.free);
    if (filter === "paid") list = list.filter((m) => !m.free);
    switch (sort) {
      case "context":
        list.sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0));
        break;
      case "prompt":
        list.sort((a, b) => (a.pricing.prompt ?? Infinity) - (b.pricing.prompt ?? Infinity));
        break;
      case "name":
        list.sort((a, b) => a.id.localeCompare(b.id));
        break;
      default:
        break; // backend already put the default first; keep order
    }
    return list;
  }, [cat, q, filter, sort]);

  async function setDefault(m: LlmModel) {
    if (busy) return;
    setBusy(m.id);
    setErr(null);
    try {
      const r = await api.setLlmModel(m.id);
      setCat((c) => (c ? { ...c, default: r.model } : c));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function test(m: LlmModel) {
    if (testing) return;
    setTesting(m.id);
    setResults((r) => ({ ...r, [m.id]: "Testing…" }));
    try {
      const r = await api.testLlm(m.id);
      setResults((res) => ({
        ...res,
        [m.id]: r.ok
          ? `✓ “${(r.reply ?? "OK").slice(0, 60)}” · ${r.latency_ms} ms · ${r.usage?.prompt_tokens ?? 0}→${r.usage?.completion_tokens ?? 0} tok`
          : `✗ ${(r.error ?? "failed").slice(0, 90)} (${r.latency_ms} ms)`,
      }));
    } catch (e) {
      setResults((res) => ({ ...res, [m.id]: `✗ ${String(e).slice(0, 90)}` }));
    } finally {
      setTesting(null);
    }
  }

  const defaultId = cat?.default;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>📚 LLM Models</h2>
          <div className="sub">
            Dynamic OpenRouter catalog · {cat?.models.length ?? "…"} models · set any model as the default
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button size="sm" variant="default" onClick={load}>⟳ Refresh</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("llm")}>
            ← LLM &amp; Cost
          </Button>
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      {/* Default model banner */}
      <Card style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>⚙️ Default model</h3>
          <Badge tone="violet">every new conversation starts here</Badge>
        </div>
        {defaultId ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 750, wordBreak: "break-all" }}>{defaultId}</span>
            <Badge tone="green">● active</Badge>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Change it below with “Set default” — the sidebar picker switches it live too.
            </span>
          </div>
        ) : (
          <EmptyState icon="🧠" title="Catalog loading…" />
        )}
      </Card>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <input
          className="input"
          style={{ flex: "1 1 240px", minWidth: 200 }}
          placeholder="🔎 Search model id, name or description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chips">
          {(["all", "free", "paid"] as Filter[]).map((f) => (
            <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "free" ? "🆓 Free" : "💳 Paid"}
            </button>
          ))}
        </div>
        <select
          className="select"
          style={{ width: "auto" }}
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          title="Sort"
        >
          <option value="default">Sort: default first</option>
          <option value="context">Sort: context size</option>
          <option value="prompt">Sort: price ↑</option>
          <option value="name">Sort: name</option>
        </select>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {models.length === 0 ? (
        <Card>
          <EmptyState icon="🔍" title="No models match" sub="Try clearing the search or switching the filter." />
        </Card>
      ) : view === "rows" ? (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th style={{ textAlign: "right" }}>Context</th>
                <th style={{ textAlign: "right" }}>In /1M</th>
                <th style={{ textAlign: "right" }}>Out /1M</th>
                <th style={{ textAlign: "right" }}>Calls (30d)</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const stats = perModel.get(m.id);
                const isDef = m.id === defaultId;
                return (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        {isDef && <Badge tone="violet">default</Badge>}
                        {m.free ? <Badge tone="green">🆓</Badge> : <Badge tone="amber">paid</Badge>}
                        <button className="link" style={{ fontWeight: 650, fontSize: 13, textAlign: "left" }} onClick={() => navigate(`llm/model/${encodeURIComponent(m.id)}`)}>
                          {m.id}
                        </button>
                      </div>
                      {m.name && m.name !== m.id && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.name}</div>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }} className="num">{fmtCtx(m.context_length)}</td>
                    <td style={{ textAlign: "right" }} className="num">{fmtPrice(m.pricing.prompt)}</td>
                    <td style={{ textAlign: "right" }} className="num">{fmtPrice(m.pricing.completion)}</td>
                    <td style={{ textAlign: "right" }} className="num">{stats?.calls ?? 0}{stats?.cost && stats.cost > 0 ? ` · $${stats.cost.toFixed(3)}` : ""}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Button size="sm" variant={isDef ? "default" : "primary"} disabled={isDef || busy === m.id} onClick={() => setDefault(m)}>
                        {isDef ? "✓ Default" : "Set default"}
                      </Button>{" "}
                      <Button size="sm" variant="ghost" disabled={testing === m.id} onClick={() => test(m)} title="Test model">
                        {testing === m.id ? <span className="spinner" style={{ width: 13, height: 13 }} /> : "⚡"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 14,
          }}
        >
          {models.map((m) => {
            const stats = perModel.get(m.id);
            const isDef = m.id === defaultId;
            return (
              <Card key={m.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 750,
                        fontSize: 14.5,
                        wordBreak: "break-all",
                        cursor: "pointer",
                        color: "var(--accent-1)",
                      }}
                      onClick={() => navigate(`llm/model/${encodeURIComponent(m.id)}`)}
                      title={`Open ${m.id} detail`}
                    >
                      {m.id}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {m.name === m.id ? "—" : m.name}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {isDef && <Badge tone="violet">default</Badge>}
                    {m.free ? <Badge tone="green">🆓 free</Badge> : <Badge tone="amber">paid</Badge>}
                  </div>
                </div>

                {m.description && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {shortDesc(m.description)}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div className="lbl">Context</div>
                    <b>{fmtCtx(m.context_length)}</b>
                  </div>
                  <div>
                    <div className="lbl">In</div>
                    <b className={m.pricing.prompt === 0 ? "text-green" : ""}>
                      {fmtPrice(m.pricing.prompt)}
                    </b>
                  </div>
                  <div>
                    <div className="lbl">Out</div>
                    <b className={m.pricing.completion === 0 ? "text-green" : ""}>
                      {fmtPrice(m.pricing.completion)}
                    </b>
                  </div>
                </div>

                {stats && (
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    📊 last 30d: <b>{stats.calls}</b> calls
                    {stats.cost > 0 ? ` · $${stats.cost.toFixed(4)}` : " · free"}
                  </div>
                )}

                {results[m.id] && (
                  <div
                    className={`msg ${results[m.id].startsWith("✓") ? "ok" : "err"}`}
                    style={{ fontSize: 11.5, padding: "7px 9px" }}
                  >
                    {results[m.id]}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <Button
                    size="sm"
                    variant={isDef ? "default" : "primary"}
                    disabled={isDef || busy === m.id}
                    onClick={() => setDefault(m)}
                    style={{ flex: 1 }}
                  >
                    {isDef ? "✓ Default" : busy === m.id ? "Saving…" : "Set default"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={testing === m.id}
                    onClick={() => test(m)}
                    style={{ flex: 1 }}
                  >
                    {testing === m.id ? <span className="spinner" style={{ width: 13, height: 13 }} /> : "⚡ Test"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-faint)", marginTop: 16 }}>
        {cat?.models.length ?? 0} models · pricing shown per 1M tokens · catalog refreshes from OpenRouter every 10 min
      </div>
    </div>
  );
}