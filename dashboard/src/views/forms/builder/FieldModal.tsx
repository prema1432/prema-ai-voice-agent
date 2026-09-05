import { useState } from "react";
import type { FormField, FormOptionsApi } from "../../../api";
import { Button } from "../../../components";
import { FIELD_TYPES, optionTypes } from "../fieldTypes";

const CONDITION_OPS = [
  { v: "eq", l: "equals" },
  { v: "neq", l: "not equals" },
  { v: "in", l: "is one of (comma list)" },
  { v: "gt", l: "greater than" },
  { v: "lt", l: "less than" },
  { v: "empty", l: "is empty" },
];

export default function FieldModal({
  field,
  otherFields,
  onClose,
  onSave,
}: {
  field: FormField;
  otherFields: FormField[];
  onClose: () => void;
  onSave: (f: FormField) => void;
}) {
  const [f, setF] = useState<FormField>({
    ...field,
    options: [...(field.options ?? [])],
    options_api: field.options_api ? { ...field.options_api } : null,
    show_when: field.show_when ? { ...field.show_when } : null,
    validation: { ...(field.validation ?? {}) },
  });
  const isChoice = optionTypes(f.type);
  const [liveApi, setLiveApi] = useState(Boolean(f.options_api?.url));
  const [useCond, setUseCond] = useState(Boolean(f.show_when?.field));

  const patch = (p: Partial<FormField>) => setF((prev) => ({ ...prev, ...p }));

  const setApi = (p: Partial<FormOptionsApi>) =>
    patch({ options_api: { url: "", ...(f.options_api ?? {}), ...p } });

  const save = () => {
    onSave({
      ...f,
      options_api: isChoice && liveApi ? f.options_api : null,
      show_when: useCond && f.show_when?.field ? f.show_when : null,
    });
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="card pop" style={{ maxWidth: 720, width: "100%", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h3>{f.computed ? "🧮" : "🛠"} Edit field</h3>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="lbl">Question / label *</label>
            <input className="input" value={f.label} onChange={(e) => patch({ label: e.target.value })} />
          </div>
          <div>
            <label className="lbl">Field type</label>
            <select className="select" value={f.type} disabled={f.computed} onChange={(e) => patch({ type: e.target.value })}>
              {FIELD_TYPES.map((t) => (
                <option key={t.type} value={t.type}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Key (used in formulas / API)</label>
            <input className="input" style={{ fontFamily: "monospace" }} value={f.id} onChange={(e) => patch({ id: e.target.value.replace(/[^a-zA-Z0-9_.\-]/g, "_") })} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer", paddingBottom: 8 }}>
              <input type="checkbox" checked={f.required} onChange={(e) => patch({ required: e.target.checked })} /> Required
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer", paddingBottom: 8 }}>
              <input type="checkbox" checked={f.width === "half"} onChange={(e) => patch({ width: e.target.checked ? "half" : "full" })} /> Half width
            </label>
          </div>
        </div>

        {!f.computed && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            <div>
              <label className="lbl">Placeholder</label>
              <input className="input" value={f.placeholder ?? ""} onChange={(e) => patch({ placeholder: e.target.value })} />
            </div>
            <div>
              <label className="lbl">{"Default value ({{formula}} allowed, e.g. {{price}} * 2)"}</label>
              <input className="input" value={f.default ?? ""} onChange={(e) => patch({ default: e.target.value })} />
            </div>
          </div>
        )}

        {f.computed && (
          <div>
            <label className="lbl">Formula (references other fields with {"{{field_key}}"})</label>
            <input className="input" style={{ fontFamily: "monospace" }} value={f.formula ?? ""} onChange={(e) => patch({ formula: e.target.value })} placeholder={'e.g. {{price}} * {{qty}} or {{first}} + " " + {{last}}'} />
          </div>
        )}

        <div>
          <label className="lbl">Help text (optional)</label>
          <input className="input" value={f.help ?? ""} onChange={(e) => patch({ help: e.target.value })} />
        </div>

        {/* choices */}
        {isChoice && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <button type="button" className={`chip ${!liveApi ? "on" : ""}`} onClick={() => setLiveApi(false)}>📝 Fixed options</button>
              <button type="button" className={`chip ${liveApi ? "on" : ""}`} onClick={() => setLiveApi(true)}>🌐 Load from an API</button>
            </div>
            {!liveApi ? (
              <div>
                <label className="lbl">Options — one per line</label>
                <textarea className="input" style={{ height: 90 }} value={(f.options ?? []).join("\n")}
                  onChange={(e) => patch({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
              </div>
            ) : (
              <div className="msg ok" style={{ fontSize: 12, marginBottom: 6 }}>
                Options are fetched live when the form opens. The backend proxies the request and maps the response.
              </div>
            )}
            {liveApi && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="lbl">API URL *</label>
                  <input className="input" value={f.options_api?.url ?? ""} placeholder="https://api.example.com/options" onChange={(e) => setApi({ url: e.target.value })} />
                </div>
                <div>
                  <label className="lbl">Method</label>
                  <select className="select" value={f.options_api?.method ?? "GET"} onChange={(e) => setApi({ method: e.target.value as "GET" | "POST" })}>
                    <option>GET</option><option>POST</option>
                  </select>
                </div>
                <div>
                  <label className="lbl">Request body (JSON, POST)</label>
                  <input className="input" value={f.options_api?.body ?? ""} placeholder={'{"city": "hyderabad"}'} onChange={(e) => setApi({ body: e.target.value })} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="lbl">Headers (JSON)</label>
                  <input className="input" style={{ fontFamily: "monospace" }} value={f.options_api?.headers ?? ""} placeholder='{"Authorization": "Bearer …"}' onChange={(e) => setApi({ headers: e.target.value })} />
                </div>
                <div>
                  <label className="lbl">Path to list (dot path)</label>
                  <input className="input" value={f.options_api?.data_path ?? ""} placeholder="data.items" onChange={(e) => setApi({ data_path: e.target.value })} />
                </div>
                <div>
                  <label className="lbl">Value key (or dot path)</label>
                  <input className="input" value={f.options_api?.value_path ?? ""} placeholder="value | id" onChange={(e) => setApi({ value_path: e.target.value })} />
                </div>
                <div>
                  <label className="lbl">Label key (or dot path)</label>
                  <input className="input" value={f.options_api?.label_path ?? ""} placeholder="label | name" onChange={(e) => setApi({ label_path: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* validation */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 8 }}>
          {(["min", "max", "minlength", "maxlength", "pattern", "step"] as const).map((k) => (
            <div key={k}>
              <label className="lbl">{k === "pattern" ? "Regex pattern" : k}</label>
              <input className="input" value={String(f.validation?.[k] ?? "")} onChange={(e) => {
                const v = { ...f.validation };
                if (e.target.value === "") delete v[k];
                else v[k] = k === "pattern" ? e.target.value : Number(e.target.value);
                patch({ validation: v });
              }} />
            </div>
          ))}
        </div>

        {/* conditional */}
        <div style={{ marginTop: 12, borderTop: "1px dashed var(--border-soft)", paddingTop: 12 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={useCond} onChange={(e) => setUseCond(e.target.checked)} />
            Only show when another field matches
          </label>
          {useCond && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 8 }}>
              <select className="select" value={f.show_when?.field ?? ""} onChange={(e) => patch({ show_when: { ...(f.show_when ?? { op: "eq", value: "" }), field: e.target.value } })}>
                <option value="">— field —</option>
                {otherFields.map((o) => <option key={o.id} value={o.id}>{o.label} ({o.id})</option>)}
              </select>
              <select className="select" value={f.show_when?.op ?? "eq"} onChange={(e) => patch({ show_when: { ...(f.show_when ?? { field: "", value: "" }), op: e.target.value as "eq" | "neq" | "in" | "gt" | "lt" | "empty" } })}>
                {CONDITION_OPS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <input className="input" value={f.show_when?.value ?? ""} placeholder="value" disabled={(f.show_when?.op ?? "eq") === "empty"} onChange={(e) => patch({ show_when: { ...(f.show_when ?? { field: "", op: "eq" }), value: e.target.value } })} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!f.label.trim()}>💾 Save field</Button>
        </div>
      </div>
    </div>
  );
}
