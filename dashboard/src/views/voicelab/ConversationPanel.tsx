import { LANGUAGES } from "../../api";
import { Avatar, Button, Card } from "../../components";
import { useCallEngine } from "./useCallEngine";

type Engine = ReturnType<typeof useCallEngine>;

/** Live conversation: header, transcript bubbles, typing/mic input bar. */
export function ConversationPanel({ e }: { e: Engine }) {
  const { phase, name, mm, ss, turns, typing, sending, speakingNow, transRef, selectedAgent, agents } = e;
  const agent =
    selectedAgent ??
    agents?.find((a) => a.name === name) ??
    null;
  const connected = phase === "connected";

  return (
    <Card title={undefined} style={{ display: "flex", flexDirection: "column", minHeight: 540 }}>
      {/* conversation header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          paddingBottom: 12, borderBottom: "1px solid var(--border)", marginBottom: 12,
        }}
      >
        <Avatar name={name} avatar={agent?.avatar} accent={agent?.accent} size={36} />
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{name}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {connected ? (
              <>
                <span className="dot green" style={{ marginRight: 5 }} />
                On call · {mm}:{ss} · {LANGUAGES[e.lang] ?? e.lang}
              </>
            ) : (
              <>{phase === "ended" ? "Call finished" : "Not on a call"}{agent ? ` · ${agent.specialization}` : ""}</>
            )}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {connected && !typing && (
            <span className="dot green pulse-dot" title={e.listening ? "Listening to you…" : "Mic ready"} />
          )}
          {speakingNow && (
            <span className="badge green" style={{ animation: "fadeIn .3s ease" }}>
              <span className="wave"><i /><i /><i /></span> speaking
            </span>
          )}
          {sending && <span className="spinner" style={{ width: 14, height: 14 }} />}
        </div>
      </div>

      {/* transcript */}
      <div
        className="transcript"
        ref={transRef}
        style={{ flex: 1, minHeight: 330, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}
      >
        {turns.length === 0 && !connected ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>📞</div>
            <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>
              {phase === "dialing" ? "Dialing the number…" : phase === "ringing" ? "Ringing…" : "The conversation appears here"}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>Dial, wait for {name} to answer, then type or speak.</div>
          </div>
        ) : (
          <>
            {turns.map((t, i) => (
              <div key={i} className={`bubble ${t.role === "agent" ? "agent" : "user"}`}>
                <div className="meta">
                  {t.role === "agent" ? name : "You"}{" "}
                  {t.language ? ` · ${LANGUAGES[t.language] ?? t.language}` : ""}
                </div>
                {t.text}
              </div>
            ))}
            {speakingNow && (
              <div className="bubble agent" style={{ opacity: 0.85 }}>
                <div className="meta">{name}</div>
                <span className="wave" style={{ color: "var(--text-muted)" }}>
                  <i /><i /><i /><i />
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* input bar */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          className="input"
          placeholder={
            connected
              ? typing
                ? "Type your reply — e.g. 'haan boliye' or 'నమస్తే, వివరాలు చెప్పండి'"
                : "Speak into the mic…"
              : "Start a call first"
          }
          value={e.input}
          disabled={!connected}
          onChange={(ev) => e.setInput(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") e.sendText();
          }}
        />
        <Button variant="primary" onClick={e.sendText} disabled={!connected || !e.input.trim()}>
          ➤ Send
        </Button>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 10, lineHeight: 1.6 }}>
        {!connected
          ? "This simulated call uses the same agent, LLM (OpenRouter) and tool pipeline as a real outbound call."
          : typing
            ? e.ttsSupported
              ? "Typing mode — your text goes through the same LLM reply & tool path as speech, and the agent's replies are read aloud."
              : "Typing mode — your text goes through the exact same LLM reply & tool path as spoken words."
            : "Speak mode — your voice is transcribed live in the browser and sent to the same LLM. Use headphones to avoid echo."}
      </div>
    </Card>
  );
}
