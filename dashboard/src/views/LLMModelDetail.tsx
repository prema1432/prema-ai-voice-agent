import { useEffect, useMemo, useState } from "react";
import { LlmModel, LlmUsage, api } from "../api";
import { Badge, Button, Card, EmptyState, StatCard } from "../components";

const fmtCtx = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : n ? String(n) : "—";

const fmtPrice = (v: number | null | undefined) =>
  v == null ? "—" : v === 0 ? "free" : `$${v < 0.01 ? v.toFixed(3) : v.toFixed(2)}/1M`;

const fmtTok = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const fmtCost = (n: number) => (n > 0 ? `$${n.toFixed(5)}` : "free");

export default function LLMModelDetail({ id }: { id: string }) {
  const [model, setModel] = useState<LlmModel | null>(null);
  const [usage, setUsage] = useState<LlmUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testRes, setTestRes] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.llmModelDetail(id).then(setModel).catch((e) => setErr(String(e)));
    api.llmUsage(30).then(setUsage).catch(() => {});
  }, [id]);

  const stats = useMemo(() => {
    const agg = usage?.per_model.find((m) => m._id === id);
    const recent = (usage?.recent ?? []).filter((r) => r.model === id).slice(0, 8);
    return { agg, recent };
  }, [usage, id]);

  async function setDefault() {
    if (!model || busy) return;
    setBusy(true);
    try {
      await api.setLlmModel(model.id);
      setModel((m) => (m ? { ...m, is_default: true } : m));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!model || busy) return;
    setBusy(true);
    setTestRes({ ok: true, text: "Testing…" });
    try {
      const r = await api.testLlm(model.id);
      setTestRes(
        r.ok
          ? { ok: true, text: `“${(r.reply ?? "OK").slice(0, 120)}” · ${r.latency_ms} ms · ${r.usage?.prompt_tokens ?? 0}→${r.usage?.completion_tokens ?? 0} tok` }
          : { ok: false, text: `${r.error ?? "failed"} (${r.latency_ms} ms)` },
      );
    } catch (e) {
      setTestRes({ ok: false, text: String(e) });
    } finally {
      setBusy(false);
    }
  }

  if (err && !model) {
    return (
      <div>
        <div className="page-head">
          <h2>🧠 Model detail</h2>
        </div>
        <Card>
          <EmptyState icon="⚠️" title="Couldn't load model" sub={err} />
          <div style={{ marginTop: 8 }}>
            <Button size="sm" onClick={() => (location.hash = "#/llm/models")}>← Back to models</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!model) {
    return (
      <Card>
        <EmptyState icon="🧠" title="Loading model…" />
      </Card>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🧠 {model.name === model.id ? model.id : model.name}</h2>
          <div className="sub" style={{ wordBreak: "break-all" }}>{model.id}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button size="sm" variant="ghost" onClick={() => (location.hash = "#/llm/models")}>
            ← Models
          </Button>
          <Button size="sm" variant="ghost" onClick={() => (location.hash = "#/llm")}>
            LLM &amp; Cost
          </Button>
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      <Card style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>Model info</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {model.is_default && <Badge tone="violet">⭐ default</Badge>}
            {model.free ? <Badge tone="green">🆓 free</Badge> : <Badge tone="amber">paid</Badge>}
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          <StatCard label="Context window" value={fmtCtx(model.context_length)} icon="🧾" tone="indigo" />
          <StatCard label="Input / 1M" value={fmtPrice(model.pricing.prompt)} icon="⬇️" tone="cyan" />
          <StatCard label="Output / 1M" value={fmtPrice(model.pricing.completion)} icon="⬆️" tone="violet" />
          <StatCard label="Request / 1M" value={fmtPrice(model.pricing.request)} icon="📡" tone="green" />
        </div>

        {model.description && (
          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--text)",
              background: "var(--well)",
              padding: "12px 14px",
              borderRadius: 10,
              maxHeight: 220,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {model.description}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Button variant="primary" size="sm" disabled={model.is_default || busy} onClick={setDefault}>
            {model.is_default ? "✓ Already the default" : busy ? "Saving…" : "⭐ Set as default model"}
          </Button>
          <Button variant="default" size="sm" disabled={busy} onClick={test}>
            {busy && testRes?.text === "Testing…" ? <span className="spinner" style={{ width: 13, height: 13 }} /> : "⚡ Test model"}
          </Button>
        </div>

        {testRes && (
          <div className={`msg ${testRes.ok ? "ok" : "err"}`} style={{ marginTop: 12 }}>
            {testRes.text}
          </div>
        )}
      </Card>

      {stats.agg ? (
        <Card title={<span>📊 Usage in the last 30 days</span>} style={{ marginBottom: 16 }}>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <StatCard label="Calls" value={stats.agg.calls} icon="📡" tone="indigo" />
            <StatCard label="Input tokens" value={fmtTok(stats.agg.prompt_tokens)} icon="⬇️" tone="cyan" />
            <StatCard label="Output tokens" value={fmtTok(stats.agg.completion_tokens)} icon="⬆️" tone="violet" />
            <StatCard label="Cost" value={fmtCost(stats.agg.cost)} icon="💰" tone="green" />
          </div>
        </Card>
      ) : (
        <Card title={<span>📊 Usage</span>} style={{ marginBottom: 16 }}>
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No LLM calls logged for this model yet.
          </div>
        </Card>
      )}

      <Card title={<span>🕘 Recent calls with this model</span>}>
        {stats.recent.length === 0 ? (
          <EmptyState icon="🗒" title="Nothing logged yet" sub="Once an agent or test uses this model, calls appear here." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Purpose</th>
                  <th style={{ textAlign: "right" }}>In → Out</th>
                  <th style={{ textAlign: "right" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {new Date(r.ts).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{r.purpose}</td>
                    <td style={{ textAlign: "right" }} className="num">
                      {fmtTok(r.prompt_tokens)} → {fmtTok(r.completion_tokens)}
                    </td>
                    <td style={{ textAlign: "right" }} className="num">
                      {r.free ? <Badge tone="green">free</Badge> : fmtCost(r.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}