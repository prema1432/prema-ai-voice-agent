import { useRef, useState } from "react";
import { AgentPersona, LANGUAGES, api } from "../api";

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
  const [lang, setLang] = useState("hinglish");
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
        setTurns((t) => [...t, { role: msg.role as string, text: msg.text as string, language: (msg.language as string) ?? undefined }]);
      } else if (msg.type === "interrupted") {
        // playback already stopped server-side; nothing to do client-side
      } else if (msg.type === "ended") {
        setStatus("ended");
        setEndInfo(
          (msg.summary?.end_reason ?? "ended") +
            (msg.summary?.error ? ` — ${msg.summary.error}` : ""),
        );
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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>
      <section>
        <h3 style={{ marginBottom: 8 }}>Agent setup</h3>
        <label style={lbl}>Agent name</label>
        <input style={inp} value={name} onChange={(e) => setName(e.target.value)} />

        <label style={lbl}>Language</label>
        <select style={inp} value={lang} onChange={(e) => setLang(e.target.value)}>
          {Object.entries(LANGUAGES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>

        <label style={lbl}>Requirements</label>
        <textarea
          style={{ ...inp, height: 110 }}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
        />

        <label style={lbl}>Who are you calling? (optional)</label>
        <input
          style={inp}
          placeholder="Lead name"
          value={leadName}
          onChange={(e) => setLeadName(e.target.value)}
        />
        <input
          style={{ ...inp, marginTop: 6 }}
          placeholder="Special instructions for the agent about this person"
          value={leadNotes}
          onChange={(e) => setLeadNotes(e.target.value)}
        />

        <p style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>
          Uses your configured STT/TTS backends (<code>.env</code>). With mock engines
          you'll see the transcript loop but hear silence. 🎧 Use headphones to avoid echo
          triggering barge-in.
        </p>

        {status !== "live" ? (
          <button style={primaryBtn} onClick={start} disabled={status === "connecting"}>
            🎙 {status === "connecting" ? "Connecting…" : "Start talking"}
          </button>
        ) : (
          <button style={{ ...primaryBtn, background: "#a11" }} onClick={stop}>
            ⏹ Hang up
          </button>
        )}
        {error && (
          <p style={{ background: "#fdeaea", color: "#901", padding: 8, borderRadius: 6, fontSize: 13 }}>
            {error}
          </p>
        )}
        {status === "ended" && endInfo && <p style={{ fontSize: 13 }}>Call ended: {endInfo}</p>}
      </section>

      <section>
        <h3 style={{ marginBottom: 8 }}>Live transcript {status === "live" && "●"}</h3>
        <div
          style={{
            border: "1px solid #e2e2e2",
            borderRadius: 10,
            padding: 14,
            minHeight: 300,
            maxHeight: 480,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {turns.length === 0 && <span style={{ color: "#999" }}>Transcript will appear here…</span>}
          {turns.map((t, i) => (
            <div
              key={i}
              style={{
                alignSelf: t.role === "agent" ? "flex-start" : "flex-end",
                background: t.role === "agent" ? "#eef4ff" : "#eefaf0",
                padding: "7px 11px",
                borderRadius: 12,
                maxWidth: "75%",
                fontSize: 14,
              }}
            >
              <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>
                {t.role === "agent" ? name : "You"} {t.language ? `· ${t.language}` : ""}
              </div>
              {t.text}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 12, color: "#555", margin: "10px 0 4px" };
const inp: React.CSSProperties = {
  width: "100%",
  padding: 8,
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: 10,
  border: "none",
  borderRadius: 8,
  background: "#0a7",
  color: "#fff",
  fontSize: 15,
  cursor: "pointer",
  marginTop: 14,
};
