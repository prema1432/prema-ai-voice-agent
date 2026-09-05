import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentDirectoryItem, AgentPersona, LANGUAGES, api } from "../api";
import { Avatar, Button, Card, StatusBadge } from "../components";

type Turn = { role: string; text: string; language?: string };

type CallPhase = "idle" | "dialing" | "ringing" | "connected" | "ended";

/** Sound-feel presets the user can dial without a real number. */
const PRESETS: { label: string; phone: string }[] = [
  { label: "Telugu lead", phone: "91 80741 58222" },
  { label: "Demo lead", phone: "91 98765 43210" },
  { label: "Bulk campaign", phone: "+91 (40) 1234 5678" },
];

/** Phone-call simulation of the Voice Lab — same backend pipeline as a real call. */
export default function VoiceLab({ presetAgentId }: { presetAgentId?: string }) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [callMs, setCallMs] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lang, setLang] = useState("te");
  const [name, setName] = useState("Priya");
  const [requirements, setRequirements] = useState(
    "You are a friendly insurance renewal agent. Greet, check if they renew their policy, offer a 10% early-renewal discount, and try to close.",
  );
  const [leadName, setLeadName] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(PRESETS[0].phone);
  const [agents, setAgents] = useState<AgentDirectoryItem[] | null>(null);
  const [presetAgent, setPresetAgent] = useState<AgentDirectoryItem | null>(null);
  const [typing, setTyping] = useState(true); // type instead of mic
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const speakTimerRef = useRef<number | null>(null);
  const transRef = useRef<HTMLDivElement | null>(null);

  const loadAgents = useCallback(() => {
    api.listAgents().then(setAgents).catch(() => {});
  }, []);
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // If the user landed from an agent card, prefill that agent.
  useEffect(() => {
    if (!presetAgentId) return;
    let cancelled = false;
    api.getAgent(presetAgentId).then((a) => {
      if (cancelled || !a) return;
      setPresetAgent(a);
      setName(a.name);
      setLang(a.primary_language || "te");
      if (a.requirements) setRequirements(a.requirements);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [presetAgentId]);

  useEffect(() => {
    if (phase === "connected") {
      timerRef.current = window.setInterval(() => setCallMs((m) => m + 100), 100);
      openVoiceChannel(); // agent answers → open the real voice pipeline
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    // auto-scroll transcript
    const el = transRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, agentSpeaking]);

  useEffect(() => () => cleanupMedia(), []);

  const wsUrl = () => `${api.wsBase()}/calls/ws`;

  const mm = String(Math.floor(callMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((callMs % 60000) / 1000)).padStart(2, "0");

  function markSpeaking() {
    setAgentSpeaking(true);
    if (speakTimerRef.current) window.clearTimeout(speakTimerRef.current);
    speakTimerRef.current = window.setTimeout(() => setAgentSpeaking(false), 2400);
  }

  /* ── Start the simulated call ─────────────────────────── */
  function dial() {
    setError(null);
    setTurns([]);
    setCallMs(0);
    // Simulated carrier progress: dialing → ringing → answered.
    setPhase("dialing");
    window.setTimeout(() => setPhase("ringing"), 900);
    window.setTimeout(() => setPhase("connected"), 2600);
  }

  async function openVoiceChannel() {
    const ws = new WebSocket(wsUrl());
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const persona: AgentPersona = {
      name,
      requirements,
      primary_language: lang,
      fallback_languages: ["hinglish", "en"],
      auto_language_switch: true,
      tools_enabled: ["set_callback", "end_call", "opt_out_dnd"],
      max_call_seconds: 300,
    };

    const connectTimeout = window.setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        setError(
          "Could not reach the voice WebSocket. If the backend runs separately, " +
            "open the dashboard via the API host or fix the /api WS proxy.",
        );
        setPhase("idle");
        ws.close();
      }
    }, 6000);

    ws.onopen = () => {
      window.clearTimeout(connectTimeout);
      ws.send(
        JSON.stringify({
          type: "start",
          agent: persona,
          language: lang,
          provider: "mock",
          phone: phone.replace(/\D/g, ""),
          lead_context: {
            ...(leadName.trim() ? { name: leadName.trim() } : {}),
            extra: leadNotes.trim() ? { notes: leadNotes.trim() } : {},
          },
        }),
      );
    };

    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        playAgentAudio(ev.data);
        return;
      }
      if (ev.data instanceof Blob) {
        ev.data.arrayBuffer().then((ab) => playAgentAudio(ab));
        return;
      }
      const text = typeof ev.data === "string" ? ev.data : String(ev.data);
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg.type === "transcript") {
        const role = msg.role as string;
        const t: Turn = {
          role,
          text: msg.text as string,
          language: (msg.language as string) ?? undefined,
        };
        setTurns((prev) => [...prev, t]);
        if (role === "agent") {
          markSpeaking();
        }
      } else if (msg.type === "interrupted") {
        setAgentSpeaking(false);
      } else if (msg.type === "ended") {
        setPhase((p) => (p === "connected" ? "ended" : p));
        setAgentSpeaking(false);
        cleanupMedia();
      }
    };

    ws.onclose = () => {
      window.clearTimeout(connectTimeout);
      if (wsRef.current === ws) wsRef.current = null;
      setPhase((p) => (p === "connected" ? "ended" : p));
      cleanupMedia();
    };

    ws.onerror = () => {
      window.clearTimeout(connectTimeout);
      setError("WebSocket error — is the backend running and the /api proxy up?");
    };

    // Attach the mic if the caller wants to *speak* rather than type.
    if (!typing) attachMic(ws);
  }

  /* ── Mic capture → 8kHz PCM16 frames ──────────────────── */
  async function attachMic(ws: WebSocket) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      setError(
        "Microphone unavailable — allow mic access or switch to typing mode. " +
          String((e as Error).message ?? e),
      );
      return;
    }
    streamRef.current = stream;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    procRef.current = proc;
    const downsample = (f32: Float32Array, from: number, to = 8000) => {
      const factor = Math.max(1, Math.floor(from / to));
      const out = new Int16Array(Math.floor(f32.length / factor));
      for (let i = 0; i < out.length; i++) {
        let sum = 0;
        for (let j = 0; j < factor; j++) sum += f32[i * factor + j];
        const avg = (sum / factor) * 32767;
        out[i] = Math.max(-32768, Math.min(32767, avg));
      }
      return out;
    };
    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const pcm = downsample(e.inputBuffer.getChannelData(0), ctx.sampleRate);
      ws.send(pcm.buffer);
    };
    src.connect(proc);
    proc.connect(ctx.destination);
  }

  function playAgentAudio(buf: ArrayBuffer) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const i16 = new Int16Array(buf);
    const audioBuf = ctx.createBuffer(1, i16.length, 8000);
    const ch = audioBuf.getChannelData(0);
    for (let i = 0; i < i16.length; i++) ch[i] = i16[i] / 32768;
    const node = ctx.createBufferSource();
    node.buffer = audioBuf;
    node.connect(ctx.destination);
    node.start();
  }

  function hangUp() {
    wsRef.current?.send(JSON.stringify({ type: "stop" }));
    wsRef.current?.close();
    setAgentSpeaking(false);
    setPhase("ended");
    cleanupMedia();
  }

  function cleanupMedia() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    procRef.current?.disconnect();
    procRef.current = null;
  }

  /* ── Typed caller turn ────────────────────────────────── */
  function sendText() {
    const text = input.trim();
    const ws = wsRef.current;
    if (!text || !ws || ws.readyState !== WebSocket.OPEN || phase !== "connected") return;
    // The backend echoes user turns back as transcript events (same path as
    // spoken input), so we don't append locally — that would duplicate it.
    ws.send(JSON.stringify({ type: "user_text", text }));
    setInput("");
    setSending(true);
    window.setTimeout(() => setSending(false), 400);
  }

  const pickAgent = (id: string) => {
    const a = agents?.find((x) => x.id === id);
    if (a) {
      setPresetAgent(a);
      setName(a.name);
      setLang(a.primary_language || "te");
      if (a.requirements) setRequirements(a.requirements);
      if (a.description) setRequirements(a.description + "\n\n" + (a.requirements || ""));
    }
  };

  const speakingNow = phase === "connected" && agentSpeaking;
  const selectedAgent = presetAgent;

  const callLabel = useMemo(() => {
    if (phase === "connected") return "Connected";
    return phase === "ringing" ? "Ringing…" : phase === "dialing" ? "Dialing…" : "";
  }, [phase]);

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
          {/* phone header */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.10))",
              borderBottom: "1px solid var(--border)",
              padding: "18px 18px 12px",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
              {phase === "idle" ? "Who are you calling?" : phase === "ended" ? "Call ended" : callLabel}
            </div>

            {phase === "idle" || phase === "ended" ? (
              <div style={{ textAlign: "left" }}>
                <label className="lbl" style={{ marginTop: 0 }}>Pick an agent</label>
                <select
                  className="select"
                  value={selectedAgent?.id ?? "__custom__"}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setPresetAgent(null);
                      setName("Priya");
                    } else pickAgent(e.target.value);
                  }}
                >
                  {agents?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.specialization} {a.gender === "female" ? "👩" : "👨"}
                    </option>
                  ))}
                  {agents && agents.length > 0 && <option value="__custom__">✏️ Custom agent…</option>}
                  {!agents && <option value="__custom__">Custom agent…</option>}
                </select>

                {!selectedAgent && (
                  <>
                    <label className="lbl">Agent name</label>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                  </>
                )}

                <label className="lbl">Dial a number (mobile numbers will need a SIP trunk)</label>
                <input
                  className="input"
                  value={phone}
                  style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", letterSpacing: 1 }}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {PRESETS.map((p) => (
                    <button key={p.label} className="btn sm" onClick={() => setPhone(p.phone)}>
                      {p.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    className={`btn ${!typing ? "primary" : ""}`}
                    style={{ flex: 1 }}
                    onClick={() => setTyping(false)}
                    title="Speak through the mic — needs a real STT backend"
                  >
                    🎙 Speak
                  </button>
                  <button
                    className={`btn ${typing ? "primary" : ""}`}
                    style={{ flex: 1 }}
                    onClick={() => setTyping(true)}
                    title="Type your side of the conversation"
                  >
                    ⌨️ Type
                  </button>
                </div>
                {!typing && (
                  <div className="msg ok" style={{ marginTop: 8, fontSize: 12 }}>
                    Mic mode needs a working STT backend. With <code>STT_BACKEND=mock</code> you'll hear silence —
                    type instead.
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <Button variant="primary" block onClick={dial}>
                    📞 Call now
                  </Button>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <label className="lbl" style={{ margin: 0, flex: 1 }}>
                    Lead name (optional)
                    <input
                      className="input"
                      style={{ marginTop: 4 }}
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                    />
                  </label>
                </div>
                <label className="lbl">Notes for this lead</label>
                <input
                  className="input"
                  placeholder="e.g. She called yesterday about the Diwali offer"
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                />
              </div>
            ) : (
              /* live / connecting: agent display */
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
                  <Avatar name={name} avatar={selectedAgent?.avatar} accent={selectedAgent?.accent} size={66} />
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
                  {LANGUAGES[lang] ?? lang} · {selectedAgent?.specialization ?? "Custom agent"}
                </div>
                <div className="call-timer" style={{ fontSize: 21, margin: "7px 0 4px", letterSpacing: 1.5 }}>
                  {mm}:{ss}
                </div>
                {error && <div className="msg err" style={{ fontSize: 12 }}>{error}</div>}
              </div>
            )}
          </div>

          {phase === "connected" && (
            <div style={{ padding: "12px 18px 18px", textAlign: "center" }}>
              <Button variant="danger" block onClick={hangUp}>
                ⏹ End call
              </Button>
            </div>
          )}

          {phase === "ended" && (
            <div style={{ padding: "0 18px 18px", textAlign: "center" }}>
              <Button block onClick={() => setPhase("idle")}>↺ Call again</Button>
            </div>
          )}

          {/* footer note */}
          <div style={{ padding: "8px 16px", borderTop: "1px dashed var(--border)", fontSize: 11.5, color: "var(--text-faint)" }}>
            💡 Tip: real outbound calls need an Asterisk + SIP trunk. This lab simulates the same agent pipeline in
            your browser.
          </div>
        </div>

        {/* ── Right: conversation ───────────────────────────── */}
        <Card title={undefined} style={{ display: "flex", flexDirection: "column", minHeight: 540 }}>
          {/* conversation header */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              paddingBottom: 12, borderBottom: "1px solid var(--border)",
              marginBottom: 12,
            }}
          >
            <Avatar name={name} avatar={selectedAgent?.avatar} accent={selectedAgent?.accent} size={36} />
            <div>
              <div style={{ fontWeight: 650, fontSize: 13.5 }}>{name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {phase === "connected" ? (
                  <>
                    <span className="dot green" style={{ marginRight: 5 }} />
                    On call with {phone} · {LANGUAGES[lang] ?? lang}
                  </>
                ) : (
                  <>
                    {phase === "ended" ? "Call finished" : "Not on a call"}
                    {selectedAgent ? ` · ${selectedAgent.specialization}` : ""}
                  </>
                )}
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {phase === "connected" && !typing && <span className="dot green pulse-dot" title="Mic live" />}
              {speakingNow && (
                <span className="badge green" style={{ animation: "fadeIn .3s ease" }}>
                  <span className="wave"><i /><i /><i /></span> speaking
                </span>
              )}
              {sending && phase === "connected" && <span className="spinner" style={{ width: 14, height: 14 }} />}
            </div>
          </div>

          {/* transcript */}
          <div
            className="transcript"
            ref={transRef}
            style={{ flex: 1, minHeight: 330, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}
          >
            {turns.length === 0 && phase !== "connected" ? (
              <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>📞</div>
                <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>
                  {phase === "dialing" ? "Dialing the number…" : phase === "ringing" ? "Ringing…" : "The conversation appears here"}
                </div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>
                  Dial, wait for {name} to answer, then type or speak.
                </div>
              </div>
            ) : (
              <>
                {turns.map((t, i) => (
                  <div key={i} className={`bubble ${t.role === "agent" ? "agent" : "user"}`}>
                    <div className="meta">
                      {t.role === "agent" ? name : "You"} {t.language ? ` · ${LANGUAGES[t.language] ?? t.language}` : ""}
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
                phase === "connected"
                  ? typing
                    ? "Type your reply — e.g. 'haan boliye' or 'నమస్తే, వివరాలు చెప్పండి'"
                    : "Speak into the mic…"
                  : "Start a call first"
              }
              value={input}
              disabled={phase !== "connected"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendText();
              }}
            />
            <Button variant="primary" onClick={sendText} disabled={phase !== "connected" || !input.trim()}>
              ➤ Send
            </Button>
          </div>

          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 10, lineHeight: 1.6 }}>
            {phase !== "connected"
              ? "This simulated call uses the same agent, LLM (OpenRouter) and tool pipeline as a real outbound call."
              : typing
                ? "Typing mode — your text goes through the exact same LLM reply & tool path as spoken words."
                : "Mic mode — voice is transcribed locally, then sent to the same LLM. Use headphones to avoid echo."}
          </div>
        </Card>
      </div>
    </div>
  );
}
