/* ============================================================
   StageProcessEditor — dynamic per-stage validation config.
   Each stage decides HOW it evaluates:
     🔍 screen    → AI scores resume/JD dimensions (which fields)
     ✅ mcq       → a question bank with options + correct answers
     🎙️ interview → open AI-interviewer questions with model answers
   The editor swaps its form based on the selected kind, so every
   stage can carry its own real evaluation content, not a score
   alone. Used by the Flow builder rail and the stage list cards.
   ============================================================ */
import { useState } from "react";
import {
  PROCESS_KIND_META, ProcessKind, StageProcess, StageQuestion,
} from "./process";

export type { ProcessKind, StageProcess };

let qseq = 0;
const nqid = (p: string) => `${p}_${Date.now().toString(36)}_${++qseq}`;

const newMCQ = (): StageQuestion => ({
  id: nqid("q"), type: "mcq",
  q: "", options: ["", "", "", ""], answerIndex: 0, points: 10,
});
const newOpen = (): StageQuestion => ({
  id: nqid("q"), type: "open",
  q: "", modelAnswer: "", points: 10,
});

const KIND_ORDER: ProcessKind[] = ["screen", "mcq", "interview"];

export default function StageProcessEditor({
  value, onChange,
}: {
  value: StageProcess;
  onChange: (p: StageProcess) => void;
}) {
  const [addField, setAddField] = useState("");

  const kind = value.kind ?? "screen";

  const setQ = (id: string, patch: Partial<StageQuestion>) =>
    onChange({ ...value, questions: value.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  const removeQ = (id: string) =>
    onChange({ ...value, questions: value.questions.filter((q) => q.id !== id) });
  const moveQ = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= value.questions.length) return;
    const next = [...value.questions];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ ...value, questions: next });
  };

  return (
    <div className="jr-proc">
      {/* Kind picker — decides what this stage evaluates */}
      <div className="jr-proc-kind" role="tablist" aria-label="Evaluation process">
        {KIND_ORDER.map((k) => {
          const m = PROCESS_KIND_META[k];
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={`jr-proc-kind-btn${kind === k ? " on" : ""}`}
              onClick={() => onChange({ ...value, kind: k })}
              title={m.desc}
            >
              <span>{m.icon}</span>
              <b>{m.label}</b>
              <em>{m.desc}</em>
            </button>
          );
        })}
      </div>

      {kind === "screen" && (
        <div className="jr-proc-fields">
          <label className="lbl">AI evaluates these dimensions of the application</label>
          <div className="jr-proc-add">
            <input
              className="input"
              placeholder="e.g. Communication, Certifications…"
              value={addField}
              onChange={(e) => setAddField(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && addField.trim()) {
                  onChange({ ...value, fields: [...value.fields, addField.trim()] });
                  setAddField("");
                }
              }}
            />
            <button
              className="btn sm"
              onClick={() => { if (addField.trim()) { onChange({ ...value, fields: [...value.fields, addField.trim()] }); setAddField(""); } }}
            >
              ＋ Add
            </button>
          </div>
          <div className="jr-proc-chips">
            {value.fields.length === 0 && <span className="jr-hint">No dimensions yet — AI uses the built-in Skills / Experience / Education match.</span>}
            {value.fields.map((f, i) => (
              <span key={`${f}_${i}`} className="chip on jr-proc-chip">
                {f}
                <button aria-label={`Remove ${f}`} onClick={() => onChange({ ...value, fields: value.fields.filter((_, x) => x !== i) })}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {kind !== "screen" && (
        <div className="jr-proc-qs">
          <div className="jr-proc-qs-head">
            <label className="lbl">
              {kind === "mcq" ? "✅ MCQ question bank — candidates pick an option, AI checks it" : "🎙️ AI interviewer questions — AI reviews the answer vs model answer"}
            </label>
            <div className="jr-proc-add">
              <button className="btn sm" onClick={() => onChange({ ...value, questions: [...value.questions, kind === "mcq" ? newMCQ() : newOpen()] })}>
                ＋ {kind === "mcq" ? "MCQ" : "Open"} question
              </button>
            </div>
          </div>

          {value.questions.length === 0 && (
            <div className="jr-hint">No questions yet — this stage scores purely from the resume/JD match.</div>
          )}

          {value.questions.map((q, qi) => (
            <div key={q.id} className="jr-proc-q">
              <div className="jr-proc-q-top">
                <span className="jr-proc-q-num">{qi + 1}</span>
                <input
                  className="input"
                  value={q.q}
                  placeholder={q.type === "mcq" ? "Question text…" : "Ask a question candidates must answer…"}
                  onChange={(e) => setQ(q.id, { q: e.target.value })}
                />
                <button className="btn ghost sm" title="Move up" onClick={() => moveQ(qi, -1)} disabled={qi === 0}>↑</button>
                <button className="btn ghost sm" title="Move down" onClick={() => moveQ(qi, 1)} disabled={qi === value.questions.length - 1}>↓</button>
                <button className="btn ghost sm danger" title="Remove question" onClick={() => removeQ(q.id)}>🗑</button>
              </div>

              {q.type === "mcq" ? (
                <div className="jr-proc-opts">
                  {q.options?.map((opt, oi) => (
                    <div key={oi} className={`jr-proc-opt${q.answerIndex === oi ? " right" : ""}`}>
                      <span className="jr-proc-opt-letter">{String.fromCharCode(65 + oi)}</span>
                      <input
                        className="input"
                        value={opt}
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        onChange={(e) => {
                          const options = [...(q.options ?? [])];
                          options[oi] = e.target.value;
                          setQ(q.id, { options });
                        }}
                      />
                      <button
                        type="button"
                        className={`jr-proc-correct${q.answerIndex === oi ? " on" : ""}`}
                        title="Mark as correct answer"
                        onClick={() => setQ(q.id, { answerIndex: oi })}
                      >
                        {q.answerIndex === oi ? "✓ correct" : "✓ correct?"}
                      </button>
                    </div>
                  ))}
                  <div className="jr-proc-q-meta">
                    <label className="lbl">Points</label>
                    <input className="input jr-proc-pts" type="number" min={1} value={q.points} onChange={(e) => setQ(q.id, { points: Math.max(1, Number(e.target.value) || 1) })} />
                    <span className="jr-hint">one correct option · candidates get full points when they pick it</span>
                  </div>
                </div>
              ) : (
                <div className="jr-proc-opts">
                  <textarea
                    className="input"
                    rows={2}
                    value={q.modelAnswer ?? ""}
                    placeholder="Model answer — what a great reply covers (comma separated keywords the AI checks for)"
                    onChange={(e) => setQ(q.id, { modelAnswer: e.target.value })}
                  />
                  <div className="jr-proc-q-meta">
                    <label className="lbl">Points</label>
                    <input className="input jr-proc-pts" type="number" min={1} value={q.points} onChange={(e) => setQ(q.id, { points: Math.max(1, Number(e.target.value) || 1) })} />
                    <span className="jr-hint">AI awards partial points for each keyword covered</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
