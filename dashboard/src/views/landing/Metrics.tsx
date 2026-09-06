import { motion } from "framer-motion";
import type { RefObject } from "react";

const METRICS = [
  { value: "₹0", label: "self-hosted STT · TTS · VAD" },
  { value: "13+", label: "Indian languages + Hinglish, auto-switched" },
  { value: "6", label: "ready-made agent tools — booking, callback, DND" },
  { value: "100", label: "AI lead score after every call" },
  { value: "2", label: "call transports — browser WS + Asterisk/SIP" },
  { value: "9–21", label: "TRAI-compliant calling window, enforced" },
];

const COMPLIANCE = [
  "🛡️ DND scrubbing hook before every dial",
  "🚫 One-tap opt-out tool the agent can invoke",
  "🤝 AI disclosure baked into agent prompts",
  "🔒 Consent-aware recordings & transcripts",
];

export default function Metrics({ ref_ }: { ref_: RefObject<HTMLDivElement> }) {
  return (
    <section className="section metrics" id="metrics" ref={ref_}>
      <div className="metrics-band">
        <motion.div
          className="sec-head on-dark"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <span className="sec-eyebrow">Cost & compliance</span>
          <h2 className="sec-title">
            Enterprise-grade dialing, <span className="grad">startup-friendly cost</span>
          </h2>
          <p className="sec-sub">
            The only unavoidable expense is the licensed SIP trunk for real
            Indian mobiles. Nothing else is paid, metered or rate-limited by a
            third-party API.
          </p>
        </motion.div>

        <div className="metric-grid">
          {METRICS.map((m, i) => (
            <motion.div
              className="metric-cell"
              key={m.value}
              initial={{ opacity: 0, rotateX: 55 }}
              whileInView={{ opacity: 1, rotateX: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: (i % 3) * 0.08 }}
              style={{ transformPerspective: 800, transformOrigin: "top center" }}
            >
              <b className="metric-value grad">{m.value}</b>
              <span className="metric-label">{m.label}</span>
            </motion.div>
          ))}
        </div>

        <motion.ul
          className="compliance"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {COMPLIANCE.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}