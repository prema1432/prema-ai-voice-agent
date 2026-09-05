import { useCallback, useEffect, useState } from "react";
import { api, Campaign, LANGUAGES } from "../api";
import { Badge, Button, Card, EmptyState, LangPill, Progress, StatusBadge } from "../components";
import { navigate } from "../router";

type LeadRow = { name: string; phone: string; language: string; notes: string };
const newRow = (language: string): LeadRow => ({ name: "", phone: "", language, notes: "" });

type CampaignStats = {
  total?: number;
  by_status?: Record<string, number>;
  by_outcome?: Record<string, number>;
  calls?: Record<string, number>;
  dialer_running?: boolean;
};

const emptyAgent = {
  name: "Priya",
  requirements:
    "You are a polite sales agent for a home-cleaning service. Greet, qualify interest, share the ₹499 intro offer, and try to book a demo visit.",
  primary_language: "hi",
  fallback_languages: ["hinglish", "en"],
  auto_language_switch: true,
  tools_enabled: ["book_appointment", "set_callback", "end_call", "opt_out_dnd"],
  max_call_seconds: 300,
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [agent, setAgent] = useState(emptyAgent);
  const [lang, setLang] = useState("hi");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [leadFormFor, setLeadFormFor] = useState<string | null>(null);
  const [rows, setRows] = useState<LeadRow[]>([]);

  const load = useCallback(async () => {
    try {
      setCampaigns(await api.listCampaigns());
    } catch {
      setMsg({ ok: false, text: "Could not reach backend." });
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function create() {
    if (!name.trim()) {
      setMsg({ ok: false, text: "Give the campaign a name." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.createCampaign({
        name,
        languages: [lang],
        dial_provider: "mock",
        agent: { ...agent, primary_language: lang },
      });
      setMsg({ ok: true, text: `Campaign created ✓ — now add leads.` });
      setName("");
      await load();
      navigate(`campaigns/${res.id}`);
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  async function act(c: Campaign, action: "start" | "pause" | "delete") {
    setBusy(true);
    try {
      if (action === "start") await api.startCampaign(c.id);
      if (action === "pause") await api.pauseCampaign(c.id);
      if (action === "delete") await api.deleteCampaign(c.id);
      if (action === "delete") navigate("campaigns");
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  function openLeadForm(c: Campaign) {
    setLeadFormFor(leadFormFor === c.id ? null : c.id);
    setRows([newRow(c.languages[0] ?? "hi")]);
  }

  function updateRow(i: number, patch: Partial<LeadRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function saveLeads() {
    if (!leadFormFor) return;
    const valid = rows.filter((r) => r.phone.trim());
    if (valid.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.bulkAddLeads(
        leadFormFor,
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
          `Added ${res.added} lead(s) ✓${res.dnd_skipped ? ` (${res.dnd_skipped} DND skipped)` : ""}` +
          (res.invalid.length ? ` · ${res.invalid.length} invalid: ${res.invalid.join(", ")}` : ""),
      });
      setLeadFormFor(null);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Campaigns & Leads</h2>
          <div className="sub">Create outbound campaigns, upload leads, and launch dialers</div>
        </div>
      </div>

      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        {/* ── Create form ── */}
        <Card title="New campaign">
          <label className="lbl">Campaign name</label>
          <input
            className="input"
            placeholder="e.g. Diwali Offer — Oct batch"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="lbl">Agent name</label>
          <input
            className="input"
            placeholder="e.g. Priya"
            value={agent.name}
            onChange={(e) => setAgent({ ...agent, name: e.target.value })}
          />
          <label className="lbl">Primary language</label>
          <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
            {Object.entries(LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <label className="lbl">Agent requirements</label>
          <textarea
            className="input"
            style={{ height: 120, resize: "vertical" }}
            value={agent.requirements}
            onChange={(e) => setAgent({ ...agent, requirements: e.target.value })}
          />
          <Button
            variant="primary"
            block
            onClick={create}
            disabled={busy}
            style={{ marginTop: 16 }}
          >
            {busy ? <span className="spinner" /> : "🚀 Create campaign"}
          </Button>
        </Card>

        {/* ── Campaign list ── */}
        <section>
          {campaigns.length === 0 ? (
            <Card>
              <EmptyState
                icon="🗂️"
                title="No campaigns yet"
                sub="Create your first campaign on the left — then add leads and press Start."
              />
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {campaigns.map((c) => {
                const stats = (c.stats ?? {}) as CampaignStats;
                const by = stats.by_status ?? {};
                const total = stats.total ?? 0;
                const done =
                  (by.completed ?? 0) + (by.failed ?? 0) + (by.dnd ?? 0) + (by.skipped ?? 0);
                const pct = total > 0 ? (done / total) * 100 : 0;
                const runningDialer = stats.dialer_running === true;

                return (
                  <Card key={c.id}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: "pointer" }}
                      onClick={() => navigate(`campaigns/${c.id}`)}
                    >
                      <StatusBadge status={c.status} />
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                      <LangPill code={c.languages?.[0]} />
                      {c.status === "running" && (
                        <Badge tone={runningDialer ? "green" : "red"}>
                          ● dialer {runningDialer ? "live" : "stopped"}
                        </Badge>
                      )}
                      <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        {c.status !== "running" ? (
                          <Button size="sm" variant="primary" disabled={busy} onClick={() => act(c, "start")}>
                            ▶ Start
                          </Button>
                        ) : (
                          <Button size="sm" disabled={busy} onClick={() => act(c, "pause")}>
                            ⏸ Pause
                          </Button>
                        )}
                        <a className="btn sm" href={api.exportCsv(c.id)} download>
                          ⬇ CSV
                        </a>
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => act(c, "delete")}>
                          🗑
                        </Button>
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 200px", minWidth: 180 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                          <span style={{ color: "var(--text-muted)" }}>Progress</span>
                          <span style={{ color: "var(--text)" }}>
                            {done}/{total} done
                          </span>
                        </div>
                        <Progress value={pct} />
                        <div style={{ display: "flex", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
                          {Object.entries(by).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                              {k}: <b style={{ color: "var(--text)" }}>{v}</b>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.8 }}>
                        <div>
                          👤 Agent: <b style={{ color: "var(--text)" }}>{c.agent?.name ?? "—"}</b>
                        </div>
                        <div>
                          📞 Calls:{" "}
                          {stats.calls && Object.keys(stats.calls).length
                            ? Object.entries(stats.calls)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" · ")
                            : "none yet"}
                        </div>
                        <div>
                          🕐 Created: {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: "1px dashed var(--border-soft)",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <Button size="sm" onClick={() => openLeadForm(c)}>
                        {leadFormFor === c.id ? "✕ Close form" : "➕ Add leads"}
                      </Button>
                      <Button size="sm" onClick={() => navigate(`campaigns/${c.id}`)}>
                        📂 Open details (CSV upload)
                      </Button>
                    </div>

                    {leadFormFor === c.id && (
                      <div style={{ marginTop: 12, borderTop: "1px dashed var(--border-soft)", paddingTop: 12 }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1.1fr 0.8fr 2fr auto",
                            gap: 6,
                            marginBottom: 6,
                            fontSize: 11,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          <span>Name</span>
                          <span>Phone</span>
                          <span>Language</span>
                          <span>Guidelines for agent</span>
                          <span />
                        </div>
                        {rows.map((r, i) => (
                          <div
                            key={i}
                            style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 0.8fr 2fr auto", gap: 6, marginBottom: 6 }}
                          >
                            <input className="input" style={{ padding: 7 }} placeholder="Amit Sharma" value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
                            <input className="input" style={{ padding: 7 }} placeholder="98765 43210" value={r.phone} onChange={(e) => updateRow(i, { phone: e.target.value })} />
                            <select className="select" style={{ padding: 7 }} value={r.language} onChange={(e) => updateRow(i, { language: e.target.value })}>
                              {Object.entries(LANGUAGES).map(([code, label]) => (
                                <option key={code} value={code}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <input className="input" style={{ padding: 7 }} placeholder="already visited once, offer 10% off…" value={r.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} />
                            <Button size="sm" variant="ghost" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                              ✕
                            </Button>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <Button size="sm" onClick={() => setRows((rs) => [...rs, newRow(c.languages[0] ?? "hi")])}>
                            ➕ Another lead
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={busy || rows.every((r) => !r.phone.trim())}
                            onClick={saveLeads}
                          >
                            💾 Save leads
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}