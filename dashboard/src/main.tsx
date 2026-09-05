import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { parseRoute } from "./router";
import Dashboard from "./views/Dashboard";
import Campaigns from "./views/Campaigns";
import CampaignDetail from "./views/CampaignDetail";
import VoiceLab from "./views/VoiceLab";
import CallsView from "./views/Calls";
import CallDetail from "./views/CallDetail";
import "./styles.css";

function useRoute(): ReturnType<typeof parseRoute> {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return parseRoute(hash);
}

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "📊", path: "" },
  { key: "campaigns", label: "Campaigns", icon: "📋", path: "campaigns" },
  { key: "voicelab", label: "Voice Lab", icon: "🎤", path: "voicelab" },
  { key: "calls", label: "Call Logs", icon: "📞", path: "calls" },
] as const;

function isActive(routeName: string, key: string): boolean {
  if (key === "campaigns") return routeName === "campaigns" || routeName === "campaign-detail";
  if (key === "calls") return routeName === "calls" || routeName === "call-detail";
  return routeName === key;
}

function App() {
  const route = useRoute();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ping = () => api.health().then(setHealth).catch((e) => setErr(String(e)));
    ping();
    const t = setInterval(ping, 8000);
    return () => clearInterval(t);
  }, []);

  const llmKeySet = health?.llm_key_set === true;
  const backendUp = !err && health != null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="mark">🎙️</div>
          <div>
            <div className="name">Freebuff Voice</div>
            <div className="tag">AI Call Agents</div>
          </div>
        </div>

        {NAV.map((n) => (
          <button
            key={n.key}
            className={`nav-item ${isActive(route.name, n.key) ? "active" : ""}`}
            onClick={() => {
              location.hash = `#/${n.path}`;
            }}
          >
            <span className="ic">{n.icon}</span>
            {n.label}
          </button>
        ))}

        <div className="sidebar-foot">
          <span className="pill">
            <span className={`dot ${llmKeySet ? "green" : "amber"}`} />
            LLM key {llmKeySet ? "set" : "missing"}
          </span>
          <span className="pill">
            <span className={`dot ${backendUp ? "green" : "red"}`} />
            backend {backendUp ? "online" : "unreachable"}
          </span>
          {backendUp && (
            <span className="pill">
              <span className="dot blue" />
              {String(health?.telephony ?? "unknown")}
            </span>
          )}
        </div>
      </aside>

      <main className="main">
        {route.name === "dashboard" && <Dashboard health={health} />}
        {route.name === "campaigns" && <Campaigns />}
        {route.name === "campaign-detail" && <CampaignDetail id={route.id} />}
        {route.name === "voicelab" && <VoiceLab />}
        {route.name === "calls" && <CallsView />}
        {route.name === "call-detail" && <CallDetail id={route.id} />}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);