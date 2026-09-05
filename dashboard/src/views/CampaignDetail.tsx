import { useCallback, useEffect, useState } from "react";
import { api, Campaign, Lead, LANGUAGES } from "../api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LangPill,
  Progress,
  StatCard,
  StatusBadge,
  fmtDate,
} from "../components";
import { navigate } from "../router";
import CampaignRunCard from "./campaigns/RunPlanner";
import LeadEditModal from "./campaigns/LeadEditModal";
import PipelineModal from "./campaigns/PipelineModal";

type CampaignStats = {
  total?: number;
  by_status?: Record<string, number>;
  by_outcome?: Record<string, number>;
  calls?: Record<string, number>;
  dialer_running?: boolean;
};

type LeadRow = { name: string; phone: string; language: string; notes: string };
const newRow = (language: string): LeadRow => ({ name: "", phone: "", language, notes: "" });

export default function CampaignDetail({ id }: { id: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [pipelineOpen, setPipelineOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, ls] = await Promise.all([api.getCampaign(id), api.listLeads(id)]);
      setCampaign(c);
      setLeads(ls);
    } catch {
      setCampaign(null);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (!campaign) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate("campaigns")}>
          ← Back to campaigns
        </Button>
        <EmptyState icon="🔍" title="Campaign not found" sub="It may have been deleted, or the backend is offline." />
      </div>
    );
  }

  const stats = (campaign.stats ?? {}) as CampaignStats;
  const by = stats.by_status ?? {};
  const outcomes = stats.by_outcome ?? {};
  const total = stats.total ?? 0;
  const done =
    (by.completed ?? 0) + (by.failed ?? 0) + (by.dnd ?? 0) + (by.skipped ?? 0);
  const pct = total > 0 ? (done / total) * 100 : 0;
  const runningDialer = stats.dialer_running === true;
  const callCounts = stats.calls ?? {};
  const callTotal = Object.values(callCounts).reduce((s, v) => s + Number(v), 0);
  const callSub = Object.entries(callCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

  async function act(action: "start" | "pause" | "delete") {
    setBusy(true);
    setMsg(null);
    try {
      if (action === "start") await api.startCampaign(id);
      if (action === "pause") await api.pauseCampaign(id);
      if (action === "delete") {
        await api.deleteCampaign(id);
        navigate("campaigns");
        return;
      }
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  async function uploadCsv(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.uploadCsv(id, file);
      setMsg({
        ok: true,
        text:
          `CSV imported: +${res.added} leads, ${res.updated} updated` +
          (res.dnd_skipped ? `, ${res.dnd_skipped} DND skipped` : "") +
          (res.invalid.length ? `, ${res.invalid.length} invalid: ${res.invalid.join(", ")}` : ""),
      });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  function updateRow(i: number, patch: Partial<LeadRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function saveLeads() {
    const valid = rows.filter((r) => r.phone.trim());
    if (valid.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.bulkAddLeads(
        id,
        valid.map((r) => ({
          phone: r.phone.trim(),
          name: r.name.trim() || null,
          language: r.language || null,
          extra: { ...(r.notes.trim() ? { notes: r.notes.trim() } : {}) },
        })),
      );
      setMsg({
        ok: true,
        text:
          `Added ${res.added} lead(s) ✓` +
          (res.dnd_skipped ? ` · ${res.dnd_skipped} DND skipped` : "") +
          (res.invalid.length ? ` · invalid: ${res.invalid.join(", ")}` : ""),
      });
      setShowForm(false);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  async function removeLead(l: Lead) {
    if (!window.confirm(`Delete lead ${l.name ?? l.phone}?`)) return;
    setBusy(true);
    try {
      await api.deleteLead(l.id);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  const leadNotes = (l: Lead) => {
    const n = (l.extra as Record<string, unknown> | undefined)?.notes;
    return typeof n === "string" ? n : "";
  };

  const leadLang = (l: Lead) =>
    l.language
      ? l.language
      : campaign.agent?.primary_language ?? campaign.languages?.[0] ?? "hi";

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("campaigns")}>
        ← Back to campaigns
      </Button>

      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {campaign.name}
            <StatusBadge status={campaign.status} />
            <LangPill code={campaign.languages?.[0]} />
          </h2>
          <div className="sub">
            Created {fmtDate(campaign.created_at)} · dial provider: <code>{campaign.dial_provider}</code>
            {campaign.status === "running" && runningDialer && " · dialer attached ✓"}
          </div>
        </div>
        <div className="page-head-actions">
          {campaign.status !== "running" ? (
            <Button variant="primary" disabled={busy} onClick={() => act("start")}>
              ▶ Start dialing
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => act("pause")}>
              ⏸ Pause
            </Button>
          )}
          <Button onClick={() => navigate(`crm/${id}`)}>🗂 CRM board</Button>
          <Button onClick={() => setPipelineOpen(true)}>⚙ Pipeline</Button>
          <a className="btn" href={api.exportCsv(id)} download>
            ⬇ Export CSV
          </a>
          <Button variant="danger" disabled={busy} onClick={() => act("delete")}>
            🗑 Delete
          </Button>
        </div>
      </div>

      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      <div className="stat-grid">
        <StatCard label="Leads" value={total} icon="👥" tone="indigo" sub={`${done} processed`} />
        <StatCard
          label="Completed"
          value={(by.completed ?? 0) + (by.failed ?? 0) + (by.dnd ?? 0) + (by.skipped ?? 0)}
          icon="✅"
          tone="green"
          sub={`${(by.failed ?? 0)} failed · ${(by.dnd ?? 0)} dnd`}
        />
        <StatCard
          label="Call sessions"
          value={callTotal}
          icon="📞"
          tone="cyan"
          sub={callSub || "none yet"}
        />
        <StatCard
          label="Interested"
          value={outcomes.interested ?? 0}
          icon="🔥"
          tone="amber"
          sub={`${outcomes.callback_requested ?? 0} callbacks requested${campaign.expected_leads ? ` · target ≥${campaign.expected_leads}` : ""}`}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <CampaignRunCard campaign={campaign} onUpdate={load} />
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <Card
            title="Dialer progress"
            action={
              campaign.status === "running" ? (
                <Badge tone={runningDialer ? "green" : "red"}>
                  ● {runningDialer ? "live" : "stopped"}
                </Badge>
              ) : undefined
            }
          >
            <Progress value={pct} />
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              {Object.entries(by).map(([k, v]) => (
                <Badge key={k} tone={k === "completed" ? "green" : k === "failed" || k === "dnd" ? "red" : "gray"}>
                  {k}: {v}
                </Badge>
              ))}
              {Object.keys(by).length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No leads yet — add some below.</span>}
            </div>
          </Card>

          <Card title="Agent" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "var(--gradient)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 19,
                }}
              >
                {campaign.agent?.name?.[0] ?? "🤖"}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{campaign.agent?.name ?? "Unnamed agent"}</div>
                <LangPill code={leadLang({ language: null } as Lead)} />
              </div>
            </div>
            {campaign.agent?.tools_enabled && campaign.agent.tools_enabled.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                {campaign.agent.tools_enabled.map((t) => (
                  <Badge key={t} tone="blue">
                    ⚙ {t}
                  </Badge>
                ))}
              </div>
            )}
            {campaign.agent?.requirements && (
              <div
                style={{
                  background: "var(--bg-soft)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {campaign.agent.requirements}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card
            title={`Leads (${total})`}
            action={
              <div style={{ display: "flex", gap: 6 }}>
                <label className="btn sm" style={{ cursor: "pointer" }}>
                  ⬆ CSV
                  <input
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0])}
                  />
                </label>
                <Button size="sm" onClick={() => setShowForm((s) => !s)}>
                  {showForm ? "✕ Close" : "➕ Form"}
                </Button>
              </div>
            }
          >
            {showForm && (
              <div style={{ marginBottom: 14, borderBottom: "1px dashed var(--border-soft)", paddingBottom: 12 }}>
                {rows.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1.1fr 0.8fr 1.8fr auto",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <input className="input" style={{ padding: 7 }} placeholder="Name" value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
                    <input className="input" style={{ padding: 7 }} placeholder="98765 43210" value={r.phone} onChange={(e) => updateRow(i, { phone: e.target.value })} />
                    <select className="select" style={{ padding: 7 }} value={r.language} onChange={(e) => updateRow(i, { language: e.target.value })}>
                      {Object.entries(LANGUAGES).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input className="input" style={{ padding: 7 }} placeholder="Guidelines for the agent" value={r.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} />
                    <Button size="sm" variant="ghost" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                      ✕
                    </Button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Button size="sm" onClick={() => setRows((rs) => [...rs, newRow(campaign.languages?.[0] ?? "hi")])}>
                    ➕ Another lead
                  </Button>
                  <Button size="sm" variant="primary" disabled={busy || rows.every((r) => !r.phone.trim())} onClick={saveLeads}>
                    💾 Save leads
                  </Button>
                </div>
              </div>
            )}

            {leads.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No leads yet"
                sub="Upload a CSV (phone column required) or add leads one by one with the form."
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Lang</th>
                      <th>Status</th>
                      <th>Outcome</th>
                      <th>Calls</th>
                      <th>Notes</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{l.name ?? "—"}</td>
                        <td className="num">{l.phone}</td>
                        <td>
                          <LangPill code={leadLang(l)} />
                        </td>
                        <td>
                          <StatusBadge status={l.status} />
                        </td>
                        <td>{l.last_outcome ? <Badge tone="gray">{l.last_outcome}</Badge> : <span style={{ color: "var(--text-faint)" }}>—</span>}</td>
                        <td className="num">{l.call_count ?? 0}</td>
                        <td style={{ color: "var(--text-muted)", fontSize: 12, maxWidth: 180 }}>
                          {leadNotes(l) ? (
                            <span title={leadNotes(l)}>{leadNotes(l).slice(0, 40)}{leadNotes(l).length > 40 ? "…" : ""}</span>
                          ) : (
                            <span style={{ color: "var(--text-faint)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <div className="lead-actions">
                            <Button size="sm" variant="ghost" title="Edit lead" onClick={() => setEditLead(l)}>
                              ✎
                            </Button>
                            <Button size="sm" variant="ghost" title="Delete lead" disabled={busy} onClick={() => removeLead(l)}>
                              🗑
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {editLead && (
        <LeadEditModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={() => {
            setEditLead(null);
            load();
          }}
        />
      )}
      {pipelineOpen && (
        <PipelineModal
          campaignId={id}
          stages={campaign.crm_stages ?? [{ id: "new", name: "New", color: "#6366f1", terminal: false }]}
          onClose={() => setPipelineOpen(false)}
          onSaved={() => {
            setPipelineOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}