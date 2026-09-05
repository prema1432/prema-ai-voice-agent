import { useRef, useState } from "react";
import { AgentPersona, LANGUAGES, api } from "../api";
import { Button, Card, StatusBadge } from "../components";

type Turn = { role: string; text: string; language?: string };

/**
 * Voice Lab — talk to an agent in the browser.
 *
 * Mic audio: 48kHz float → decimated to 8kHz PCM16 → WS binary frames.
 * Agent audio: WS binary (8kHz PCM16) → AudioContext buffer playback.
 * Use headphones! Speaker echo will trigger false barge-ins.
 */
export default function VoiceLab() {
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended">("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lang, setLang] = useState("te");
  const [name, setName] = useState("Priya");
  const [requirements, setRequirements] = useState(
    "You are a friendly insurance renewal agent. Greet, check if they renew their policy, offer a 10% early-renewal discount, and try to close.",
  );
  const [endInfo, setEndInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leadName, setLeadName] = useState("");
  const [leadNotes, setLeadNotes] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);

  const wsUrl = () => `${api.wsBase()}/calls/ws`;

  async function start() {
    setStatus("connecting");
    setTurns([]);
    setEndInfo(null);
    setError(null);

    const ws = new WebSocket(wsUrl());
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      const agent: AgentPersona = {
        name,
        requirements,
        primary_language: lang,
        fallback_languages: ["hinglish", "en"],
        auto_language_switch: true,
        tools_enabled: ["set_callback", "end_call", "opt_out_dnd"],
        max_call_seconds: 300,
      };
      ws.send(
        JSON.stringify({
          type: "start",
          agent,
          language: lang,
          provider: "mock",
          lead_context: {
            ...(leadName.trim() ? { name: leadName.trim() } : {}),
            extra: leadNotes.trim() ? { notes: leadNotes.trim() } : {},
          },
        }),
      );
      setStatus("live");
    };

    // If the socket can't connect (proxy/firewall), surface it instead of hanging.
    const connectTimeout = window.setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        setError(
          "Could not reach the voice WebSocket. If the backend runs separately, " +
            "open the dashboard via the API host or fix the /api WS proxy.",
        );
        setStatus("idle");
        ws.close();
      }
    }, 6000);

    ws.onmessage = (ev) => {
      // Binary = agent audio (8kHz PCM16). Text = control/transcript messages.
      if (ev.data instanceof ArrayBuffer) {
        playAgentAudio(ev.data);
        return;
      }
      if (ev.data instanceof Blob) {
        // Blob arrived (e.g. via proxy). Read as ArrayBuffer and play.
        ev.data.arrayBuffer().then((ab) => playAgentAudio(ab));
        return;
      }
      const text = typeof ev.data === "string" ? ev.data : String(ev.data);
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(text);
      } catch {
        return; // ignore non-JSON frames (e.g. bare binary passed as string)
      }
      if (msg.type === "transcript") {
        setTurns((t) => [
          ...t,
          { role: msg.role as string, text: msg.text as string, language: (msg.language as string) ?? undefined },
        ]);
      } else if (msg.type === "interrupted") {
        // playback already stopped server-side; nothing to do client-side
      } else if (msg.type === "ended") {
        const sm = (msg.summary ?? {}) as { end_reason?: string; error?: string };
        setStatus("ended");
        setEndInfo((sm.end_reason ?? "ended") + (sm.error ? ` — ${sm.error}` : ""));
        cleanupMedia();
      }
    };

    ws.onopen = () => window.clearTimeout(connectTimeout);

    ws.onclose = () => {
      window.clearTimeout(connectTimeout);
      if (wsRef.current === ws) wsRef.current = null;
      setStatus((s) => (s === "live" || s === "connecting" ? "ended" : s));
      cleanupMedia();
    };

    ws.onerror = () => {
      window.clearTimeout(connectTimeout);
      setError("WebSocket error — is the backend running and the /api proxy up?");
    };

    // Mic capture → 8kHz PCM16 frames
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      setError(
        "Microphone unavailable — allow mic access in the browser and try again. " +
          String((e as Error).message ?? e),
      );
      ws.close();
      setStatus("idle");
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
    proc.connect(ctx.destination); // required for ScriptProcessor to fire
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

  function stop() {
    wsRef.current?.send(JSON.stringify({ type: "stop" }));
    wsRef.current?.close();
    setStatus("ended");
    cleanupMedia();
  }

  function cleanupMedia() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    procRef.current?.disconnect();
    procRef.current = null;
  }

  const live = status === "live";

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🎤 Voice Lab</h2>
          <div className="sub">Talk to an agent live in your browser — same pipeline as phone calls</div>
        </div>
        <StatusBadge
          status={
            status === "live" ? "running" : status === "connecting" ? "dialing" : status === "ended" ? "completed" : "new"
          }
        />
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <Card title="Agent setup">
            <label className="lbl">Agent name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />

            <label className="lbl">Language</label>
            <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>

            <label className="lbl">Requirements</label>
            <textarea
              className="input"
              style={{ height: 110, resize: "vertical" }}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />

            <label className="lbl">Who are you calling? (optional)</label>
            <input
              className="input"
              placeholder="Lead name"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
            />
            <input
              className="input"
              style={{ marginTop: 7 }}
              placeholder="Special instructions for the agent about this person"
              value={leadNotes}
              onChange={(e) => setLeadNotes(e.target.value)}
            />

            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 14 }}>
              Uses your configured STT/TTS backends (<code>.env</code>). With mock engines
              you'll see the transcript loop but hear silence. 🎧 Use headphones to avoid echo
              triggering barge-in.
            </p>

            {!live ? (
              <Button variant="primary" block onClick={start} disabled={status === "connecting"} style={{ marginTop: 12 }}>
                {status === "connecting" ? (
                  <>
                    <span className="spinner" /> Connecting…
                  </>
                ) : (
                  "🎙 Start talking"
                )}
              </Button>
            ) : (
              <Button block variant="danger" onClick={stop} style={{ marginTop: 12 }}>
                ⏹ Hang up
              </Button>
            )}
            {error && (
              <div className="msg err" style={{ marginTop: 12 }}>
                {error}
              </div>
            )}
            {status === "ended" && endInfo && (
              <div className="msg ok" style={{ marginTop: 12 }}>
                Call ended: {endInfo}
              </div>
            )}
          </Card>
        </div>

        <Card title={<span>Live transcript {live && <span className="dot green" style={{ marginLeft: 6 }} />}</span>}>
          {turns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
              <div style={{ fontWeight: 600, color: "var(--text)" }}>Transcript will appear here…</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>Press start, allow the mic, and say hello.</div>
            </div>
          ) : (
            <div
              className="transcript"
              style={{ minHeight: 300, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}
            >
              {turns.map((t, i) => (
                <div key={i} className={`bubble ${t.role === "agent" ? "agent" : "user"}`}>
                  <div className="meta">
                    {t.role === "agent" ? name : "You"} {t.language ? ` · ${LANGUAGES[t.language] ?? t.language}` : ""}
                  </div>
                  {t.text}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}