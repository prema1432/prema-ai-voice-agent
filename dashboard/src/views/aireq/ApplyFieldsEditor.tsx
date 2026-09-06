import { useState } from "react";
import { Badge, Button, Card } from "../../components";
import { APPLY_FIELD_TYPES, ApplyField, ApplyFieldType, JobReq, nid } from "./model";

/**
 * Per-job application form editor: the fields a candidate must fill at the
 * public link. Each field can be marked mandatory or optional.
 */
export default function ApplyFieldsEditor({
  job,
  onChange,
}: {
  job: JobReq;
  onChange: (fields: ApplyField[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const fields = job.applyFields;

  function update(id: string, patch: Partial<ApplyField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function remove(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const i = fields.findIndex((f) => f.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function add() {
    onChange([
      ...fields,
      { id: nid("af"), label: "", type: "text", required: false, placeholder: "" },
    ]);
  }

  const required = fields.filter((f) => f.required).length;

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h3>📝 Application form</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge tone="blue">{fields.length} field{fields.length === 1 ? "" : "s"}</Badge>
          <Badge tone={required ? "green" : "gray"}>{required} mandatory</Badge>
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? "▲ Hide" : "▼ Configure fields"}
          </Button>
        </div>
      </div>
      <p className="sub" style={{ margin: "-2px 0 4px" }}>
        Fields candidates must fill on the shared application link. Mandatory fields block an
        incomplete submit — the Applied stage validates them automatically on arrival.
      </p>

      {open && (
        <div className="jr-af">
          <div className="jr-af-list">
            {fields.map((f, i) => (
              <div key={f.id} className="jr-af-row">
                <button type="button" className="jr-af-grip" title="Drag handle" tabIndex={-1}>⠿</button>
                <input
                  className="input"
                  placeholder="Field label (e.g. Years of experience)"
                  value={f.label}
                  onChange={(e) => update(f.id, { label: e.target.value })}
                />
                <select
                  className="input jr-af-type"
                  title="Field type"
                  value={f.type}
                  onChange={(e) => update(f.id, { type: e.target.value as ApplyFieldType })}
                >
                  {APPLY_FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {f.type === "select" && (
                  <input
                    className="input jr-af-opts"
                    placeholder="Choices, comma separated"
                    value={(f.options ?? []).join(", ")}
                    onChange={(e) =>
                      update(f.id, {
                        options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                )}
                <label className="jr-af-req" title={f.required ? "Mandatory — blocks submit" : "Optional"}>
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => update(f.id, { required: e.target.checked })}
                  />
                  <span>{f.required ? "Mandatory" : "Optional"}</span>
                </label>
                <span className="jr-af-num">{i + 1}</span>
                <span className="jr-af-ops">
                  <button type="button" disabled={i === 0} onClick={() => move(f.id, -1)} title="Move up">↑</button>
                  <button type="button" disabled={i === fields.length - 1} onClick={() => move(f.id, 1)} title="Move down">↓</button>
                  <button type="button" className="danger" onClick={() => remove(f.id)} title="Remove field">🗑</button>
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <Button size="sm" variant="primary" onClick={add}>＋ Add field</Button>
            <span className="sub" style={{ marginLeft: 10 }}>
              {job.title ? "The public form shows these in this order." : ""}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}