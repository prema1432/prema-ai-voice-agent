import { useCallback, useEffect, useMemo, useState } from "react";
import { FormField, PublicFormDef, api } from "../api";
import PublicField from "./forms/PublicField";
import { isFilled, visibleWhen } from "./forms/formulaClient";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function PublicForm({ slug }: { slug: string }) {
  const [def, setDef] = useState<PublicFormDef | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    api.publicForm(slug).then(setDef).catch((e) => setErr(String(e).slice(0, 200)));
  }, [slug]);

  const steps = def?.steps ?? [];
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  const visibleFields = useMemo(() => {
    if (!step) return [];
    return step.fields.filter((f) => visibleWhen(f.show_when, values));
  }, [step, values]);

  const validateField = (f: FormField, v: unknown): string | null => {
    if (f.required && !isFilled(v)) return `${f.label} is required`;
    if (v === "" || v === undefined || v === null) return null;
    if (f.type === "email" && !EMAIL_RE.test(String(v))) return `${f.label}: enter a valid email`;
    if (f.type === "url" && !String(v).toLowerCase().startsWith("http")) return `${f.label}: must start with http(s)://`;
    const vn = Number(v);
    if (f.type === "number" && v !== "" && !Number.isFinite(vn)) return `${f.label}: enter a number`;
    if (f.type === "number" && Number.isFinite(vn)) {
      const max = f.validation?.max;
      const min = f.validation?.min;
      if (max !== undefined && vn > Number(max)) return `${f.label}: max ${max}`;
      if (min !== undefined && vn < Number(min)) return `${f.label}: min ${min}`;
    }
    if (typeof v === "string" && f.validation?.pattern && !new RegExp(String(f.validation.pattern)).test(v)) {
      return `${f.label}: does not match the required format`;
    }
    return null;
  };

  function validateAll(list: FormField[]): boolean {
    for (const f of list) {
      const msg = validateField(f, values[f.id]);
      if (msg) {
        setFieldErr(msg);
        return false;
      }
    }
    return true;
  }

  async function next() {
    setFieldErr(null);
    if (!validateAll(visibleFields)) return;
    if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1);
    else await submitAll();
  }

  async function submitAll() {
    setSubmitting(true);
    setFieldErr(null);
    try {
      // every visible field across all steps must pass before the final POST
      for (const s of steps) {
        const fields = s.fields.filter((f) => visibleWhen(f.show_when, values));
        if (!validateAll(fields)) {
          setStepIdx(steps.indexOf(s));
          setSubmitting(false);
          return;
        }
      }
      const r = await api.submitPublic(slug, values);
      setDone(true);
      setSubmittedId(r.submission_id);
      const redirect = def?.settings?.redirect_url;
      if (redirect) window.location.assign(redirect);
    } catch (e) {
      const text = String(e);
      // strip the leading HTTP status FastAPI-style detail
      const clean = text.replace(/^.*?: /, "").replace(/^\{.*$/, "Submission failed — please retry.");
      setFieldErr(clean.slice(0, 300));
    } finally {
      setSubmitting(false);
    }
  }

  const setField = useCallback((id: string, v: unknown) => setValues((p) => ({ ...p, [id]: v })), []);

  if (err) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🚫</div>
          <b>Form unavailable</b>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{err}</p>
        </div>
      </div>
    );
  }

  if (!def) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <span className="spinner" style={{ width: 30, height: 30 }} />
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
          <h3 style={{ marginBottom: 6 }}>{def.title}</h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {def.settings?.success_message || "Thank you — your response has been recorded."}
          </p>
          {submittedId && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 10 }}>ref {submittedId.slice(-8)}</div>}
          <button className="btn" style={{ marginTop: 14 }} onClick={() => { setDone(false); setValues({}); setStepIdx(0); }}>
            ↺ Submit another response
          </button>
        </div>
      </div>
    );
  }

  const pct = ((stepIdx + 1) / Math.max(1, steps.length)) * 100;

  return (
    <div style={{ minHeight: "100vh", padding: "28px 16px 60px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ maxWidth: 660, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--gradient)", display: "grid", placeItems: "center", fontSize: 15 }}>📝</span>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>{def.title}</h2>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Powered by Prema AI Voice Agent
            </div>
          </div>
        </div>
        {def.description && (
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 12 }}>{def.description}</div>
        )}

        {steps.length > 1 && def.settings?.show_progress !== false && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-muted)", marginBottom: 5 }}>
              <span>Step {stepIdx + 1} of {steps.length}{step?.title ? ` — ${step.title}` : ""}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="progress"><div className="bar" style={{ width: `${pct}%` }} /></div>
          </div>
        )}

        <div className="card" style={{ maxWidth: 660 }}>
          {fieldErr && <div className="msg err" style={{ marginBottom: 12 }}>{fieldErr}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
            {visibleFields.map((f) => (
              <div key={f.id} style={{ gridColumn: f.width === "half" ? "auto" : "1 / -1" }}>
                <PublicField
                  field={f}
                  value={values[f.id] ?? (f.type === "toggle" ? false : f.default ?? "")}
                  values={values}
                  formSlug={slug}
                  disabled={submitting}
                  onChange={(v) => setField(f.id, v)}
                />
              </div>
            ))}
            {visibleFields.length === 0 && (
              <div style={{ gridColumn: "1 / -1", fontSize: 13.5, color: "var(--text-muted)", padding: "8px 0" }}>
                Nothing to show on this step.
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 22 }}>
            <button className="btn" disabled={stepIdx === 0 || submitting} onClick={() => { setFieldErr(null); setStepIdx(stepIdx - 1); }}>
              ← Back
            </button>
            {!isLast ? (
              <button className="btn primary" onClick={next}>Next →</button>
            ) : (
              <button className="btn primary" disabled={submitting} onClick={next}>
                {submitting ? <span className="spinner" /> : def.settings?.submit_label || "Submit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
