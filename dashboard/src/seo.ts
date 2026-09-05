import { Route } from "./router";

const BRAND = "Prema AI Voice Agent";
const DEFAULT_DESC =
  "Self-hosted AI call agents for Indian numbers and regional languages (Hindi, Telugu, Tamil, Kannada, Bengali, Marathi, Gujarati). OpenRouter LLM, MongoDB, campaigns, CRM pipeline and form workflows.";

/** Route → branded title/description defaults (enriched with live data by views). */
const ROUTE_SEO: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: `Dashboard — ${BRAND}`,
    description: "Campaign overview, call stats, LLM cost and agent health for your AI voice calling operations.",
  },
  campaigns: {
    title: `Campaigns — ${BRAND}`,
    description: "Create and manage outbound AI voice campaigns with Indian-language agents, lead lists and scheduled runs.",
  },
  "campaign-detail": {
    title: `Campaign — ${BRAND}`,
    description: "Campaign details: leads, pipeline, scheduled runs, agent team and per-call results.",
  },
  agents: {
    title: `Agents — ${BRAND}`,
    description: "Dynamic AI voice agents with Indian names, specializations, ratings and completed-lead stats.",
  },
  voicelab: {
    title: `Voice Lab — ${BRAND}`,
    description: "Talk to an AI agent live in your browser — real voice in, real voice out, in Telugu, Hindi, Tamil and more.",
  },
  calls: {
    title: `Call Logs — ${BRAND}`,
    description: "Every AI call session: transcripts, outcomes, duration and per-call LLM usage.",
  },
  "call-detail": {
    title: `Call — ${BRAND}`,
    description: "Full transcript and outcome of an AI voice call.",
  },
  crm: {
    title: `CRM Pipeline — ${BRAND}`,
    description: "Drag-and-drop lead pipeline per campaign: New → Contacted → Qualified → Proposal → Won / Lost.",
  },
  llm: {
    title: `LLM & Cost — ${BRAND}`,
    description: "Active model, token usage, spend and per-model analytics across all calls.",
  },
  "llm-models": {
    title: `LLM Models — ${BRAND}`,
    description: "Dynamic OpenRouter model catalog: context, pricing, free tier, set-default and live testing.",
  },
  "llm-model": {
    title: `Model — ${BRAND}`,
    description: "Model details: context window, pricing, test latency and usage history.",
  },
  notifications: {
    title: `Notifications — ${BRAND}`,
    description: "In-app, email, SMS, WhatsApp and webhook notifications across campaigns, forms and integrations.",
  },
  integrations: {
    title: `Integrations — ${BRAND}`,
    description: "Webhooks, WhatsApp, Instagram, email, SMS and custom integrations with delivery logs.",
  },
  audit: {
    title: `Audit Logs — ${BRAND}`,
    description: "Full audit trail of every action: campaigns, leads, agents, CRM moves, LLM changes and forms.",
  },
  forms: {
    title: `Forms — ${BRAND}`,
    description: "Build multi-step forms with dynamic fields, formulas and action workflows; publish and share.",
  },
  "form-builder": {
    title: `Form Builder — ${BRAND}`,
    description: "Design multi-step forms, dynamic dropdowns, formulas and submission actions.",
  },
  "form-submissions": {
    title: `Submissions — ${BRAND}`,
    description: "Every form submission with field values, workflow action results and timestamps.",
  },
  "form-public": {
    title: `Form — ${BRAND}`,
    description: "Fill out this form — responses are stored securely and trigger configured workflows.",
  },
};

function ensureMeta(attr: "name" | "property", key: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  return el;
}

export interface SeoInput {
  title: string;
  description?: string;
  /** Optional canonical URL — defaults to the current clean URL. */
  canonical?: string;
}

/** Set the page title + description + social meta tags (idempotent). */
export function setSeo(input: SeoInput) {
  const description = (input.description || DEFAULT_DESC).slice(0, 200);
  document.title = input.title;
  ensureMeta("name", "description").content = description;
  ensureMeta("property", "og:title").content = input.title;
  ensureMeta("property", "og:description").content = description;
  ensureMeta("property", "og:type").content = "website";
  ensureMeta("property", "og:site_name").content = BRAND;
  ensureMeta("property", "og:url").content =
    input.canonical ?? `${location.origin}${location.pathname}`;
  ensureMeta("name", "twitter:card").content = "summary";
  ensureMeta("name", "twitter:title").content = input.title;
  ensureMeta("name", "twitter:description").content = description;
}

/** Apply the static default for a route (used by the shell on every nav). */
export function applyRouteSeo(route: Route) {
  const def = ROUTE_SEO[route.name];
  if (!def) return;
  let title = def.title;
  if (route.name === "form-public") {
    title = `Fill: ${decodeURIComponent(route.slug)} — ${BRAND}`;
  } else if (route.name === "campaign-detail") {
    title = `Campaign — ${BRAND}`;
  } else if (route.name === "llm-model") {
    title = `Model: ${route.id} — ${BRAND}`;
  }
  setSeo({ title, description: def.description });
}

/** Per-entity enrichment used by views once their data loads. */
export function seoForEntity(opts: {
  kind: string;
  name: string;
  description?: string;
  url?: string;
}) {
  setSeo({
    title: `${opts.kind}: ${opts.name} — ${BRAND}`,
    description: opts.description,
    canonical: opts.url,
  });
}