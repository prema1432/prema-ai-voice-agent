import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Button, Card } from "../components";

interface Msg {
  role: "user" | "bot";
  text: string;
  at: string;
}

const SUGGESTIONS = [
  "Draft a follow-up message for interested leads",
  "Write a Hinglish call script for an insurance agent",
  "Summarise what makes a good AI voice campaign",
  "Create a WhatsApp reminder template for appointments",
];

export default function AiChat() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "bot",
      text: "Hey! I'm Prema Copilot — I draft scripts, templates and follow-ups for your voice campaigns using your configured OpenRouter model. What do you need?",
      at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [model, setModel] = useState("…");
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.llmStatus().then((s) => setModel(s.model)).catch(() => {});
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [msgs]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const userMsg: Msg = { role: "user", text: q, at: new Date().toISOString() };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.testLlm();
      const reply = res.ok
        ? res.reply ?? "Got a response, but it came back empty."
        : `The model said: ${res.error ?? "unknown error"}`;
      setLatency(res.latency_ms);
      setMsgs((m) => [...m, { role: "bot", text: reply, at: new Date().toISOString() }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "bot", text: `❌ ${String(e).slice(0, 200)}`, at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>💬 AI Chat Bot</h2>
          <div className="sub">Draft scripts, templates and follow-ups with your LLM — no prompt bookkeeping</div>
        </div>
        <div className="page-head-actions">
          <Button variant="ghost" onClick={() => setMsgs([msgs[0]])}>↺ Clear chat</Button>
        </div>
      </div>

      <Card className="chat-card">
        <div className="chat-bar">
          <span className="chat-online" /> Copilot
          <span className="chat-model">{model}</span>
        </div>
        <div className="chat-scroll" ref={boxRef}>
          {msgs.map((m, i) => (
            <div className={`chat-msg ${m.role}`} key={i}>
              <span className="chat-av">{m.role === "bot" ? "🤖" : "👤"}</span>
              <div>
                <div className="chat-bubble">{m.text}</div>
                <small>{new Date(m.at).toLocaleTimeString()}</small>
              </div>
            </div>
          ))}
          {busy && (
            <div className="chat-msg bot">
              <span className="chat-av">🤖</span>
              <div className="chat-dots"><i /><i /><i /></div>
            </div>
          )}
        </div>
        {msgs.length === 1 && !busy && (
          <div className="chat-sug">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        <div className="chat-input">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask Copilot to write a script, template or message…"
            disabled={busy}
          />
          <Button variant="primary" onClick={() => send(input)} disabled={busy || !input.trim()}>
            Send ⏎
          </Button>
        </div>
        {latency !== null && (
          <div className="chat-foot">Last call: {latency} ms · via {model}</div>
        )}
      </Card>
    </div>
  );
}