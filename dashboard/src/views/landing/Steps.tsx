import { motion } from "framer-motion";
import type { RefObject } from "react";

const STEPS = [
  {
    num: "01",
    icon: "🧩",
    title: "Create a campaign",
    body: "Pick an agent persona, languages, concurrency and schedule. Every setting is a form — no config files.",
  },
  {
    num: "02",
    icon: "📤",
    title: "Load leads",
    body: "Upload a CSV (phone, name, language, city, interest) or capture leads through a published form. Duplicates are scrubbed automatically.",
  },
  {
    num: "03",
    icon: "🚀",
    title: "Press Start",
    body: "The dialer enforces TRAI calling hours, DND scrubbing, retries and concurrency limits while agents handle each conversation.",
  },
  {
    num: "04",
    icon: "📈",
    title: "Watch it work",
    body: "Transcripts, outcomes, barge-ins, CRM stage moves and LLM cost stream into the dashboard in real time.",
  },
];

export default function Steps({ ref_ }: { ref_: RefObject<HTMLDivElement> }) {
  return (
    <section className="section steps" id="steps" ref={ref_}>
      <motion.div
        className="sec-head"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
      >
        <span className="sec-eyebrow">Get started</span>
        <h2 className="sec-title">
          From zero to your <span className="grad">first AI call</span> in minutes
        </h2>
        <p className="sec-sub">
          Browser-only mode works with zero telephony setup — mock STT/TTS keep
          the whole loop testable before you plug in speech models.
        </p>
      </motion.div>

      <div className="steps-grid">
        {STEPS.map((s, i) => (
          <motion.article
            className="step-card"
            key={s.num}
            initial={{ opacity: 0, rotateY: i % 2 ? 18 : -18, y: 24 }}
            whileInView={{ opacity: 1, rotateY: 0, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.55, delay: i * 0.1 }}
            style={{ transformPerspective: 900 }}
          >
            <span className="step-num">{s.num}</span>
            <span className="step-icon">{s.icon}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}