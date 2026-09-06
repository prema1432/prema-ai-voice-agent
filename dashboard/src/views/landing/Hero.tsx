import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import type { MouseEvent } from "react";
import { useRef } from "react";
import { navigate } from "../../router";

const LANGUAGES = [
  "Hindi", "Hinglish", "English", "Telugu", "Tamil", "Kannada", "Malayalam",
  "Bengali", "Marathi", "Gujarati", "Punjabi", "Odia", "Assamese", "Urdu",
];

const EQ = [0.5, 0.92, 0.66, 1, 0.58, 0.84, 0.48, 0.78];

const CALLS = [
  { name: "Rahul Verma", city: "Mumbai", lang: "हिन्दी", score: 87 },
  { name: "Priya Nair", city: "Kochi", lang: "മലയാളം", score: 74 },
  { name: "Srinivas P", city: "Hyderabad", lang: "తెలుగు", score: 92 },
];

/**
 * Animated hero: staggered copy on the left, a mouse-tilted 3D "live call
 * console" on the right (pure CSS 3D transforms — no WebGL dependency).
 */
export default function Hero({ onSeePipeline }: { onSeePipeline: () => void }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-13, 13]), {
    stiffness: 140,
    damping: 18,
    mass: 0.6,
  });
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), {
    stiffness: 140,
    damping: 18,
    mass: 0.6,
  });

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  // Scroll-driven 3D parallax: as the hero scrolls away, the visual tilts back,
  // scales down and fades, while the orbs drift at different depths.
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const scrollRotateX = useTransform(scrollYProgress, [0, 1], [0, -16]);
  const visualScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const visualOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0.55]);
  const visualY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -46]);
  const orbAY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const orbBY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const orbCY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const stageRotateX = useTransform(() => rotateX.get() + scrollRotateX.get());

  return (
    <section className="hero" id="top" ref={heroRef}>
      <motion.div className="orb orb-a" style={{ y: orbAY }} aria-hidden />
      <motion.div className="orb orb-b" style={{ y: orbBY }} aria-hidden />
      <motion.div className="orb orb-c" style={{ y: orbCY }} aria-hidden />

      <div className="hero-inner">
        <motion.div className="hero-copy" style={{ y: copyY }}>
          <motion.span
            className="hero-pill"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5 }}
          >
            ⚡ Self-hosted · No Twilio · No ElevenLabs · No paid STT/TTS
          </motion.span>

          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.65 }}
          >
            AI voice agents that speak your{" "}
            <span className="grad">customer's language.</span>
          </motion.h1>

          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.65 }}
          >
            Prema AI runs a complete voice pipeline — VAD → speech-to-text →
            LLM → text-to-speech with barge-in — over Indian phone numbers, and
            wires every call into campaigns, a CRM board, forms and LLM cost
            control. All self-hosted, all yours.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
          >
            <button className="btn-main" onClick={() => navigate("app")}>
              Launch the app →
            </button>
            <button className="btn-ghost" onClick={onSeePipeline}>
              ▶ See the pipeline
            </button>
          </motion.div>

          <motion.div
            className="hero-facts"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.7 }}
          >
            <span>
              <b>₹0</b> self-hosted STT/TTS/VAD
            </span>
            <span>
              <b>13+</b> Indian languages + Hinglish
            </span>
            <span>
              <b>2</b> call transports — browser + SIP
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-visual"
          style={{ y: visualY, scale: visualScale, opacity: visualOpacity }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          <motion.div
            className="stage"
            style={{ rotateX: stageRotateX, rotateY, transformStyle: "preserve-3d" }}
          >
            <div className="orb-deck" aria-hidden>
              <div className="orb-deck-ring" />
            </div>

            <div className="mock">
              <div className="mock-bar">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <b>🎙️ Prema AI · live campaign</b>
                <span className="mock-live">● connected</span>
              </div>

              <div className="mock-stats">
                <span className="ms-chip up">Connected 82%</span>
                <span className="ms-chip">Hot leads 47</span>
                <span className="ms-chip green">₹0 STT/TTS</span>
              </div>

              <div className="mock-wave" aria-hidden>
                {EQ.map((h, i) => (
                  <motion.span
                    key={i}
                    className="eq"
                    style={{ height: `${h * 100}%` }}
                    animate={{ scaleY: [1, 0.4, 1] }}
                    transition={{
                      duration: 0.9 + i * 0.08,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>

              <div className="mock-rows">
                {CALLS.map((c) => (
                  <div className="mock-row" key={c.name}>
                    <span className="mr-avatar">{c.name.charAt(0)}</span>
                    <span className="mr-name">
                      <b>{c.name}</b>
                      <em>
                        {c.city} · {c.lang}
                      </em>
                    </span>
                    <span className="mr-score">score {c.score}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chip chip-call" style={{ transform: "translateZ(78px)" }}>
              <motion.div
                className="chip-inner"
                animate={{ y: [0, -9, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="chip-dot pulse">●</span>
                <span>
                  <b>Live call · Hinglish</b>
                  <em>agent Priya · barge-in ready</em>
                </span>
              </motion.div>
            </div>

            <div className="chip chip-score" style={{ transform: "translateZ(120px)" }}>
              <motion.div
                className="chip-inner"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              >
                <span className="chip-ring">87</span>
                <span>
                  <b>Lead score</b>
                  <em>auto-outcome after call</em>
                </span>
              </motion.div>
            </div>

            <div className="chip chip-trai" style={{ transform: "translateZ(52px)" }}>
              <motion.div
                className="chip-inner"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <span>🛡️</span>
                <span>
                  <b>TRAI-safe dialer</b>
                  <em>9:00–21:00 · DND scrubbed</em>
                </span>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className="scroll-hint"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        aria-hidden
      >
        <span className="mouse"><span className="wheel" /></span>
        <em>scroll</em>
      </motion.div>

      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div className="marquee-group" key={dup}>
              {LANGUAGES.map((l) => (
                <span className="lang-pill" key={`${dup}-${l}`}>
                  {l}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}