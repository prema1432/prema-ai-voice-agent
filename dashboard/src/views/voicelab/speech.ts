/**
 * Zero-cost realtime voice helpers for Voice Lab.
 *
 * Browser Web Speech does the heavy lifting so a simulated call can be fully
 * conversational without a self-hosted STT/TTS server: SpeechRecognition turns
 * the caller's mic input into text, speechSynthesis reads agent replies aloud.
 */
export const VOICE_LANGS: Record<string, string> = {
  te: "te-IN", hi: "hi-IN", ta: "ta-IN", kn: "kn-IN", ml: "ml-IN",
  bn: "bn-IN", mr: "mr-IN", gu: "gu-IN", pa: "pa-IN", ur: "ur-IN",
  or: "or-IN", as: "as-IN", en: "en-IN", hinglish: "en-IN",
};

export interface SpeechRecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult:
    | ((ev: {
        resultIndex: number;
        results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
      }) => void)
    | null;
}

export const hasSpeechRec =
  typeof window !== "undefined" &&
  Boolean(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition,
  );

export const hasTts = typeof window !== "undefined" && "speechSynthesis" in window;

let _voices: SpeechSynthesisVoice[] = [];

function _loadVoices() {
  if (hasTts) _voices = window.speechSynthesis.getVoices();
}

if (hasTts) {
  _loadVoices();
  window.speechSynthesis.onvoiceschanged = _loadVoices;
}

/** Best OS/browser voice for a language code (te → te-IN etc). */
export function pickVoice(code?: string): SpeechSynthesisVoice | undefined {
  const want = (VOICE_LANGS[code ?? ""] ?? "en-IN").toLowerCase().replace("_", "-");
  return (
    _voices.find((v) => v.lang.toLowerCase().replace("_", "-") === want) ??
    _voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(want.split("-")[0])) ??
    _voices.find((v) => v.lang.toLowerCase().startsWith("en"))
  );
}
