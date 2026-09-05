import { Button } from "../../components";
import { PRESETS, useCallEngine } from "./useCallEngine";

type Engine = ReturnType<typeof useCallEngine>;

/** Left-hand card shown before/after a call: agent picker + number + options. */
export function SetupPanel({ e }: { e: Engine }) {
  const { selectedAgent, presetAgent, agents, phone, setPhone, typing, setTyping, lang } = e;

  return (
    <div style={{ textAlign: "left" }}>
      <label className="lbl" style={{ marginTop: 0 }}>Pick an agent</label>
      <select
        className="select"
        value={selectedAgent?.id ?? "__custom__"}
        onChange={(ev) => {
          if (ev.target.value === "__custom__") {
            e.setPresetAgent(null);
            e.setName("Priya");
          } else e.pickAgent(ev.target.value);
        }}
      >
        {agents?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.specialization} {a.gender === "female" ? "👩" : "👨"}
          </option>
        ))}
        {agents && agents.length > 0 && <option value="__custom__">✏️ Custom agent…</option>}
        {!agents && <option value="__custom__">Custom agent…</option>}
      </select>

      {!presetAgent && (
        <>
          <label className="lbl">Agent name</label>
          <input className="input" value={e.name} onChange={(ev) => e.setName(ev.target.value)} />
        </>
      )}

      <label className="lbl">Dial a number (mobile numbers will need a SIP trunk)</label>
      <input
        className="input"
        value={phone}
        style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", letterSpacing: 1 }}
        onChange={(ev) => setPhone(ev.target.value)}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {PRESETS.map((p) => (
          <button key={p.label} className="btn sm" onClick={() => setPhone(p.phone)}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          className={`btn ${!typing ? "primary" : ""}`}
          style={{ flex: 1 }}
          onClick={() => setTyping(false)}
          title="Speak through the mic — needs a real STT backend"
        >
          🎙 Speak
        </button>
        <button
          className={`btn ${typing ? "primary" : ""}`}
          style={{ flex: 1 }}
          onClick={() => setTyping(true)}
          title="Type your side of the conversation"
        >
          ⌨️ Type
        </button>
      </div>
      {!typing && (
        <div className="msg ok" style={{ marginTop: 8, fontSize: 12 }}>
          Mic mode needs a working STT backend. With <code>STT_BACKEND=mock</code> you'll hear silence — type instead.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Button variant="primary" block onClick={e.dial}>
          📞 Call now
        </Button>
      </div>

      <label className="lbl">Who are you calling?</label>
      <input
        className="input"
        placeholder="Lead name (optional)"
        value={e.leadName}
        onChange={(ev) => e.setLeadName(ev.target.value)}
      />
      <input
        className="input"
        style={{ marginTop: 7 }}
        placeholder="Notes / guidelines for the agent about this person"
        value={e.leadNotes}
        onChange={(ev) => e.setLeadNotes(ev.target.value)}
      />
      <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 10, lineHeight: 1.6 }}>
        Agent speaks {lang === "te" ? "Telugu" : lang.toUpperCase()} unless the caller switches script.
      </div>
    </div>
  );
}
