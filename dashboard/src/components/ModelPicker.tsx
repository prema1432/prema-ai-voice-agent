import { useEffect, useState } from "react";
import { LlmModel, api } from "../api";
import { navigate } from "../router";

const shortId = (m: string) => (m.length > 34 ? `${m.slice(0, 31)}…` : m);

/**
 * Sidebar control: dynamically switch the OpenRouter chat model from the live
 * free-model catalog and run a quick latency test against it.
 */
export default function ModelPicker() {
  const [models, setModels] = useState<LlmModel[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api
      .llmModels()
      .then((r) => {
        setModels(r.models);
        setCurrent(r.default ?? r.current ?? null);
      })
      .catch(() => {});
  }, []);

  async function apply(m: LlmModel) {
    if (!m.id || m.id === current) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.setLlmModel(m.id);
      setCurrent(r.model);
      setMsg({ ok: true, text: `✓ Default model → ${r.model}` });
      setOpen(false);
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 140) });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!current) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.testLlm(current);
      setMsg(
        r.ok
          ? {
              ok: true,
              text: `✓ ${(r.reply ?? "OK").slice(0, 70)} · ${r.latency_ms} ms · ${r.usage?.prompt_tokens ?? 0}→${r.usage?.completion_tokens ?? 0} tok`,
            }
          : { ok: false, text: `✗ ${(r.error ?? "failed").slice(0, 150)}` },
      );
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 140) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="model-picker">
      <button
        className="mp-head"
        onClick={() => setOpen((o) => !o)}
        title={current ?? "model not loaded"}
      >
        <span className="mp-label">🧠 LLM model</span>
        <span className="mp-cur">{current ? shortId(current) : "loading…"}</span>
        <span className={`mp-caret ${open ? "up" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="mp-list">
          <div className="mp-list-label">Free models — switch live</div>
          {models.map((m) => (
            <button
              key={m.id}
              className={`mp-opt ${m.id === current ? "on" : ""}`}
              onClick={() => apply(m)}
              title={m.id}
            >
              <span>{shortId(m.id)}</span>
              {m.free && <em className="mp-free">free</em>}
              {m.id === current && <b>●</b>}
            </button>
          ))}
          {models.length === 0 && (
            <div className="mp-empty">Catalog unavailable — check backend.</div>
          )}
          <button
            className="mp-manage"
            onClick={() => {
              setOpen(false);
              navigate("llm/models");
            }}
          >
            📚 Browse all models →
          </button>
        </div>
      )}

      <div className="mp-actions">
        <button className="mp-test" disabled={busy || !current} onClick={test}>
          {busy ? <span className="spinner" style={{ width: 12, height: 12 }} /> : "⚡ Test model"}
        </button>
      </div>

      {msg && (
        <div className={`msg ${msg.ok ? "ok" : "err"}`} style={{ fontSize: 10.5, padding: "6px 8px", marginTop: 6 }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
