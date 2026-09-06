import { motion } from "framer-motion";
import type { RefObject } from "react";

const STAGES = [
  { icon: "📱", label: "Call", body: "Asterisk/SIP to PSTN or browser WebSocket" },
  { icon: "🔊", label: "VAD", body: "Silero — energy fallback, barge-in aware" },
  { icon: "🗣️", label: "STT", body: "faster-whisper / IndicConformer, 22 languages" },
  { icon: "🧠", label: "LLM", body: "OpenRouter — persona + function tools" },
  { icon: "🔉", label: "TTS", body: "Piper / Indic-Parler-TTS, per-call voice" },
  { icon: "📝", label: "Record", body: "Transcript · summary · outcome · lead score" },
];

const TOOLS = [
  "book_appointment",
  "set_callback",
  "update_lead_status",
  "request_human_transfer",
  "opt_out_dnd",
  "end_call",
];

export default function Pipeline({ ref_ }: { ref_: RefObject<HTMLDivElement> }) {
  return (
    <section className="section pipeline" id="pipeline" ref={ref_}>
      <motion.div
        className="sec-head"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
      >
        <span className="sec-eyebrow">Under the hood</span>
        <h2 className="sec-title">
          One pipeline per call — <span className="grad">VAD → STT → LLM → TTS</span>
        </h2>
        <p className="sec-sub">
          Every call runs the same engine whether it lands on a phone or in the
          Voice Lab: speech detection, transcription, reasoning with tools, and
          a natural voice back — with caller barge-in at any moment.
        </p>
      </motion.div>

      <div className="pipe-track" role="list">
        {STAGES.map((s, i) => (
          <div className="pipe-step" role="listitem" key={s.label}>
            <motion.div
              className="pipe-node"
              initial={{ opacity: 0, rotateX: 70 }}
              whileInView={{ opacity: 1, rotateX: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              style={{ transformPerspective: 700, transformOrigin: "top center" }}
            >
              <span className="pipe-ic">{s.icon}</span>
              <b>{s.label}</b>
            </motion.div>
            <motion.p
              className="pipe-body"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.12 }}
            >
              {s.body}
            </motion.p>
            {i < STAGES.length - 1 && (
              <motion.span
                className="pipe-arrow"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: 0.35 + i * 0.12 }}
                aria-hidden
              >
                →
              </motion.span>
            )}
          </div>
        ))}
      </div>

      <motion.div
        className="tools"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <span className="tools-label">Agent tools wired into the LLM:</span>
        <div className="tools-chips">
          {TOOLS.map((t) => (
            <code key={t}>{t}</code>
          ))}
        </div>
      </motion.div>
    </section>
  );
}