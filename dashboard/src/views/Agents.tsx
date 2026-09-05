import { useEffect, useMemo, useState } from "react";
import { AgentDirectoryItem, AgentMeta, LANGUAGES, api } from "../api";
import { Avatar, Badge, Button, Card, EmptyState, LangPill, Stars } from "../components";
import { navigate } from "../router";

export default function Agents() {
  const [agents, setAgents] = useState<AgentDirectoryItem[] | null>(null);
  const [meta, setMeta] = useState<AgentMeta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [specFilter, setSpecFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setErr(null);
    api.listAgents().then(setAgents).catch((e) => setErr(String(e)));
  };

  useEffect(() => {
    load();
    api.agentMeta().then(setMeta).catch(() => {});
  }, []);

  const specs = useMemo(() => {
    const s = new Set<string>((meta?.specializations ?? []).slice());
    agents?.forEach((a) => a.specialization && s.add(a.specialization));
    return Array.from(s).sort();
  }, [meta, agents]);

  const filtered = useMemo(() => {
    if (!agents) return [];
    const needle = q.trim().toLowerCase();
    return agents.filter((a) => {
      if (specFilter && a.specialization !== specFilter) return false;
      if (!needle) return true;
      return (
        a.name.toLowerCase().includes(needle) ||
        (a.specialization ?? "").toLowerCase().includes(needle) ||
        (a.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [agents, q, specFilter]);

  const totalLeads = agents?.reduce((s, a) => s + (a.stats?.leads_completed ?? 0), 0) ?? 0;
  const avgRating = agents?.length
    ? agents.reduce((s, a) => s + (a.stats?.rating ?? 0), 0) / agents.length
    : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🤖 Agent Team</h2>
          <div className="sub">Create and manage your voice agents — each with its own persona, language and specialization</div>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          ➕ New agent
        </Button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Card style={{ borderTop: "3px solid var(--accent-1)" }}>
          <div className="value" style={{ fontSize: 26, fontWeight: 750 }}>{agents?.length ?? "…"}</div>
          <div className="sub" style={{ color: "var(--text-muted)", fontSize: 12 }}>Agents on the team</div>
        </Card>
        <Card style={{ borderTop: "3px solid var(--green)" }}>
          <div className="value" style={{ fontSize: 26, fontWeight: 750 }}>{totalLeads}</div>
          <div className="sub" style={{ color: "var(--text-muted)", fontSize: 12 }}>Leads completed</div>
        </Card>
        <Card style={{ borderTop: "3px solid #f59e0b" }}>
          <div className="value" style={{ fontSize: 26, fontWeight: 750 }}>{avgRating ? avgRating.toFixed(1) : "—"}</div>
          <div className="sub" style={{ color: "var(--text-muted)", fontSize: 12 }}>Average rating</div>
        </Card>
        <Card style={{ borderTop: "3px solid var(--accent-3)" }}>
          <div className="value" style={{ fontSize: 26, fontWeight: 750 }}>{specs.length}</div>
          <div className="sub" style={{ color: "var(--text-muted)", fontSize: 12 }}>Specializations</div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "18px 0 16px" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200, maxWidth: 340 }}
          placeholder="Search name, specialization…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" style={{ width: "auto" }} value={specFilter} onChange={(e) => setSpecFilter(e.target.value)}>
          <option value="">All specializations</option>
          {specs.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {err && <div className="msg err">{err}</div>}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon="🤖" title="No agents yet" sub="Create your first agent — pick a name, gender and specialization." />
        </Card>
      ) : (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))", gap: 16 }}>
          {filtered.map((a) => {
            const st = a.stats;
            return (
              <div className="card agent-card" key={a.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
                  <div className="call-ring" style={{ width: 52, height: 52 }}>
                    <Avatar name={a.name} avatar={a.avatar} accent={a.accent} size={46} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5, display: "flex", alignItems: "center", gap: 7 }}>
                      {a.name}
                      <span className={`gender-tag ${a.gender}`}>{a.gender}</span>
                    </div>
                    <div style={{ marginTop: 3 }}>
                      <Badge tone="blue">{a.specialization}</Badge>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 12.5, color: "var(--text-muted)", minHeight: 36, lineHeight: 1.5 }}>
                  {a.description || (a.requirements || "").slice(0, 110) || "Friendly professional voice agent."}
                  {!a.description && (a.requirements?.length ?? 0) > 110 ? "…" : ""}
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <LangPill code={a.primary_language} />
                </div>

                <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    ✅ {st?.leads_completed ?? 0} leads · 📞 {st?.calls ?? 0} calls
                  </div>
                  <Stars rating={st?.rating ?? 3.0} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Button size="sm" style={{ flex: 1 }} onClick={() => navigate(`voicelab/${encodeURIComponent(a.id)}`)}>
                    🎤 Call agent
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    style={{ flex: 0 }}
                    title="Delete agent"
                    onClick={async () => {
                      if (!window.confirm(`Delete agent ${a.name}?`)) return;
                      await api.deleteAgent(a.id).catch((e) => setErr(String(e)));
                      load();
                    }}
                  >
                    🗑
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateAgentModal
          meta={meta}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ── Create-agent modal ─────────────────────────────────── */
function CreateAgentModal({
  meta,
  onClose,
  onCreated,
}: {
  meta: AgentMeta | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const defaults = meta ?? {
    specializations: ["Telecalling", "Customer Support", "Sales / Closing", "Lead Generation", "Information Desk"],
    sample_names: { male: ["Arjun", "Rohan", "Kabir", "Aarav"], female: ["Priya", "Ananya", "Diya", "Meera"] },
    accents: ["indigo", "violet", "cyan", "green", "amber", "red"],
  };

  const [gender, setGender] = useState<"male" | "female">("female");
  const [name, setName] = useState("");
  const [spec, setSpec] = useState(defaults.specializations[0] ?? "");
  const [customSpec, setCustomSpec] = useState(false);
  const [customSpecValue, setCustomSpecValue] = useState("");
  const [lang, setLang] = useState("te");
  const [accent, setAccent] = useState("indigo");
  const [desc, setDesc] = useState("");
  const [requirements, setRequirements] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const samples = gender === "male" ? defaults.sample_names.male : defaults.sample_names.female;

  const effectiveName = name.trim();

  async function submit() {
    if (!effectiveName) {
      setErr("Pick or type an agent name");
      return;
    }
    const finalSpec = customSpec ? customSpecValue.trim() || spec : spec;
    setBusy(true);
    setErr(null);
    try {
      const voice = lang !== "te" ? { language: lang } : {};
      await api.createAgent({
        name: effectiveName,
        gender,
        specialization: finalSpec || "Telecalling",
        accent,
        description: desc.trim() || `A ${gender} ${finalSpec.toLowerCase() || "voice"} agent.`,
        requirements:
          requirements.trim() ||
          `You are ${effectiveName}, a ${finalSpec.toLowerCase() || "voice"} agent. Be warm, polite and clear. Introduce yourself, listen carefully, and confirm before any commitment.`,
        primary_language: lang,
        fallback_languages: ["hinglish", "en"],
        auto_language_switch: true,
        tools_enabled: ["book_appointment", "set_callback", "end_call", "opt_out_dnd"],
        voice,
        max_call_seconds: 300,
      });
      onCreated();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="card pop" style={{ maxWidth: 560, width: "100%", maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h3>➕ Create a new agent</h3>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>

        {/* gender */}
        <label className="lbl">Agent gender</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["female", "male"] as const).map((g) => (
            <button
              key={g}
              className={`btn ${gender === g ? "primary" : ""}`}
              style={{ flex: 1 }}
              onClick={() => {
                setGender(g);
                setName("");
              }}
            >
              {g === "female" ? "👩 Female" : "👨 Male"}
            </button>
          ))}
        </div>

        {/* name */}
        <label className="lbl">Name</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {samples.map((n) => (
            <button
              key={n}
              className={`btn sm ${name === n ? "primary" : ""}`}
              onClick={() => setName(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder={`Type a name… (${gender === "female" ? "e.g. Lakshmi" : "e.g. Vikram"})`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* specialization */}
        <label className="lbl">Specialization</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {defaults.specializations.map((s) => (
            <button
              key={s}
              className={`btn sm ${!customSpec && spec === s ? "primary" : ""}`}
              onClick={() => {
                setSpec(s);
                setCustomSpec(false);
              }}
            >
              {s}
            </button>
          ))}
          <button className={`btn sm ${customSpec ? "primary" : ""}`} onClick={() => setCustomSpec((v) => !v)}>
            ✏️ Custom…
          </button>
        </div>
        {customSpec && (
          <input
            className="input"
            placeholder="e.g. Loan Recovery, Appointment Setter, Follow-up, Complaint Desk…"
            value={customSpecValue}
            onChange={(e) => setCustomSpecValue(e.target.value)}
            autoFocus
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="lbl">Speaks (primary)</label>
            <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Avatar color</label>
            <div style={{ display: "flex", gap: 7, marginTop: 7 }}>
              {defaults.accents.map((ac) => (
                <button
                  key={ac}
                  title={ac}
                  onClick={() => setAccent(ac)}
                  style={{
                    width: 24, height: 24, borderRadius: "50%", cursor: "pointer", border: "none",
                    background:
                      ac === "indigo" ? "linear-gradient(135deg,#6366f1,#4338ca)"
                      : ac === "violet" ? "linear-gradient(135deg,#8b5cf6,#6d28d9)"
                      : ac === "cyan" ? "linear-gradient(135deg,#0ea5e9,#0369a1)"
                      : ac === "green" ? "linear-gradient(135deg,#10b981,#047857)"
                      : ac === "amber" ? "linear-gradient(135deg,#f59e0b,#b45309)"
                      : "linear-gradient(135deg,#ef4444,#b91c1c)",
                    outline: accent === ac ? "2px solid var(--text)" : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <label className="lbl">Description (shown on the team card)</label>
        <textarea
          className="input"
          style={{ height: 54, resize: "vertical" }}
          placeholder="e.g. A patient Telugu-speaking support agent who handles refunds…"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />

        <label className="lbl">Call instructions / goals (what the agent should do on calls)</label>
        <textarea
          className="input"
          style={{ height: 76, resize: "vertical" }}
          placeholder="e.g. Qualify the lead's budget, offer the Diwali discount and try to close…"
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
        />

        {err && <div className="msg err" style={{ marginTop: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={submit}>
            {busy ? <><span className="spinner" /> Creating…</> : "✨ Create agent"}
          </Button>
        </div>
      </div>
    </div>
  );
}
