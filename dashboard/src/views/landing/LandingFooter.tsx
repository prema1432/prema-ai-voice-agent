import { motion, useReducedMotion } from "framer-motion";
import { navigate } from "../../router";

const APP_LINKS = [
  { label: "Dashboard", path: "app" },
  { label: "Campaigns", path: "campaigns" },
  { label: "Voice Lab", path: "voicelab" },
  { label: "CRM Board", path: "crm" },
  { label: "Call Logs", path: "calls" },
  { label: "LLM & Cost", path: "llm" },
  { label: "Forms", path: "forms" },
  { label: "Agents", path: "agents" },
  { label: "Integrations", path: "integrations" },
  { label: "Audit Logs", path: "audit" },
];

const STACK = [
  "FastAPI",
  "MongoDB",
  "OpenRouter",
  "Asterisk (optional)",
  "React + Vite",
];

const GITHUB_URL = "https://github.com/prema1432/prema-ai-voice-agent";

export default function LandingFooter() {
  const reduce = useReducedMotion();

  return (
    <footer className="ld-footer">
      <motion.div
        className="cta-band"
        initial={{ opacity: 0, rotateX: 22, y: 26 }}
        whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.65 }}
        style={{ transformPerspective: 900 }}
      >
        <h2>
          Put an AI caller on your leads, <span className="grad">today.</span>
        </h2>
        <p>
          Self-hosted, open stack, TRAI-minded. Browser Voice Lab included on
          day one.
        </p>
        <div className="cta-actions">
          <button className="btn-main" onClick={() => navigate("app")}>
            Launch the app →
          </button>
          <a
            className="btn-ghost"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            ★ Star us on GitHub
          </a>
        </div>
      </motion.div>

      <div className="ld-foot-grid">
        <div className="ld-foot-brand">
          <span className="ld-brand-mark">🎙️</span>
          <b>Prema AI Voice Agent</b>
          <p>
            Self-hosted AI calling for Indian numbers & regional languages —
            every call becomes a CRM record.
          </p>
          <div className="ld-og" onClick={() => navigate("app")}>
            Open the app →
          </div>
        </div>

        <nav className="ld-foot-col" aria-label="Product">
          <b>Product</b>
          {APP_LINKS.map((l) => (
            <button key={l.path} onClick={() => navigate(l.path)}>
              {l.label}
            </button>
          ))}
        </nav>

        <div className="ld-foot-col">
          <b>Built on</b>
          <div className="ld-stack">
            {STACK.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <b style={{ marginTop: 18 }}>Project</b>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub repository ↗
          </a>
        </div>
      </div>

      <div className="ld-legal">
        <span>© 2026 Prema AI Voice Agent · Built by Premanath Talamarla</span>
        <button
          onClick={() =>
            window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
          }
        >
          ↑ Back to top
        </button>
      </div>
    </footer>
  );
}