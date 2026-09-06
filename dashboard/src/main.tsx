import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import GlobalSearch from "./components/GlobalSearch";
import { NotificationBell } from "./components/NotificationBell";
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
import PublicJob from "./views/aireq/PublicJob";
import Landing from "./views/landing/Landing";
import AiRequirement from "./views/AiRequirement";
import StageTemplates from "./views/aireq/StageTemplates";
import Invoices from "./views/Invoices";
import Widgets from "./views/Widgets";
import AiChat from "./views/AiChat";
import AiVoiceBot from "./views/AiVoiceBot";
import Profile from "./views/Profile";
import UserMenu from "./components/UserMenu";
import "./styles.css";
import "./platform.css";
import "./dashboard.css";

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

type NavItem = { key: string; label: string; icon: string; path: string };
const NAV_GROUPS: { label: string; icon: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    icon: "🏠",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "📊", path: "app" },
      { key: "campaigns", label: "Campaigns", icon: "📋", path: "campaigns" },
      { key: "crm", label: "CRM Board", icon: "🗂", path: "crm" },
      { key: "calls", label: "Call Logs", icon: "📞", path: "calls" },
    ],
  },
  {
    label: "AI Studio",
    icon: "🧠",
    items: [
      { key: "agents", label: "Agents", icon: "🤖", path: "agents" },
      { key: "voicelab", label: "Voice Lab", icon: "🎤", path: "voicelab" },
      { key: "ai-chat", label: "AI Chat Bot", icon: "💬", path: "ai-chat" },
      { key: "ai-voice-bot", label: "AI Voice Bot", icon: "🗣️", path: "ai-voice-bot" },
      { key: "widgets", label: "Widget Studio", icon: "🧩", path: "widgets" },
    ],
  },
  {
    label: "Automation",
    icon: "⚙️",
    items: [
      { key: "forms", label: "Forms", icon: "📝", path: "forms" },
      { key: "ai-requirement", label: "AI Requirement", icon: "🪄", path: "ai-requirement" },
      { key: "invoices", label: "Invoice Generator", icon: "🧾", path: "invoices" },
      { key: "integrations", label: "Integrations", icon: "🔌", path: "integrations" },
    ],
  },
  {
    label: "Intelligence",
    icon: "📈",
    items: [
      { key: "llm", label: "LLM & Cost", icon: "🧠", path: "llm" },
      { key: "llm-models", label: "LLM Models", icon: "📚", path: "llm/models" },
      { key: "notifications", label: "Notifications", icon: "🔔", path: "notifications" },
      { key: "audit", label: "Audit Logs", icon: "🧾", path: "audit" },
    ],
  },
];

const FOOT_LINKS: { label: string; path: string }[] = [
  { label: "Dashboard", path: "app" },
  { label: "Campaigns", path: "campaigns" },
  { label: "CRM Pipeline", path: "crm" },
  { label: "Voice Lab", path: "voicelab" },
  { label: "AI Chat Bot", path: "ai-chat" },
  { label: "AI Voice Bot", path: "ai-voice-bot" },
  { label: "Forms", path: "forms" },
  { label: "Widgets", path: "widgets" },
  { label: "Integrations", path: "integrations" },
  { label: "Profile", path: "profile" },
];

function isActive(routeName: string, key: string): boolean {
  if (key === "campaigns") return routeName === "campaigns" || routeName === "campaign-detail";
  if (key === "calls") return routeName === "calls" || routeName === "call-detail";
  if (key === "voicelab") return routeName === "voicelab";
  if (key === "crm") return routeName === "crm";
  if (key === "forms") return routeName === "forms" || routeName === "form-builder" || routeName === "form-submissions";
  if (key === "llm") return routeName === "llm" || routeName === "llm-models" || routeName === "llm-model";
  if (key === "llm-models") return routeName === "llm-models" || routeName === "llm-model";
  if (key === "ai-chat") return routeName === "ai-chat";
  if (key === "ai-voice-bot") return routeName === "ai-voice-bot";
  if (key === "widgets") return routeName === "widgets";
  if (key === "ai-requirement") {
    return ["ai-requirement", "aireq-new", "aireq-edit", "aireq-pipeline", "aireq-funnel", "aireq-share", "stage-templates"].includes(routeName);
  }
  if (key === "stage-templates") return routeName === "stage-templates";
  if (key === "invoices") return routeName === "invoices";
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

  // Collapsible nav groups — persisted, all open by default.
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("prema.sidebar.groups");
      return raw ? (JSON.parse(raw) as string[]) : NAV_GROUPS.map((g) => g.label);
    } catch {
      return NAV_GROUPS.map((g) => g.label);
    }
  });
  useEffect(() => {
    localStorage.setItem("prema.sidebar.groups", JSON.stringify(openGroups));
  }, [openGroups]);
  const toggleGroup = (label: string) =>
    setOpenGroups((gs) => (gs.includes(label) ? gs.filter((g) => g !== label) : [...gs, label]));

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

  const backendUp = !err && health != null;
  const user = health?.user as { name: string; email: string } | undefined;
  const changeTheme = () => setTheme(toggleTheme());

  // Live IST clock for the footer status strip (Indian-market product).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const istTime = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  }).format(now);

  // Marketing landing page: standalone, animated, clean URLs (no "#" fragments).
  if (route.name === "landing") {
    return <Landing />;
  }

  // Public share link: standalone page without the dashboard shell.
  if (route.name === "form-public") {
    return <PublicForm slug={route.slug} />;
  }
  if (route.name === "job-public") {
    return <PublicJob id={route.id} />;
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

        {NAV_GROUPS.map((g) => {
          const open = collapsed || openGroups.includes(g.label);
          const groupActive = g.items.some((n) => isActive(route.name, n.key));
          return (
            <div
              key={g.label}
              className={`nav-group ${open ? "open" : ""} ${groupActive ? "has-active" : ""}`}
            >
              <button
                className="nav-group-head"
                onClick={() => toggleGroup(g.label)}
                title={collapsed ? g.label : undefined}
              >
                <span className="ic">{g.icon}</span>
                <span className="lbl">{g.label}</span>
                <span className="chev">▾</span>
              </button>
              <div className="nav-group-body">
                {g.items.map((n) => (
                  <button
                    key={n.key}
                    className={`nav-item sub ${isActive(route.name, n.key) ? "active" : ""}`}
                    onClick={() => navigate(n.path)}
                    title={collapsed ? n.label : undefined}
                  >
                    <span className="ic">{n.icon}</span>
                    <span className="lbl">{n.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-brand" onClick={() => navigate("app")} title="Go to Dashboard">
            <span className="mark">🎙️</span>
            <span className="brand-text">
              <b>Prema AI</b> <em>Voice Agent</em>
            </span>
          </div>

          <GlobalSearch />

          <div className="topbar-actions">
            <NotificationBell />
            <button className="theme-toggle" data-on={theme} onClick={changeTheme} title="Toggle theme">
              <span className="theme-group">
                <span className="theme-ic">{theme === "light" ? "☀️" : "🌙"}</span>
                <span className="lbl">{theme === "light" ? "Light" : "Dark"}</span>
              </span>
              <span className="sw" />
            </button>
          </div>

          <UserMenu user={user ?? null} />
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
          {route.name === "ai-requirement" && <AiRequirement view={{ kind: "list" }} />}
          {route.name === "aireq-new" && <AiRequirement view={{ kind: "editor" }} />}
          {route.name === "aireq-edit" && <AiRequirement view={{ kind: "editor", id: route.id }} />}
          {route.name === "aireq-pipeline" && <AiRequirement view={{ kind: "pipeline", id: route.id }} />}
          {route.name === "aireq-funnel" && <AiRequirement view={{ kind: "funnel", id: route.id }} />}
          {route.name === "aireq-share" && <AiRequirement view={{ kind: "share", id: route.id }} />}
          {route.name === "stage-templates" && <StageTemplates />}
          {route.name === "invoices" && <Invoices />}
          {route.name === "widgets" && <Widgets />}
          {route.name === "ai-chat" && <AiChat />}
          {route.name === "ai-voice-bot" && <AiVoiceBot />}
          {route.name === "profile" && <Profile />}
        </div>

        <footer className="footer">
          <div className="foot-brand">
            <b>🎙️ Prema AI Voice Agent</b>
            <span>Self-hosted AI calling for Indian numbers &amp; regional languages</span>
          </div>

          <nav className="footer-links">
            {FOOT_LINKS.map((l) => (
              <button key={l.path} onClick={() => navigate(l.path)}>
                {l.label}
              </button>
            ))}
          </nav>

          <div className="foot-status">
            <span className="foot-chip">
              <span className={`dot ${backendUp ? "green" : "red"}`} />
              {backendUp ? "All systems operational" : "Backend offline"}
            </span>
            <span className="foot-chip">🕒 {istTime} IST</span>
            <span className="foot-chip">⚡ OpenRouter · MongoDB · Asterisk</span>
          </div>

          <div className="footer-legal">
            © {new Date().getFullYear()} Prema AI Voice Agent · Crafted with 💜 by Premanath Talamarla
          </div>
        </footer>
      </main>
    </div>
  );
}

// PWA: register the offline shell service worker (no-op on unsupported hosts).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
