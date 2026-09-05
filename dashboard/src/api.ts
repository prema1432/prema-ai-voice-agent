const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface AgentPersona {
  name: string;
  description?: string;
  requirements?: string;
  system_prompt?: string | null;
  primary_language: string;
  fallback_languages?: string[];
  auto_language_switch?: boolean;
  voice?: Record<string, unknown>;
  tools_enabled?: string[];
  max_call_seconds?: number;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  languages: string[];
  concurrency: number;
  dial_provider: string;
  agent?: AgentPersona | null;
  stats?: Record<string, unknown>;
  created_at?: string;
}

export interface Lead {
  id: string;
  campaign_id: string;
  phone: string;
  name?: string | null;
  language?: string | null;
  status: string;
  extra?: Record<string, unknown>;
  last_outcome?: string | null;
  last_call_at?: string | null;
  call_count: number;
  stage?: string;
}

export interface CallSession {
  id: string;
  campaign_id?: string | null;
  lead_id?: string | null;
  phone?: string | null;
  agent_name?: string | null;
  status: string;
  outcome?: string | null;
  language?: string | null;
  transcript?: { role: string; text: string; language?: string }[];
  summary?: string | null;
  lead_score?: number | null;
  duration_seconds?: number | null;
  error?: string | null;
  created_at?: string;
}

export interface AgentDirectoryItem {
  id: string;
  name: string;
  gender: "male" | "female";
  specialization: string;
  avatar?: string | null;
  accent?: string;
  description?: string;
  requirements?: string;
  primary_language?: string;
  tools_enabled?: string[];
  stats?: {
    leads_completed: number;
    calls: number;
    avg_score?: number | null;
    rating: number;
  };
  created_at?: string;
}

export interface AgentMeta {
  specializations: string[];
  sample_names: { male: string[]; female: string[] };
  accents: string[];
}

export interface LlmStatus {
  enabled: boolean;
  model: string;
  summary_model: string;
  base_url: string;
  key_set: boolean;
  thinking_effort: string | null;
  send_reasoning: boolean;
  usage_enabled: boolean;
  free_fallbacks: string[];
}

export interface LlmUsageRow {
  model: string;
  purpose: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  free: boolean;
  ts: string;
}

export interface LlmUsage {
  window_days: number;
  total: { calls: number; prompt_tokens: number; completion_tokens: number; cost: number; free_calls: number };
  per_day: { _id: string; calls: number; prompt_tokens: number; completion_tokens: number; cost: number }[];
  per_model: { _id: string; calls: number; prompt_tokens: number; completion_tokens: number; cost: number }[];
  recent: LlmUsageRow[];
}

/* ── Platform ops types ─────────────────────────────────── */
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: string;
  channels?: Record<string, string>;
  data?: Record<string, unknown>;
  read: boolean;
  ts?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  entity_type?: string | null;
  entity_id?: string | null;
  meta?: Record<string, unknown>;
  ts?: string;
}

export interface Integration {
  id: string;
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  config: { url: string; secret: string };
  events: string[];
  token?: string;
  created_at?: string;
}

export interface IntegrationCatalogType {
  label: string;
  icon: string;
  blurb: string;
  fields: string[];
}

export interface DeliveryLog {
  id: string;
  integration_name?: string;
  integration_type?: string;
  direction: "in" | "out";
  event?: string;
  url?: string;
  status: string;
  response?: string;
  error?: string;
  ts?: string;
}

export interface CrmStage {
  id: string;
  name: string;
  color: string;
  terminal: boolean;
}

export interface CrmBoard {
  campaign_id: string;
  stages: CrmStage[];
  columns: Record<string, Lead[]>;
  totals: { leads: number; in_progress: number; won: number; lost: number };
}

export const api = {
  health: () => req<Record<string, unknown>>("/health"),

  // notifications
  listNotifications: (unreadOnly = false) =>
    req<NotificationItem[]>(`/notifications${unreadOnly ? "?unread_only=true" : ""}`),
  unreadCount: () => req<{ count: number }>("/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    req<{ updated: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => req<{ updated: number }>("/notifications/read-all", { method: "POST" }),
  sendSampleNotification: () => req<{ sent: boolean }>("/notifications/sample", { method: "POST" }),

  // audit trail
  listAudit: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return req<AuditEntry[]>(`/audit${q ? `?${q}` : ""}`);
  },
  auditStats: () => req<{ by_action: Record<string, number> }>("/audit/stats"),

  // integrations
  integrationCatalog: () => req<{ types: Record<string, IntegrationCatalogType>; events: string[] }>("/integrations/catalog"),
  listIntegrations: () => req<Integration[]>("/integrations"),
  createIntegration: (body: unknown) => req<{ id: string; token: string }>("/integrations", { method: "POST", body: JSON.stringify(body) }),
  updateIntegration: (id: string, body: unknown) =>
    req<{ updated: boolean }>(`/integrations/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteIntegration: (id: string) => req<{ deleted: boolean }>(`/integrations/${id}`, { method: "DELETE" }),
  testIntegration: (id: string) => req<{ queued: boolean }>(`/integrations/${id}/test`, { method: "POST" }),
  listDeliveries: () => req<DeliveryLog[]>("/integrations/deliveries/latest"),

  // campaign CRM
  crmBoard: (campaignId: string) => req<CrmBoard>(`/campaigns/${campaignId}/crm/board`),
  saveCrmStages: (campaignId: string, stages: Partial<CrmStage>[]) =>
    req<{ stages: CrmStage[] }>(`/campaigns/${campaignId}/crm/stages`, {
      method: "PUT",
      body: JSON.stringify(stages),
    }),
  moveLead: (campaignId: string, leadId: string, stage: string) =>
    req<{ moved: boolean; stage: string }>(`/campaigns/${campaignId}/crm/move`, {
      method: "POST",
      body: JSON.stringify({ lead_id: leadId, stage }),
    }),


  // WebSocket base: same-origin /api proxy when no explicit API URL is set.
  wsBase: () => {
    const explicit = import.meta.env.VITE_API_URL as string | undefined;
    if (explicit) return explicit.replace(/^http/, "ws");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/api`;
  },

  // campaigns
  listCampaigns: () => req<Campaign[]>("/campaigns"),
  getCampaign: (id: string) => req<Campaign>(`/campaigns/${id}`),
  createCampaign: (body: unknown) =>
    req<{ id: string }>("/campaigns", { method: "POST", body: JSON.stringify(body) }),
  startCampaign: (id: string) =>
    req<{ status: string }>(`/campaigns/${id}/start`, { method: "POST" }),
  pauseCampaign: (id: string) =>
    req<{ status: string }>(`/campaigns/${id}/pause`, { method: "POST" }),
  deleteCampaign: (id: string) =>
    req<{ deleted: boolean }>(`/campaigns/${id}`, { method: "DELETE" }),

  // leads
  listLeads: (campaignId: string) => req<Lead[]>(`/leads?campaign_id=${campaignId}`),
  bulkAddLeads: (campaignId: string, leads: unknown[]) =>
    req<{ added: number; updated: number; invalid: string[]; dnd_skipped: number }>(
      `/leads/bulk?campaign_id=${campaignId}`,
      { method: "POST", body: JSON.stringify({ leads }) },
    ),
  uploadCsv: (campaignId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/leads/csv?campaign_id=${campaignId}`, {
      method: "POST",
      body: form,
    }).then(async (res) => {
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        added: number;
        updated: number;
        invalid: string[];
        dnd_skipped: number;
      }>;
    });
  },
  exportCsv: (campaignId: string) => `${BASE}/leads/export/csv?campaign_id=${campaignId}`,

  // calls
  listCalls: (campaignId?: string) =>
    req<CallSession[]>(`/calls${campaignId ? `?campaign_id=${campaignId}` : ""}`),
  getCall: (id: string) => req<CallSession>(`/calls/${id}`),

  // agents directory
  listAgents: () => req<AgentDirectoryItem[]>("/agents"),
  getAgent: (id: string) => req<AgentDirectoryItem>(`/agents/${id}`),
  createAgent: (body: unknown) => req<{ id: string }>("/agents", { method: "POST", body: JSON.stringify(body) }),
  deleteAgent: (id: string) => req<{ deleted: boolean }>(`/agents/${id}`, { method: "DELETE" }),
  agentMeta: () => req<AgentMeta>("/agents/meta"),

  // llm
  llmStatus: () => req<LlmStatus>("/llm/status"),
  llmUsage: (days = 7) => req<LlmUsage>(`/llm/usage?days=${days}`),
};

export const LANGUAGES: Record<string, string> = {
  hi: "Hindi",
  en: "English",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
  or: "Odia",
  as: "Assamese",
  ur: "Urdu",
  hinglish: "Hinglish",
};
