import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { NotificationBell } from "./components/NotificationBell";
import ModelPicker from "./components/ModelPicker";
import { navigate, parseRoute } from "./router";
import { applyRouteSeo } from "./seo";
import { getTheme, initTheme, toggleTheme, Theme } from "./theme";
import Dashboard from "./views/Dashboard";
import Campaigns from "./views/Campaigns";
import CampaignDetail from "./views/CampaignDetail";
import Agents from "./views/Agents";
import LlmPage from "./views/LLM";
import LLMModels from "./views/LLMModels";
import LLMModelDetail from "./views/LLMModelDetail";
import VoiceLab from "./views/VoiceLab";
import CallsView from "./views/Calls";
import CallDetail from "./views/CallDetail";
import Crm from "./views/Crm";
import Notifications from "./views/Notifications";
import Integrations from "./views/Integrations";
import AuditLogs from "./views/AuditLogs";
import Forms from "./views/Forms";
import FormBuilder from "./views/FormBuilder";
import FormSubmissions from "./views/FormSubmissions";
import PublicForm from "./views/PublicForm";
import "./styles.css";
import "./platform.css";

initTheme();

function useRoute(): ReturnType<typeof parseRoute> {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return parseRoute(path);
}

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "📊", path: "" },
  { key: "campaigns", label: "Campaigns", icon: "📋", path: "campaigns" },
  { key: "forms", label: "Forms", icon: "📝", path: "forms" },
  { key: "crm", label: "CRM Board", icon: "🗂", path: "crm" },
  { key: "agents", label: "Agents", icon: "🤖", path: "agents" },
  { key: "voicelab", label: "Voice Lab", icon: "🎤", path: "voicelab" },
  { key: "calls", label: "Call Logs", icon: "📞", path: "calls" },
  { key: "llm", label: "LLM & Cost", icon: "🧠", path: "llm" },
  { key: "llm-models", label: "LLM Models", icon: "📚", path: "llm/models" },
  { key: "integrations", label: "Integrations", icon: "🔌", path: "integrations" },
  { key: "notifications", label: "Notifications", icon: "🔔", path: "notifications" },
  { key: "audit", label: "Audit Logs", icon: "🧾", path: "audit" },
] as const;

const FOOT_LINKS: { label: string; path: string }[] = [
  { label: "Dashboard", path: "" },
  { label: "Campaigns", path: "campaigns" },
  { label: "Forms", path: "forms" },
  { label: "CRM Pipeline", path: "crm" },
  { label: "Voice Lab", path: "voicelab" },
  { label: "Agents", path: "agents" },
  { label: "Call Logs", path: "calls" },
  { label: "LLM & Cost", path: "llm" },
  { label: "LLM Models", path: "llm/models" },
  { label: "Integrations", path: "integrations" },
  { label: "Notifications", path: "notifications" },
  { label: "Audit Logs", path: "audit" },
];

function isActive(routeName: string, key: string): boolean {
  if (key === "campaigns") return routeName === "campaigns" || routeName === "campaign-detail";
  if (key === "calls") return routeName === "calls" || routeName === "call-detail";
  if (key === "voicelab") return routeName === "voicelab";
  if (key === "crm") return routeName === "crm";
  if (key === "forms") return routeName === "forms" || routeName === "form-builder" || routeName === "form-submissions";
  if (key === "llm") return routeName === "llm" || routeName === "llm-models" || routeName === "llm-model";
  if (key === "llm-models") return routeName === "llm-models" || routeName === "llm-model";
  return routeName === key;
}

function App() {
  const route = useRoute();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getTheme());
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem("prema.sidebar.collapsed") === "1",
  );
  useEffect(() => {
    localStorage.setItem("prema.sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const ping = () => api.health().then(setHealth).catch((e) => setErr(String(e)));
    ping();
    const t = setInterval(ping, 8000);
    return () => clearInterval(t);
  }, []);

  // Per-route SEO: title, description, OG tags (views enrich with live data).
  // Keyed on a stable route string so periodic re-renders (health pings) don't
  // clobber the richer title a view sets after its data loads.
  const routeKey =
    route.name +
    ("id" in route ? `:${route.id}` : "") +
    ("campaignId" in route ? `:${route.campaignId ?? ""}` : "") +
    ("agentId" in route ? `:${route.agentId ?? ""}` : "") +
    ("slug" in route ? `:${route.slug}` : "");
  useEffect(() => {
    applyRouteSeo(route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const llmKeySet = health?.llm_key_set === true;
  const backendUp = !err && health != null;
  const changeTheme = () => setTheme(toggleTheme());

  // Public share link: standalone page without the dashboard shell.
  if (route.name === "form-public") {
    return <PublicForm slug={route.slug} />;
  }

  return (
    <div className={`app-shell ${collapsed ? "sidebar-min" : ""}`}>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-logo">
          <div className="mark">🎙️</div>
          <div className="brand">
            <div className="name">Prema AI<br />Voice Agent</div>
            <div className="tag">Voice CRM</div>
          </div>
          <button
            className="side-toggle"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar to icons"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {NAV.map((n) => (
          <button
            key={n.key}
            className={`nav-item ${isActive(route.name, n.key) ? "active" : ""}`}
            onClick={() => navigate(n.path)}
          >
            <span className="ic">{n.icon}</span>
            <span className="lbl">{n.label}</span>
          </button>
        ))}

        <ModelPicker />

        <div className="sidebar-foot">
          <NotificationBell />
          <button className="theme-toggle" data-on={theme} onClick={changeTheme} title="Toggle theme">
            <span className="theme-group">
              <span className="theme-ic">{theme === "light" ? "☀️" : "🌙"}</span>
              <span className="lbl">{theme === "light" ? "Light" : "Dark"}</span>
            </span>
            <span className="sw" />
          </button>
          <span className="pill">
            <span className={`dot ${llmKeySet ? "green" : "amber"}`} />
            <span className="lbl">LLM key {llmKeySet ? "set" : "missing"}</span>
          </span>
          <span className="pill">
            <span className={`dot ${backendUp ? "green" : "red"}`} />
            <span className="lbl">backend {backendUp ? "online" : "unreachable"}</span>
          </span>
          {backendUp && (
            <span className="pill">
              <span className="dot blue" />
              <span className="lbl">{String(health?.telephony ?? "unknown")}</span>
            </span>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-brand" onClick={() => navigate("")}>
            <span className="mark">🎙️</span>
            <span>
              <b>Prema AI</b> <em>Voice Agent</em>
            </span>
          </div>
          <nav className="topbar-links">
            <button onClick={() => navigate("notifications")}>🔔 Notifications</button>
            <button onClick={() => navigate("audit")}>🧾 Audit Logs</button>
            <button onClick={() => navigate("integrations")}>🔌 Integrations</button>
            <button onClick={() => navigate("llm")}>🧠 LLM & Cost</button>
            <button onClick={() => navigate("crm")}>🗂 CRM Pipeline</button>
          </nav>
          <div className="topbar-status">
            {health ? (
              <>
                <span className="pill">
                  <span className={`dot ${llmKeySet ? "green" : "amber"}`} />
                  LLM {llmKeySet ? "ready" : "no key"}
                </span>
                <span className="pill">
                  <span className={`dot ${backendUp ? "green" : "red"}`} />
                  {backendUp ? "online" : "offline"}
                </span>
              </>
            ) : (
              <span className="pill">
                <span className="dot red" /> connecting…
              </span>
            )}
          </div>
        </header>

        <div
          key={route.name + ("id" in route ? route.id : "") + ("campaignId" in route ? route.campaignId ?? "" : "") + ("agentId" in route ? route.agentId ?? "" : "")}
          className="page-wrap fade-up"
        >
          {route.name === "dashboard" && <Dashboard health={health} />}
          {route.name === "campaigns" && <Campaigns />}
          {route.name === "campaign-detail" && <CampaignDetail id={route.id} />}
          {route.name === "forms" && <Forms />}
          {route.name === "form-builder" && <FormBuilder id={route.id} />}
          {route.name === "form-submissions" && <FormSubmissions id={route.id} />}
          {route.name === "agents" && <Agents />}
          {route.name === "llm" && <LlmPage />}
          {route.name === "llm-models" && <LLMModels />}
          {route.name === "llm-model" && <LLMModelDetail id={route.id} />}
          {route.name === "voicelab" && <VoiceLab presetAgentId={route.agentId} />}
          {route.name === "calls" && <CallsView />}
          {route.name === "call-detail" && <CallDetail id={route.id} />}
          {route.name === "crm" && <Crm campaignId={route.campaignId} />}
          {route.name === "notifications" && <Notifications />}
          {route.name === "integrations" && <Integrations />}
          {route.name === "audit" && <AuditLogs />}
        </div>

        <footer className="footer">
          <div>
            <b>🎙️ Prema AI Voice Agent</b>
            <span>Self-hosted AI calling for Indian numbers &amp; regional languages · OpenRouter LLM · MongoDB</span>
          </div>
          <nav className="footer-links">
            {FOOT_LINKS.map((l) => (
              <button key={l.path} onClick={() => navigate(l.path)}>
                {l.label}
              </button>
            ))}
          </nav>
          <div className="footer-legal">© 2026 Prema AI Voice Agent · Built by Premanath Talamarla</div>
        </footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
