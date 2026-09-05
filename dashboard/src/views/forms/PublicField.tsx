import { useEffect, useState, type CSSProperties } from "react";
import { FormField, api } from "../../api";
import { evalFormula } from "./formulaClient";

type Opt = { label: string; value: string };

function Rating({ max, value, onChange }: { max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: Math.max(1, max) }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1,
            color: n <= value ? "#f59e0b" : "var(--text-faint)", filter: "none",
          }}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function PublicField({
  field,
  value,
  values,
  formSlug,
  disabled,
  onChange,
  onError,
}: {
  field: FormField;
  value: unknown;
  values: Record<string, unknown>;
  formSlug: string;
  disabled?: boolean;
  onChange: (v: unknown) => void;
  onError?: (msg: string | null) => void;
}) {
  const [opts, setOpts] = useState<Opt[] | null>(field.options_api?.url ? [] : (field.options ?? []).map((o) => ({ label: o, value: o })));
  const [optErr, setOptErr] = useState<string | null>(null);
  const isChoice = ["select", "multiselect", "radio", "checkbox"].includes(field.type);
  const isComputed = field.computed === true || field.type === "computed";

  // Live API options: fetched when the field is first shown.
  useEffect(() => {
    if (!field.options_api?.url) return;
    let alive = true;
    api.publicOptions(formSlug, field.id)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setOpts(r.options);
        else {
          setOpts(null);
          setOptErr(r.error ?? "could not load options");
        }
      })
      .catch((e) => {
        if (alive) {
          setOpts(null);
          setOptErr(String(e).slice(0, 120));
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id, formSlug]);

  if (isComputed) {
    const out = evalFormula(field.formula ?? "", values);
    return (
      <label className="lbl">
        {field.label}
        <div className="input" style={{ background: "var(--well)", color: "var(--text)", fontWeight: 700 }}>
          {out || "—"}
        </div>
      </label>
    );
  }

  if (field.type === "hidden") return null;

  const list = (v: unknown) =>
    Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : [];

  const toggleInList = (opt: string) => {
    const cur = list(value);
    onChange(cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  };

  const common = { disabled, placeholder: field.placeholder ?? "" };
  const style: CSSProperties = {
    width: "100%",
  };

  let control: React.ReactNode = null;
  switch (field.type) {
    case "text":
    case "email":
    case "phone":
    case "url":
    case "hidden":
    case "color":
      control = (
        <input
          className="input"
          type={field.type === "color" ? "color" : field.type}
          {...common}
          style={style}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.type === "color" ? e.target.value : e.target.value)}
        />
      );
      break;
    case "textarea":
      control = (
        <textarea
          className="input"
          {...common}
          style={{ ...style, minHeight: 96 }}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "number":
      control = (
        <input
          className="input"
          type="number"
          {...common}
          style={style}
          min={String(field.validation?.min ?? "")}
          max={String(field.validation?.max ?? "")}
          step={String(field.validation?.step ?? "any")}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
      break;
    case "date":
    case "time":
    case "datetime-local":
      control = (
        <input className="input" type={field.type} {...common} style={style}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "select":
    case "multiselect":
      control = (
        <select
          className="select"
          disabled={disabled}
          multiple={field.type === "multiselect"}
          style={style}
          value={field.type === "multiselect" ? list(value) : (typeof value === "string" ? value : "")}
          onChange={(e) =>
            field.type === "multiselect"
              ? onChange([...e.target.selectedOptions].map((o) => o.value))
              : onChange(e.target.value)
          }
        >
          {field.type === "select" && <option value="">— choose —</option>}
          {(opts ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
      break;
    case "radio":
      control = (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(opts ?? []).map((o) => (
            <label key={o.value} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
              <input type="radio" disabled={disabled} name={field.id} checked={value === o.value} onChange={() => onChange(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      );
      break;
    case "checkbox":
      control = (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(opts ?? []).map((o) => (
            <label key={o.value} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" disabled={disabled} checked={list(value).includes(o.value)} onChange={() => toggleInList(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      );
      break;
    case "toggle":
      control = (
        <button type="button" disabled={disabled}
          onClick={() => onChange(!(value === true))}
          className={`chip ${value === true ? "on" : ""}`}
          style={{ padding: "7px 16px", fontSize: 13.5 }}
        >
          {value === true ? "✓ Yes" : "No"}
        </button>
      );
      break;
    case "slider":
      control = (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="range" className="input" disabled={disabled}
            min={String(field.validation?.min ?? 0)} max={String(field.validation?.max ?? 100)} step={String(field.validation?.step ?? 1)}
            value={typeof value === "number" ? value : Number(field.validation?.min ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))} style={{ padding: 0, flex: 1 }} />
          <b>{typeof value === "number" ? value : "—"}</b>
        </div>
      );
      break;
    case "rating":
      control = (
        <Rating max={Number(field.validation?.max ?? 5)} value={typeof value === "number" ? value : 0} onChange={onChange} />
      );
      break;
    default:
      control = null;
  }

  if (optErr && isChoice) onError?.(`${field.label}: ${optErr}`);

  return (
    <div>
      <label className="lbl">
        {field.label}
        {field.required && <span style={{ color: "var(--red)" }}> *</span>}
      </label>
      {control}
      {field.help && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{field.help}</div>}
    </div>
  );
}
