import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentDirectoryItem, AgentPersona, api } from "../../api";

export type Turn = { role: string; text: string; language?: string };
export type CallPhase = "idle" | "dialing" | "ringing" | "connected" | "ended";

/** Sound-feel presets the user can dial without a real number. */
export const PRESETS: { label: string; phone: string }[] = [
  { label: "Telugu lead", phone: "91 80741 58222" },
  { label: "Demo lead", phone: "91 98765 43210" },
  { label: "Bulk campaign", phone: "+91 (40) 1234 5678" },
];

const DEFAULT_REQUIREMENTS =
  "You are a friendly insurance renewal agent. Greet, check if they renew their policy, offer a 10% early-renewal discount, and try to close.";

/**
 * All state + WebSocket/media logic for the phone-call simulation. Kept out
 * of the component so the view stays small and reusable panels stay dumb.
 */
export function useCallEngine(presetAgentId?: string) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [callMs, setCallMs] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lang, setLang] = useState("te");
  const [name, setName] = useState("Priya");
  const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS);
  const [leadName, setLeadName] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(PRESETS[0].phone);
  const [agents, setAgents] = useState<AgentDirectoryItem[] | null>(null);
  const [presetAgent, setPresetAgent] = useState<AgentDirectoryItem | null>(null);
  const [typing, setTyping] = useState(true);
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

  // Landed from an agent card? Prefill that agent.
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

  // Connected → count seconds + open the real voice pipeline.
  useEffect(() => {
    if (phase === "connected") {
      timerRef.current = window.setInterval(() => setCallMs((m) => m + 100), 100);
      openVoiceChannel();
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Auto-scroll the transcript.
  useEffect(() => {
    const el = transRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, agentSpeaking]);

  // Cleanup on unmount.
  useEffect(() => () => cleanupMedia(), []);

  const mm = String(Math.floor(callMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((callMs % 60000) / 1000)).padStart(2, "0");

  const markSpeaking = () => {
    setAgentSpeaking(true);
    if (speakTimerRef.current) window.clearTimeout(speakTimerRef.current);
    speakTimerRef.current = window.setTimeout(() => setAgentSpeaking(false), 2400);
  };

  /** Simulated carrier progress: dialing → ringing → answered. */
  function dial() {
    setError(null);
    setTurns([]);
    setCallMs(0);
    setPhase("dialing");
    window.setTimeout(() => setPhase("ringing"), 900);
    window.setTimeout(() => setPhase("connected"), 2600);
  }

  async function openVoiceChannel() {
    const ws = new WebSocket(`${api.wsBase()}/calls/ws`);
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
        setTurns((prev) => [
          ...prev,
          { role, text: msg.text as string, language: (msg.language as string) ?? undefined },
        ]);
        if (role === "agent") markSpeaking();
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

    if (!typing) attachMic(ws);
  }

  /** Mic capture → 8kHz PCM16 frames (used when Speak mode is on). */
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

  function sendText() {
    const text = input.trim();
    const ws = wsRef.current;
    if (!text || !ws || ws.readyState !== WebSocket.OPEN || phase !== "connected") return;
    // The backend echoes user turns back as transcript events, so no local append.
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
      if (a.description) {
        setRequirements(a.description + "\n\n" + (a.requirements || ""));
      } else if (a.requirements) {
        setRequirements(a.requirements);
      }
    }
  };

  const speakingNow = phase === "connected" && agentSpeaking;
  const callLabel = useMemo(() => {
    if (phase === "connected") return "Connected";
    return phase === "ringing" ? "Ringing…" : phase === "dialing" ? "Dialing…" : "";
  }, [phase]);

  return {
    phase, setPhase, mm, ss, turns, lang, setLang, name, setName,
    requirements, setRequirements, leadName, setLeadName, leadNotes, setLeadNotes,
    error, phone, setPhone, agents, presetAgent, selectedAgent: presetAgent,
    setPresetAgent, typing, setTyping, sending, input, setInput, agentSpeaking,
    speakingNow, callLabel, dial, hangUp, sendText, pickAgent, transRef,
  };
}
