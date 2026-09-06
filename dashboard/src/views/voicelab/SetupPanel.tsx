import { Button } from "../../components";
import { LANGUAGES } from "../../api";
import { PRESETS, useCallEngine } from "./useCallEngine";

type Engine = ReturnType<typeof useCallEngine>;

/** Left-hand card shown before/after a call: agent picker + number + options. */
export function SetupPanel({ e }: { e: Engine }) {
  const {
    selectedAgent, presetAgent, agents, phone, setPhone, typing, setTyping, lang, setLang,
    voiceSupported, ttsSupported, speakOn, setSpeak,
  } = e;

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

      <label className="lbl" style={{ marginTop: 12 }}>Agent language</label>
      <select className="select" value={lang} onChange={(ev) => setLang(ev.target.value)}>
        {Object.entries(LANGUAGES).map(([code, label]) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          className={`btn ${!typing ? "primary" : ""}`}
          style={{ flex: 1 }}
          onClick={() => setTyping(false)}
          disabled={!voiceSupported}
          title={voiceSupported ? "Speak — your voice is transcribed live" : "Voice input needs Chrome or Edge"}
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
      {!typing && !voiceSupported && (
        <div className="msg err" style={{ marginTop: 8, fontSize: 12 }}>
          Voice input needs Chrome/Edge (Web Speech API). Please type instead, or plug a real STT backend.
        </div>
      )}
      {!typing && voiceSupported && (
        <div className="msg ok" style={{ marginTop: 8, fontSize: 12 }}>
          🎙 Your voice is transcribed live in the browser and the agent replies by speaking.
        </div>
      )}
      {ttsSupported && (
        <button
          className="btn sm"
          style={{ marginTop: 8 }}
          onClick={() => setSpeak(!speakOn)}
          title="Read agent replies aloud with the browser voice"
        >
          {speakOn ? "🔊 Agent replies spoken aloud" : "🔇 Agent replies muted"}
        </button>
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
        Agent will speak in {LANGUAGES[lang] ?? lang} unless the caller switches script.
      </div>
    </div>
  );
}
