export type Route =
  | { name: "landing" }
  | { name: "dashboard" }
  | { name: "campaigns" }
  | { name: "campaign-detail"; id: string }
  | { name: "agents" }
  | { name: "llm" }
  | { name: "llm-models" }
  | { name: "llm-model"; id: string }
  | { name: "voicelab"; agentId?: string }
  | { name: "calls" }
  | { name: "call-detail"; id: string }
  | { name: "crm"; campaignId?: string }
  | { name: "notifications" }
  | { name: "integrations" }
  | { name: "audit" }
  | { name: "forms" }
  | { name: "form-builder"; id: string }
  | { name: "form-submissions"; id: string }
  | { name: "form-public"; slug: string }
  | { name: "ai-requirement" }
  | { name: "invoices" }
  | { name: "widgets" }
  | { name: "ai-chat" }
  | { name: "ai-voice-bot" }
  | { name: "profile" };

export function parseRoute(path: string): Route {
  const clean = path.replace(/^\/+|\/+$/g, "");
  let parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "landing" };
  if (parts[0] === "f" && parts[1]) return { name: "form-public", slug: parts[1] };
  // The dashboard app lives under /app/** — clean history-API URLs, no "#".
  if (parts[0] === "app") parts = parts.slice(1);
  if (parts.length === 0) return { name: "dashboard" };
  if (parts[0] === "campaigns" && parts[1]) return { name: "campaign-detail", id: parts[1] };
  if (parts[0] === "calls" && parts[1]) return { name: "call-detail", id: parts[1] };
  if (parts[0] === "voicelab") return { name: "voicelab", agentId: parts[1] };
  if (parts[0] === "campaigns") return { name: "campaigns" };
  if (parts[0] === "crm") return { name: "crm", campaignId: parts[1] };
  if (parts[0] === "notifications") return { name: "notifications" };
  if (parts[0] === "integrations") return { name: "integrations" };
  if (parts[0] === "audit") return { name: "audit" };
  if (parts[0] === "agents") return { name: "agents" };
  if (parts[0] === "llm" && parts[1] === "models") return { name: "llm-models" };
  if (parts[0] === "llm" && parts[1] === "model" && parts[2]) {
    return { name: "llm-model", id: decodeURIComponent(parts[2]) };
  }
  if (parts[0] === "llm") return { name: "llm" };
  if (parts[0] === "calls") return { name: "calls" };
  if (parts[0] === "forms" && parts[1] && parts[2] === "submissions") {
    return { name: "form-submissions", id: parts[1] };
  }
  if (parts[0] === "forms" && parts[1]) return { name: "form-builder", id: parts[1] };
  if (parts[0] === "forms") return { name: "forms" };
  if (parts[0] === "ai-requirement") return { name: "ai-requirement" };
  if (parts[0] === "invoices") return { name: "invoices" };
  if (parts[0] === "widgets") return { name: "widgets" };
  if (parts[0] === "ai-chat") return { name: "ai-chat" };
  if (parts[0] === "ai-voice-bot") return { name: "ai-voice-bot" };
  if (parts[0] === "profile") return { name: "profile" };
  return { name: "dashboard" };
}

/**
 * History-API navigation (clean URLs, no hash). Pushes the path and notifies
 * the router via a popstate event so the shell re-renders on every nav.
 */
export function navigate(path: string) {
  const target = `/${path.replace(/^\/+/, "")}`;
  if (location.pathname === target) return;
  history.pushState(null, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function currentUrl(path: string): string {
  return `${location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}