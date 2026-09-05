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

export const api = {
  health: () => req<Record<string, unknown>>("/health"),

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
