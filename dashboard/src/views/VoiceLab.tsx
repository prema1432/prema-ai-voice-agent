import { Button, StatusBadge } from "../components";
import { ConversationPanel } from "./voicelab/ConversationPanel";
import { LiveCallPanel } from "./voicelab/LiveCallPanel";
import { SetupPanel } from "./voicelab/SetupPanel";
import { useCallEngine } from "./voicelab/useCallEngine";

/**
 * Voice Lab — talk to one of your agents in a simulated phone call.
 * All logic lives in the useCallEngine hook; UI is split into small reusable
 * panels so no file in this page exceeds the 500-line guideline.
 */
export default function VoiceLab({ presetAgentId }: { presetAgentId?: string }) {
  const e = useCallEngine(presetAgentId);
  const { phase, callLabel } = e;
  const idle = phase === "idle" || phase === "ended";

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🎤 Voice Lab</h2>
          <div className="sub">Call one of your agents — simulated phone experience, same voice pipeline as real calls</div>
        </div>
        <StatusBadge
          status={phase === "connected" ? "running" : phase === "dialing" || phase === "ringing" ? "dialing" : phase === "ended" ? "completed" : "new"}
        />
      </div>

      <div className="grid-2" style={{ alignItems: "start", gridTemplateColumns: "minmax(0, 380px) 1fr" }}>
        {/* ── Left: phone chrome ─────────────────────────────── */}
        <div className="card pop" style={{ overflow: "hidden", padding: 0 }}>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.10))",
              borderBottom: "1px solid var(--border)",
              padding: "18px 18px 12px",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
              {idle ? (phase === "ended" ? "Call ended" : "Who are you calling?") : callLabel}
            </div>
            {idle ? <SetupPanel e={e} /> : <LiveCallPanel e={e} />}
          </div>

          {phase === "connected" && (
            <div style={{ padding: "12px 18px 18px", textAlign: "center" }}>
              <Button variant="danger" block onClick={e.hangUp}>
                ⏹ End call
              </Button>
            </div>
          )}
          {phase === "ended" && (
            <div style={{ padding: "0 18px 18px", textAlign: "center" }}>
              <Button block onClick={() => e.setPhase("idle")}>↺ Call again</Button>
            </div>
          )}

          <div
            style={{
              padding: "8px 16px",
              borderTop: "1px dashed var(--border)",
              fontSize: 11.5,
              color: "var(--text-faint)",
            }}
          >
            💡 Tip: real outbound calls need an Asterisk + SIP trunk. This lab simulates the same agent pipeline in
            your browser.
          </div>
        </div>

        {/* ── Right: conversation ───────────────────────────── */}
        <ConversationPanel e={e} />
      </div>
    </div>
  );
}
