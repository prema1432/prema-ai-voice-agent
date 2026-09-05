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
  schedule_start?: string | null;
  schedule_end?: string | null;
  expected_leads?: number | null;
  team_agent_ids?: string[];
  crm_stages?: CrmStage[];
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

/* ── Form builder types ────────────────────────────────── */
export interface FormOptionsApi {
  url: string;
  method?: "GET" | "POST";
  headers?: string;
  body?: string;
  data_path?: string;
  label_path?: string;
  value_path?: string;
}

export interface FormShowWhen {
  field: string;
  op: "eq" | "neq" | "in" | "gt" | "lt" | "empty";
  value: string;
}

export interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  default?: string;
  options?: string[];
  options_api?: FormOptionsApi | null;
  formula?: string;
  computed?: boolean;
  show_when?: FormShowWhen | null;
  validation?: Record<string, string | number>;
  width?: "full" | "half";
}

export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormAction {
  id: string;
  type: string;
  name: string;
  enabled?: boolean;
  config: Record<string, unknown>;
}

export interface FormDef {
  id: string;
  title: string;
  description?: string;
  slug?: string;
  published?: boolean;
  published_at?: string | null;
  created_at?: string;
  stats?: { submissions?: number };
  settings?: { submit_label?: string; success_message?: string; redirect_url?: string; show_progress?: boolean };
  steps: FormStep[];
  actions?: FormAction[];
  submissions?: number;
  field_count?: number;
}

export interface FormSubmission {
  id: string;
  form_id?: string;
  form_title?: string;
  data: Record<string, unknown>;
  answers?: Record<string, unknown>;
  actions?: { action_id?: string; type: string; name: string; status: string; detail: string; at: string }[];
  created_at?: string;
}

export interface PublicFormDef {
  title: string;
  description?: string;
  slug: string;
  settings: FormDef["settings"];
  steps: FormStep[];
  published_at?: string;
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
  updateCampaign: (id: string, body: unknown) =>
    req<{ updated: boolean }>(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  startCampaign: (id: string) =>
    req<{ status: string }>(`/campaigns/${id}/start`, { method: "POST" }),
  pauseCampaign: (id: string) =>
    req<{ status: string }>(`/campaigns/${id}/pause`, { method: "POST" }),
  scheduleCampaign: (
    id: string,
    body: {
      schedule_start: string;
      schedule_end?: string | null;
      expected_leads?: number | null;
      concurrency: number;
      team_agent_ids?: string[];
    },
  ) => req<{ status: string }>(`/campaigns/${id}/schedule`, { method: "POST", body: JSON.stringify(body) }),
  cancelSchedule: (id: string) =>
    req<{ status: string }>(`/campaigns/${id}/cancel-schedule`, { method: "POST" }),
  deleteCampaign: (id: string) =>
    req<{ deleted: boolean }>(`/campaigns/${id}`, { method: "DELETE" }),

  // leads
  listLeads: (campaignId: string) => req<Lead[]>(`/leads?campaign_id=${campaignId}`),
  updateLead: (leadId: string, body: Record<string, unknown>) =>
    req<{ updated: boolean; id: string }>(`/leads/${leadId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteLead: (leadId: string) =>
    req<{ deleted: boolean }>(`/leads/${leadId}`, { method: "DELETE" }),
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
  llmModels: () => req<{ current: string; models: string[] }>("/llm/models"),
  setLlmModel: (model: string) =>
    req<{ model: string; persisted: boolean; previous: string }>("/llm/model", {
      method: "PUT",
      body: JSON.stringify({ model }),
    }),
  testLlm: (model?: string) =>
    req<{
      ok: boolean;
      model: string;
      reply?: string;
      error?: string;
      latency_ms: number;
      usage?: { prompt_tokens: number; completion_tokens: number };
    }>("/llm/test", { method: "POST", body: JSON.stringify({ model: model ?? null }) }),

  // forms
  listForms: () => req<FormDef[]>("/forms"),
  getForm: (id: string) => req<FormDef>(`/forms/${id}`),
  createForm: (body: Partial<FormDef>) => req<{ id: string }>("/forms", { method: "POST", body: JSON.stringify(body) }),
  updateForm: (id: string, body: Partial<FormDef>) =>
    req<{ updated: boolean }>(`/forms/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteForm: (id: string) => req<{ deleted: boolean }>(`/forms/${id}`, { method: "DELETE" }),
  publishForm: (id: string) => req<{ published: boolean; slug: string }>(`/forms/${id}/publish`, { method: "POST" }),
  unpublishForm: (id: string) => req<{ published: boolean }>(`/forms/${id}/unpublish`, { method: "POST" }),
  formSubmissions: (id: string) => req<FormSubmission[]>(`/forms/${id}/submissions`),
  deleteSubmission: (sid: string) => req<{ deleted: boolean }>(`/forms/submissions/${sid}`, { method: "DELETE" }),
  // public (published forms)
  publicForm: (slug: string) => req<PublicFormDef>(`/public/forms/${slug}`),
  publicOptions: (slug: string, field: string) =>
    req<{ ok: boolean; options: { label: string; value: string }[]; error?: string }>(`/public/forms/${slug}/options?field=${encodeURIComponent(field)}`),
  submitPublic: (slug: string, data: Record<string, unknown>) =>
    req<{ ok: boolean; submission_id: string; form_title?: string }>(`/public/forms/${slug}/submit`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
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
