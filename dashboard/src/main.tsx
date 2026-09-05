import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { NotificationBell } from "./components/NotificationBell";
import { parseRoute } from "./router";
import { getTheme, initTheme, toggleTheme, Theme } from "./theme";
import Dashboard from "./views/Dashboard";
import Campaigns from "./views/Campaigns";
import CampaignDetail from "./views/CampaignDetail";
import Agents from "./views/Agents";
import LlmPage from "./views/LLM";
import VoiceLab from "./views/VoiceLab";
import CallsView from "./views/Calls";
import CallDetail from "./views/CallDetail";
import Crm from "./views/Crm";
import Notifications from "./views/Notifications";
import Integrations from "./views/Integrations";
import AuditLogs from "./views/AuditLogs";
import "./styles.css";
import "./platform.css";

initTheme();

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
  { key: "crm", label: "CRM Board", icon: "🗂", path: "crm" },
  { key: "agents", label: "Agents", icon: "🤖", path: "agents" },
  { key: "voicelab", label: "Voice Lab", icon: "🎤", path: "voicelab" },
  { key: "calls", label: "Call Logs", icon: "📞", path: "calls" },
  { key: "llm", label: "LLM & Cost", icon: "🧠", path: "llm" },
  { key: "integrations", label: "Integrations", icon: "🔌", path: "integrations" },
  { key: "audit", label: "Audit Logs", icon: "🧾", path: "audit" },
] as const;

function isActive(routeName: string, key: string): boolean {
  if (key === "campaigns") return routeName === "campaigns" || routeName === "campaign-detail";
  if (key === "calls") return routeName === "calls" || routeName === "call-detail";
  if (key === "voicelab") return routeName === "voicelab";
  if (key === "crm") return routeName === "crm";
  return routeName === key;
}

function App() {
  const route = useRoute();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getTheme());

  useEffect(() => {
    const ping = () => api.health().then(setHealth).catch((e) => setErr(String(e)));
    ping();
    const t = setInterval(ping, 8000);
    return () => clearInterval(t);
  }, []);

  const llmKeySet = health?.llm_key_set === true;
  const backendUp = !err && health != null;
  const changeTheme = () => setTheme(toggleTheme());

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="mark">🎙️</div>
          <div>
            <div className="name">Prema AI<br />Voice Agent</div>
            <div className="tag">Voice CRM</div>
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
          <NotificationBell />
          <button className="theme-toggle" data-on={theme} onClick={changeTheme}>
            <span>{theme === "light" ? "☀️ Light" : "🌙 Dark"}</span>
            <span className="sw" />
          </button>
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
        <div key={route.name + ("id" in route ? route.id : "") + ("campaignId" in route ? route.campaignId ?? "" : "") + ("agentId" in route ? route.agentId ?? "" : "")} className="fade-up">
          {route.name === "dashboard" && <Dashboard health={health} />}
          {route.name === "campaigns" && <Campaigns />}
          {route.name === "campaign-detail" && <CampaignDetail id={route.id} />}
          {route.name === "agents" && <Agents />}
          {route.name === "llm" && <LlmPage />}
          {route.name === "voicelab" && <VoiceLab presetAgentId={route.agentId} />}
          {route.name === "calls" && <CallsView />}
          {route.name === "call-detail" && <CallDetail id={route.id} />}
          {route.name === "crm" && <Crm campaignId={route.campaignId} />}
          {route.name === "notifications" && <Notifications />}
          {route.name === "integrations" && <Integrations />}
          {route.name === "audit" && <AuditLogs />}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
