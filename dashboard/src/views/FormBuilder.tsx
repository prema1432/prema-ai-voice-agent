import { useCallback, useEffect, useMemo, useState } from "react";
import { FormAction, FormDef, FormField, FormStep, api } from "../api";
import { Badge, Button, Card, EmptyState, StatusBadge } from "../components";
import { navigate } from "../router";
import ActionModal from "./forms/builder/ActionModal";
import FieldModal from "./forms/builder/FieldModal";
import { FIELD_TYPES, fieldTypeLabel, newStepId, sampleField, typeMeta } from "./forms/fieldTypes";

export default function FormBuilder({ id }: { id: string }) {
  const [form, setForm] = useState<FormDef | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeStep, setActiveStep] = useState<string>("");
  const [editField, setEditField] = useState<FormField | null>(null);
  const [addingField, setAddingField] = useState<string | null>(null); // type menu
  const [editAction, setEditAction] = useState<FormAction | null>(null);
  const [actionOpen, setActionOpen] = useState(false);

  const load = useCallback(() => {
    api.getForm(id).then((f) => {
      setForm(f);
      if (!f.steps.some((s) => s.id === activeStep)) setActiveStep(f.steps[0]?.id ?? "");
      setDirty(false);
    }).catch(() => setForm(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => load(), [load]);

  const patch = (p: Partial<FormDef>) => {
    setForm((prev) => (prev ? { ...prev, ...p } : prev));
    setDirty(true);
  };

  const steps = form?.steps ?? [];
  const step = useMemo(() => steps.find((s) => s.id === activeStep) ?? steps[0], [steps, activeStep]);
  const allFields = useMemo(() => steps.flatMap((s) => s.fields), [steps]);

  function patchStep(next: FormStep) {
    patch({ steps: steps.map((s) => (s.id === next.id ? next : s)) });
  }

  function addStep() {
    const s: FormStep = { id: newStepId(), title: `Step ${steps.length + 1}`, fields: [] };
    patch({ steps: [...steps, s] });
    setActiveStep(s.id);
  }

  function removeStep(sid: string) {
    if (steps.length <= 1) return;
    if (!window.confirm("Delete this step and its fields?")) return;
    const rest = steps.filter((s) => s.id !== sid);
    patch({ steps: rest });
    setActiveStep(rest[0]?.id ?? "");
  }

  function moveField(idx: number, dir: -1 | 1) {
    if (!step) return;
    const fields = [...step.fields];
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[idx], fields[j]] = [fields[j], fields[idx]];
    patchStep({ ...step, fields });
  }

  function removeField(idx: number) {
    if (!step || !window.confirm(`Delete "${step.fields[idx]?.label}"?`)) return;
    const fields = step.fields.filter((_, i) => i !== idx);
    patchStep({ ...step, fields });
  }

  async function save() {
    if (!form || !form.title.trim()) {
      setMsg({ ok: false, text: "Give the form a title first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.updateForm(id, {
        title: form.title,
        description: form.description ?? "",
        slug: form.slug ?? "",
        settings: form.settings,
        steps: form.steps,
        actions: form.actions ?? [],
      });
      setDirty(false);
      setMsg({ ok: true, text: "Form saved ✓" });
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish() {
    if (!form) return;
    setBusy(true);
    try {
      if (form.published) {
        await api.unpublishForm(form.id);
        setMsg({ ok: true, text: "Form is offline." });
      } else {
        const r = await api.publishForm(form.id);
        setMsg({ ok: true, text: `🚀 Live at ${location.origin}/f/${r.slug}` });
      }
      load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  function copyShare() {
    if (!form?.slug) return;
    const url = `${location.origin}/f/${encodeURIComponent(form.slug)}`;
    navigator.clipboard?.writeText?.(url);
    setMsg({ ok: true, text: `🔗 ${url}` });
  }

  if (!form) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate("forms")}>← Back to forms</Button>
        <EmptyState icon="🔍" title="Form not found" sub="It may have been deleted, or the backend is offline." />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("forms")}>← Back to forms</Button>

      <div className="page-head" style={{ marginTop: 10 }}>
        <div style={{ flex: "1 1 320px" }}>
          <input
            className="input"
            style={{ fontSize: 22, fontWeight: 750, padding: "6px 12px", width: "100%", border: "none", background: "transparent" }}
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Form title"
          />
          <input
            className="input"
            style={{ fontSize: 13, color: "var(--text-muted)", width: "100%", border: "none", background: "transparent" }}
            value={form.description ?? ""}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Short description shown to people who open the form…"
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <StatusBadge status={form.published ? "Live" : "Draft"} />
            {form.slug && form.published && (
              <Button size="sm" variant="ghost" onClick={copyShare}>🔗 {form.slug} · copy link</Button>
            )}
            {dirty && <Badge tone="amber">unsaved</Badge>}
          </div>
        </div>
        <div className="page-head-actions">
          {form.published && <Button onClick={() => navigate(`forms/${id}/submissions`)}>📥 Submissions</Button>}
          {form.published && <Button onClick={() => navigate(`f/${form.slug}`)}>👁 Preview</Button>}
          <Button variant="default" onClick={togglePublish} disabled={busy}>
            {form.published ? "⏹ Unpublish" : "🚀 Publish"}
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !dirty}>
            {busy ? <span className="spinner" /> : "💾 Save"}
          </Button>
        </div>
      </div>

      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      <div className="grid-2" style={{ alignItems: "start", gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        {/* ── Left: builder canvas ── */}
        <Card className="pop">
          {/* steps */}
          <div className="card-head">
            <h3>🪜 Steps</h3>
            <Button size="sm" onClick={addStep}>➕ Add step</Button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {steps.map((s, i) => (
              <div key={s.id} className={`chip ${step?.id === s.id ? "on" : ""}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer" }} onClick={() => setActiveStep(s.id)}>
                  {i + 1}. {s.title || `Step ${i + 1}`}
                </button>
                {steps.length > 1 && (
                  <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }} onClick={() => removeStep(s.id)}>✕</button>
                )}
              </div>
            ))}
          </div>

          {step && (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <input
                  className="input"
                  style={{ flex: 1, fontWeight: 650 }}
                  value={step.title}
                  onChange={(e) => patchStep({ ...step, title: e.target.value })}
                />
                <input
                  className="input"
                  style={{ flex: 2 }}
                  value={step.description ?? ""}
                  placeholder="Step description (optional)"
                  onChange={(e) => patchStep({ ...step, description: e.target.value })}
                />
              </div>

              {step.fields.length === 0 ? (
                <EmptyState icon="🧩" title="No fields in this step" sub="Add your first question below." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                  {step.fields.map((fld, idx) => (
                    <div key={fld.id} className="bf-row" style={{
                      display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border-soft)",
                      borderRadius: 10, padding: "7px 10px", background: "var(--bg-soft)",
                    }}>
                      <div style={{ fontSize: 16 }}>{typeMeta(fld.type).icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          {fld.label}
                          {fld.required && <span className="text-red">*</span>}
                          {fld.computed && <Badge tone="violet">🧮 computed</Badge>}
                          {fld.show_when && <Badge tone="amber">if {fld.show_when.field}</Badge>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                          {fieldTypeLabel(fld.type)} · <code>{fld.id}</code>
                          {fld.options_api?.url ? ` · 🌐 ${fld.options_api.url}` : fld.options?.length ? ` · ${fld.options.length} options` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Button size="sm" variant="ghost" onClick={() => setEditField(fld)}>✎</Button>
                        <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => moveField(idx, -1)}>↑</Button>
                        <Button size="sm" variant="ghost" disabled={idx === step.fields.length - 1} onClick={() => moveField(idx, 1)}>↓</Button>
                        <Button size="sm" variant="ghost" onClick={() => removeField(idx)}>🗑</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {addingField && step && (
                <div className="pop" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10, marginBottom: 10 }}>
                  {(["basic", "choice", "media", "logic"] as const).map((g) => (
                    <div key={g} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-faint)", margin: "4px 2px" }}>{g}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {FIELD_TYPES.filter((t) => t.group === g).map((t) => (
                          <button
                            key={t.type}
                            type="button"
                            className="chip"
                            onClick={() => {
                              patchStep({ ...step, fields: [...step.fields, sampleField(t.type)] });
                              setAddingField(null);
                            }}
                          >
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" variant="primary" onClick={() => setAddingField((v) => (v ? null : "open"))}>
                {addingField ? "✕ Close" : "➕ Add field"}
              </Button>
            </>
          )}
        </Card>

        {/* ── Right: settings + actions ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="⚙️ Form settings">
            <label className="lbl">Submit button text</label>
            <input className="input" value={form.settings?.submit_label ?? "Submit"} onChange={(e) => patch({ settings: { ...(form.settings ?? {}), submit_label: e.target.value } })} />
            <label className="lbl" style={{ marginTop: 8 }}>Success message</label>
            <input className="input" value={form.settings?.success_message ?? ""} onChange={(e) => patch({ settings: { ...(form.settings ?? {}), success_message: e.target.value } })} />
            <label className="lbl" style={{ marginTop: 8 }}>Redirect URL after submit (optional)</label>
            <input className="input" value={form.settings?.redirect_url ?? ""} onChange={(e) => patch({ settings: { ...(form.settings ?? {}), redirect_url: e.target.value } })} />
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, marginTop: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.settings?.show_progress !== false} onChange={(e) => patch({ settings: { ...(form.settings ?? {}), show_progress: e.target.checked } })} />
              Show step progress bar
            </label>
          </Card>

          <Card
            title={`⚙ Workflows (${(form.actions ?? []).length})`}
            action={<Button size="sm" onClick={() => setActionOpen(true)}>➕ Add</Button>}
          >
            {(form.actions ?? []).length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No actions yet. Trigger emails, webhooks, Google Sheets or campaign leads when someone submits.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(form.actions ?? []).map((act, i) => (
                <div key={act.id} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border-soft)", borderRadius: 9, padding: "6px 8px", opacity: act.enabled === false ? 0.6 : 1 }}>
                  <Badge tone={act.enabled === false ? "gray" : "blue"}>{ACT_ICON[act.type] ?? "⚙"} {act.name}</Badge>
                  <div style={{ flex: 1, fontSize: 10.5, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {actSummary(act)}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditAction(act)}>✎</Button>
                  <Button size="sm" variant="ghost" onClick={() => patch({ actions: (form.actions ?? []).filter((_, j) => j !== i) })}>🗑</Button>
                </div>
              ))}
            </div>
          </Card>

          <Card title="🔗 Share" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {form.published && form.slug
              ? <div>Anyone with <code>{location.origin}/f/{form.slug}</code> can fill this form.</div>
              : <div>Publish to generate a public share link. Submissions are stored in MongoDB and every workflow action is logged per response.</div>}
          </Card>
        </div>
      </div>

      {editField && (
        <FieldModal
          field={editField}
          otherFields={allFields.filter((x) => x.id !== editField.id)}
          onClose={() => setEditField(null)}
          onSave={(nf) => {
            if (!step) return;
            patchStep({ ...step, fields: step.fields.map((x) => (x.id === editField.id ? nf : x)) });
            setEditField(null);
          }}
        />
      )}

      {actionOpen && (
        <ActionModal
          onClose={() => setActionOpen(false)}
          onSave={(na) => {
            patch({ actions: [...(form.actions ?? []), na] });
            setActionOpen(false);
          }}
        />
      )}
      {editAction && (
        <ActionModal
          action={editAction}
          onClose={() => setEditAction(null)}
          onSave={(na) => {
            patch({ actions: (form.actions ?? []).map((x) => (x.id === na.id ? na : x)) });
            setEditAction(null);
          }}
        />
      )}
    </div>
  );
}

const ACT_ICON: Record<string, string> = {
  webhook: "🌐", google_sheet: "📊", email: "✉️", notification: "🔔", campaign_lead: "📞",
};

function actSummary(a: FormAction): string {
  const c = a.config as Record<string, string>;
  if (a.type === "campaign_lead") return `lead into campaign ${c.campaign_id?.slice(0, 8) ?? "?"}`;
  return c.url ?? c.to ?? c.title ?? c.message ?? "";
}
