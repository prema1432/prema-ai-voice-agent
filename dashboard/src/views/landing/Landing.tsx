import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { navigate } from "../../router";
import { setSeo } from "../../seo";
import { getTheme, toggleTheme } from "../../theme";
import type { Theme } from "../../theme";
import Hero from "./Hero";
import Features from "./Features";
import Pipeline from "./Pipeline";
import Metrics from "./Metrics";
import Steps from "./Steps";
import LandingFooter from "./LandingFooter";
import "./landing.css";
import "./landing-sections.css";
import "./landing-theme.css";

const NAV_LINKS = [
  { key: "features", label: "Platform" },
  { key: "pipeline", label: "Pipeline" },
  { key: "metrics", label: "Cost & compliance" },
  { key: "steps", label: "How it works" },
] as const;

type SectionKey = (typeof NAV_LINKS)[number]["key"];

/** Gradient progress bar pinned to the top — driven by page scroll. */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    restDelta: 0.001,
  });
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden />;
}

/**
 * Marketing landing page (standalone, animated with Framer Motion). Renders at
 * the root URL; the dashboard app lives under /app with clean history-API
 * URLs — no "#" fragments anywhere in the navigation. Theme-aware: the ☀️/🌙
 * toggle reuses the dashboard preference (theme.ts, shared localStorage).
 */
export default function Landing() {
  const reduce = useReducedMotion();
  const [theme, setTheme] = useState<Theme>(getTheme());
  const refs: Record<SectionKey, RefObject<HTMLDivElement>> = {
    features: useRef<HTMLDivElement>(null),
    pipeline: useRef<HTMLDivElement>(null),
    metrics: useRef<HTMLDivElement>(null),
    steps: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    setSeo({
      title: "Prema AI Voice Agent — AI Call Agents for India",
      description:
        "Self-hosted AI voice-call agents for Indian numbers and regional languages. Campaigns, CRM pipeline, Voice Lab, LLM cost monitoring — no Twilio, no ElevenLabs.",
    });
    window.scrollTo(0, 0);
  }, []);

  const changeTheme = () => setTheme(toggleTheme());

  function go(key: SectionKey) {
    refs[key].current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <div className="landing">
      <ScrollProgress />
      <header className="ld-header">
        <button
          className="ld-brand"
          onClick={() =>
            window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
          }
          aria-label="Back to top"
        >
          <span className="ld-brand-mark">🎙️</span>
          <span className="ld-brand-text">
            <b>Prema AI</b>
            <em>Voice Agent</em>
          </span>
        </button>

        <nav className="ld-nav" aria-label="Landing navigation">
          {NAV_LINKS.map((l) => (
            <button key={l.key} onClick={() => go(l.key)}>
              {l.label}
            </button>
          ))}
        </nav>

        <button
          className="ld-theme"
          onClick={changeTheme}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          aria-label="Toggle light / dark theme"
        >
          {theme === "light" ? "☀️" : "🌙"}
        </button>

        <button className="ld-cta" onClick={() => navigate("app")}>
          Open the app →
        </button>
      </header>

      <main>
        <Hero onSeePipeline={() => go("pipeline")} />
        <Features ref_={refs.features} />
        <Pipeline ref_={refs.pipeline} />
        <Metrics ref_={refs.metrics} />
        <Steps ref_={refs.steps} />
      </main>

      <LandingFooter />
    </div>
  );
}