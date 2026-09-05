import { useCallback, useEffect, useState } from "react";
import { api, Campaign, LANGUAGES } from "../api";

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

type LeadRow = { name: string; phone: string; language: string; notes: string };

const newRow = (language: string): LeadRow => ({ name: "", phone: "", language, notes: "" });

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("Diwali Offer — Oct batch");
  const [agent, setAgent] = useState(emptyAgent);
  const [lang, setLang] = useState("hi");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [leadFormFor, setLeadFormFor] = useState<string | null>(null);
  const [rows, setRows] = useState<LeadRow[]>([]);

  const load = useCallback(async () => {
    try {
      setCampaigns(await api.listCampaigns());
    } catch (e) {
      setMsg(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // live status refresh
    return () => clearInterval(t);
  }, [load]);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.createCampaign({
        name,
        languages: [lang],
        dial_provider: "mock",
        agent: { ...agent, primary_language: lang },
      });
      setMsg(`Campaign created (${res.id}). Upload leads below.`);
      await load();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadCsv(c: Campaign, file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.uploadCsv(c.id, file);
      setMsg(
        `${c.name}: +${res.added} leads (${res.updated} updated, ` +
          `${res.dnd_skipped} DND skipped, ${res.invalid.length} invalid)`,
      );
      await load();
    } catch (e) {
      setMsg(String(e));
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
      await load();
    } catch (e) {
      setMsg(String(e));
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
      setMsg(
        `Added ${res.added} lead(s) (${res.updated} updated, ` +
          `${res.dnd_skipped} DND skipped, ${res.invalid.length} invalid phone number(s)` +
          (res.invalid.length ? `: ${res.invalid.join(", ")}` : ")"),
      );
      setLeadFormFor(null);
      await load();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  const btn = {
    padding: "4px 10px",
    border: "1px solid #ccc",
    background: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>
      <section>
        <h3 style={{ marginBottom: 8 }}>New campaign</h3>
        <label style={styles.lbl}>Name</label>
        <input style={styles.inp} value={name} onChange={(e) => setName(e.target.value)} />

        <label style={styles.lbl}>Agent name</label>
        <input
          style={styles.inp}
          value={agent.name}
          onChange={(e) => setAgent({ ...agent, name: e.target.value })}
        />

        <label style={styles.lbl}>Primary language</label>
        <select style={styles.inp} value={lang} onChange={(e) => setLang(e.target.value)}>
          {Object.entries(LANGUAGES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>

        <label style={styles.lbl}>Requirements (natural language)</label>
        <textarea
          style={{ ...styles.inp, height: 110 }}
          value={agent.requirements}
          onChange={(e) => setAgent({ ...agent, requirements: e.target.value })}
        />

        <button style={{ ...btn, width: "100%", padding: 9, marginTop: 12 }} disabled={busy} onClick={create}>
          Create campaign
        </button>
      </section>

      <section>
        <h3 style={{ marginBottom: 8 }}>Campaigns</h3>
        {msg && <p style={{ background: "#f4f9f4", padding: 8, borderRadius: 6, fontSize: 13 }}>{msg}</p>}
        {campaigns.length === 0 && <p style={{ color: "#777" }}>No campaigns yet — create one on the left.</p>}
        {campaigns.map((c) => {
          const stats = (c.stats ?? {}) as unknown as {
            total?: number;
            by_status?: Record<string, number>;
            by_outcome?: Record<string, number>;
            calls?: Record<string, number>;
            dialer_running?: boolean;
          };
          const by = stats.by_status ?? {};
          const total = stats.total ?? 0;
          const done = (by.completed ?? 0) + (by.failed ?? 0) + (by.dnd ?? 0) + (by.skipped ?? 0);
          const runningDialer = stats.dialer_running === true;
          return (
            <div key={c.id} style={{ border: "1px solid #e2e2e2", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <strong>{c.name}</strong>
                <span
                  style={{
                    fontSize: 12,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: c.status === "running" ? "#e6f7e6" : c.status === "paused" ? "#fff6e0" : "#eee",
                  }}
                >
                  {c.status}
                </span>
                {c.status === "running" && (
                  <span
                    style={{
                      fontSize: 12,
                      color: runningDialer ? "#0a7" : "#b00",
                      fontWeight: 600,
                    }}
                    title={
                      runningDialer
                        ? "Dialer is actively processing this campaign"
                        : "Dialer not attached — click Start to (re)launch it"
                    }
                  >
                    ● dialer {runningDialer ? "live" : "stopped"}
                  </span>
                )}
                <span style={{ fontSize: 12, color: "#666" }}>{LANGUAGES[c.languages[0]] ?? c.languages[0]}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {c.status !== "running" ? (
                    <button style={btn} disabled={busy} onClick={() => act(c, "start")}>
                      ▶ Start
                    </button>
                  ) : (
                    <button style={btn} disabled={busy} onClick={() => act(c, "pause")}>
                      ⏸ Pause
                    </button>
                  )}
                  <a style={btn} href={api.exportCsv(c.id)} download>
                    ⬇ Export CSV
                  </a>
                  <button style={btn} disabled={busy} onClick={() => act(c, "delete")}>
                    🗑
                  </button>
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 8 }}>
                Agent: {c.agent?.name ?? "—"} · Leads: {total}
                {Object.entries(by).map(([k, v]) => ` · ${k}: ${v}`)}
                {stats.calls && Object.entries(stats.calls).length
                  ? Object.entries(stats.calls).map(([k, v]) => ` · calls ${k}: ${v}`)
                  : ""}
              </div>
              {total > 0 && (
                <div style={{ marginTop: 8, background: "#eee", borderRadius: 99, height: 8, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((done / total) * 100))}%`,
                      background: "#0a7",
                      height: "100%",
                      transition: "width 0.5s",
                    }}
                  />
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && uploadCsv(c, e.target.files[0])}
                />
                <span style={{ fontSize: 12, color: "#888" }}> — bulk CSV with a `phone` column (name, language optional)</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <button style={btn} disabled={busy} onClick={() => openLeadForm(c)}>
                  {leadFormFor === c.id ? "✕ Close form" : "➕ Add leads by form"}
                </button>
                <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>
                  for a few leads — name, phone, language + special instructions for the agent
                </span>
              </div>
              {leadFormFor === c.id && (
                <div style={{ marginTop: 10, borderTop: "1px dashed #ddd", paddingTop: 10 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1.2fr 0.9fr 2.2fr auto",
                      gap: 6,
                      marginBottom: 4,
                      fontSize: 11,
                      color: "#777",
                    }}
                  >
                    <span>Name</span>
                    <span>Phone (91XXXXXXXXXX)</span>
                    <span>Language</span>
                    <span>Notes / guidelines for the agent (optional)</span>
                    <span />
                  </div>
                  {rows.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1.2fr 0.9fr 2.2fr auto",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <input
                        style={styles.inpSm}
                        placeholder="e.g. Amit Sharma"
                        value={r.name}
                        onChange={(e) => updateRow(i, { name: e.target.value })}
                      />
                      <input
                        style={styles.inpSm}
                        placeholder="98765 43210"
                        value={r.phone}
                        onChange={(e) => updateRow(i, { phone: e.target.value })}
                      />
                      <select
                        style={styles.inpSm}
                        value={r.language}
                        onChange={(e) => updateRow(i, { language: e.target.value })}
                      >
                        {Object.entries(LANGUAGES).map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <input
                        style={styles.inpSm}
                        placeholder="e.g. already visited once, offer 10% discount, avoid calling after 8pm"
                        value={r.notes}
                        onChange={(e) => updateRow(i, { notes: e.target.value })}
                      />
                      <button
                        style={btn}
                        disabled={rows.length === 1}
                        onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button style={btn} onClick={() => setRows((rs) => [...rs, newRow(c.languages[0] ?? "hi")])}>
                      ➕ Another lead
                    </button>
                    <button
                      style={{ ...btn, background: "#0a7", color: "#fff", border: "none" }}
                      disabled={busy || rows.every((r) => !r.phone.trim())}
                      onClick={saveLeads}
                    >
                      💾 Save leads
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  lbl: { display: "block", fontSize: 12, color: "#555", margin: "10px 0 4px" },
  inp: {
    width: "100%",
    padding: 8,
    border: "1px solid #ccc",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  },
  inpSm: {
    width: "100%",
    padding: 6,
    border: "1px solid #ccc",
    borderRadius: 6,
    fontSize: 13,
    boxSizing: "border-box",
  },
};
