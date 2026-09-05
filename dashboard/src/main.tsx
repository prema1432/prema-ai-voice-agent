import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import Campaigns from "./views/Campaigns";
import VoiceLab from "./views/VoiceLab";
import CallsView from "./views/Calls";

type Tab = "campaigns" | "voicelab" | "calls";

function App() {
  const [tab, setTab] = useState<Tab>("campaigns");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch((e) => setErr(String(e)));
  }, []);

  const llmKeySet = health?.llm_key_set === true;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>🎙️ Freebuff Voice</h1>
        <span style={{ color: "#666", fontSize: 13 }}>
          Self-hosted AI call agents · Indian languages · OpenRouter LLM
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12, display: "flex", gap: 12 }}>
          {health ? (
            <>
              <span style={{ color: llmKeySet ? "green" : "#c60" }}>
                ● LLM key {llmKeySet ? "set" : "missing — set OPENROUTER_API_KEY in .env"}
              </span>
              <span style={{ color: "green" }}>
                ● backend: {String(health.telephony ?? "unknown")}
              </span>
            </>
          ) : (
            <span style={{ color: err ? "red" : "#999" }}>
              {err ? "● backend unreachable" : "● connecting…"}
            </span>
          )}
        </span>
      </header>

      <nav style={{ display: "flex", gap: 8, margin: "16px 0", borderBottom: "1px solid #e2e2e2" }}>
        {(
          [
            ["campaigns", "📋 Campaigns & Leads"],
            ["voicelab", "🎤 Voice Lab (talk to an agent)"],
            ["calls", "📞 Call Logs"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 14px",
              border: "none",
              background: tab === key ? "#111" : "transparent",
              color: tab === key ? "#fff" : "#333",
              borderRadius: "8px 8px 0 0",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "campaigns" && <Campaigns />}
      {tab === "voicelab" && <VoiceLab />}
      {tab === "calls" && <CallsView />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
