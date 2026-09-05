import { LANGUAGES } from "../../api";
import { Avatar } from "../../components";
import { useCallEngine } from "./useCallEngine";

type Engine = ReturnType<typeof useCallEngine>;

/** Live call chrome shown once the call is dialing/ringing/connected. */
export function LiveCallPanel({ e }: { e: Engine }) {
  const { phase, name, mm, ss, speakingNow, selectedAgent, lang, error, agents, listening } = e;
  const agent =
    selectedAgent ??
    agents?.find((a) => a.name === name) ??
    null;

  return (
    <div style={{ textAlign: "center", padding: "2px 0 6px" }}>
      <div
        className="call-ring"
        style={{
          width: 74,
          height: 74,
          margin: "0 auto 6px",
          animation: speakingNow ? "rings 1.1s ease-out infinite" : "rings 1.8s ease-out infinite",
        }}
      >
        <Avatar name={name} avatar={agent?.avatar} accent={agent?.accent} size={66} />
      </div>

      <div style={{ fontWeight: 750, fontSize: 17, display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
        {name}
        {speakingNow ? (
          <span className="wave" style={{ color: "var(--green)" }}>
            <i /><i /><i /><i />
          </span>
        ) : phase === "connected" ? (
          <span className="dot green" />
        ) : null}
      </div>

      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
        {LANGUAGES[lang] ?? lang} · {agent?.specialization ?? "Custom agent"}
      </div>

      <div className="call-timer" style={{ fontSize: 21, margin: "7px 0 4px", letterSpacing: 1.5 }}>
        {mm}:{ss}
      </div>

      {listening && (
        <div className="badge blue" style={{ marginTop: 6 }}>
          <span className="wave" style={{ color: "inherit" }}><i /><i /><i /></span>
          listening… speak now
        </div>
      )}
      {error && <div className="msg err" style={{ fontSize: 12 }}>{error}</div>}
    </div>
  );
}
