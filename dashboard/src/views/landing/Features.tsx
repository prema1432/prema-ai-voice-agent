import { motion } from "framer-motion";
import type { RefObject } from "react";
import Tilt from "./Tilt";

const FEATURES = [
  {
    icon: "📋",
    title: "Outbound campaigns",
    body: "Agent personas, languages, concurrency and schedules. The dialer enforces TRAI calling hours, DND scrubbing, retries and caps — out of the box.",
  },
  {
    icon: "🎤",
    title: "Voice Lab",
    body: "Talk to an agent live in your browser — real voice in, real voice out, with barge-in. The fastest way to tune a persona before phone calls.",
  },
  {
    icon: "🗂",
    title: "CRM pipeline",
    body: "Drag-and-drop lead board per campaign — New → Contacted → Qualified → Proposal → Won/Lost. Terminal stages close the lead automatically.",
  },
  {
    icon: "🤖",
    title: "Agent directory",
    body: "Reusable Indian-named personas with specializations, accents, ratings and completed-lead stats. One persona powers many campaigns.",
  },
  {
    icon: "🧠",
    title: "LLM & cost",
    body: "OpenRouter model catalog with free tiers, per-call token spend and per-model analytics. Auto-rotates to a working model on 429s.",
  },
  {
    icon: "📝",
    title: "Forms & workflows",
    body: "Multi-step forms with dynamic fields, formulas and actions — email, SMS/WhatsApp events, CRM updates — published to a public clean URL.",
  },
  {
    icon: "🔌",
    title: "Integrations & alerts",
    body: "Webhooks, WhatsApp, SMS, email and push notifications delivered through a FIFO worker with per-channel delivery logs.",
  },
  {
    icon: "🧾",
    title: "Audit trail",
    body: "Append-only history of every campaign, lead, CRM move, LLM change and form action — searchable, filterable, accountable.",
  },
];

const FADE = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

export default function Features({ ref_ }: { ref_: RefObject<HTMLDivElement> }) {
  return (
    <section className="section features" id="features" ref={ref_}>
      <motion.div
        className="sec-head"
        initial={FADE.hidden}
        whileInView={FADE.show}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
      >
        <span className="sec-eyebrow">The platform</span>
        <h2 className="sec-title">
          Everything a voice-call operation needs, <span className="grad">self-hosted</span>
        </h2>
        <p className="sec-sub">
          Campaigns, live testing, CRM, forms, integrations and audit — one
          dashboard, one MongoDB, your infrastructure.
        </p>
      </motion.div>

      <div className="feat-grid">
        {FEATURES.map((f, i) => (
          <motion.article
            key={f.title}
            className="feat-card"
            initial={{ opacity: 0, rotateY: -18, y: 24 }}
            whileInView={{ opacity: 1, rotateY: 0, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.55, delay: (i % 4) * 0.08 }}
            style={{ transformPerspective: 900 }}
          >
            <Tilt className="feat-tilt">
              <span className="feat-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </Tilt>
          </motion.article>
        ))}
      </div>
    </section>
  );
}