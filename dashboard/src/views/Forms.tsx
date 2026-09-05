import { useCallback, useEffect, useState } from "react";
import { FormDef, api } from "../api";
import { Badge, Button, Card, EmptyState, StatusBadge } from "../components";
import { navigate } from "../router";

export default function Forms() {
  const [forms, setForms] = useState<FormDef[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.listForms().then(setForms).catch((e) => setMsg({ ok: false, text: String(e).slice(0, 200) }));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  async function newForm() {
    setCreating(true);
    try {
      const res = await api.createForm({
        title: "Untitled form",
        description: "",
        settings: { submit_label: "Submit", success_message: "Thank you — your response has been recorded.", show_progress: true },
        steps: [{ id: `step_${Date.now().toString(36)}`, title: "Step 1", fields: [] }],
        actions: [],
      });
      navigate(`forms/${res.id}`);
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 200) });
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(f: FormDef) {
    setBusy(true);
    try {
      if (f.published) await api.unpublishForm(f.id);
      else await api.publishForm(f.id);
      load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 200) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: FormDef) {
    if (!window.confirm(`Delete form "${f.title}" and all its submissions?`)) return;
    setBusy(true);
    try {
      await api.deleteForm(f.id);
      load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 200) });
    } finally {
      setBusy(false);
    }
  }

  function shareLink(f: FormDef) {
    const url = `${location.origin}/f/${encodeURIComponent(f.slug ?? "")}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => setMsg({ ok: true, text: `📋 Link copied: ${url}` }),
        () => setMsg({ ok: true, text: url }),
      );
    } else {
      setMsg({ ok: true, text: url });
    }
  }

  const fieldCount = (f: FormDef) =>
    f.field_count ?? f.steps.reduce((s, st) => s + st.fields.length, 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>📝 Forms</h2>
          <div className="sub">
            Build multi-step forms, publish a public link, and run workflows on every submission
          </div>
        </div>
        <div className="page-head-actions">
          <Button variant="primary" disabled={creating} onClick={newForm}>
            {creating ? <span className="spinner" /> : "🚀 New form"}
          </Button>
        </div>
      </div>

      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      {forms.length === 0 ? (
        <Card>
          <EmptyState
            icon="📝"
            title="No forms yet"
            sub="Create a form builder page — add text, choices, numbers, ratings, computed fields and dynamic dropdowns fed by an API."
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {forms.map((f) => (
            <Card key={f.id} className="pop">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <StatusBadge status={f.published ? "Live" : "Draft"} />
                    <span style={{ fontWeight: 750, fontSize: 15 }}>{f.title}</span>
                    {f.slug && f.published && <Badge tone="violet">/{f.slug}</Badge>}
                  </div>
                  {f.description && (
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 5 }}>{f.description}</div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 9 }}>
                    <Badge tone="blue">🧩 {fieldCount(f)} fields</Badge>
                    <Badge tone="gray">🪜 {f.steps.length} step{f.steps.length === 1 ? "" : "s"}</Badge>
                    <Badge tone="gray">⚙ {(f.actions ?? []).length} action{(f.actions ?? []).length === 1 ? "" : "s"}</Badge>
                    <Badge tone={f.submissions ? "green" : "gray"}>📥 {f.submissions ?? 0} submissions</Badge>
                  </div>
                </div>

                <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <Button size="sm" variant="primary" onClick={() => navigate(`forms/${f.id}`)}>
                    🛠 Build
                  </Button>
                  <Button size="sm" onClick={() => navigate(`forms/${f.id}/submissions`)} disabled={!f.submissions}>
                    📥 Submissions
                  </Button>
                  {f.published ? (
                    <>
                      <Button size="sm" onClick={() => shareLink(f)} title="Copy public link">🔗 Share</Button>
                      <Button size="sm" onClick={() => togglePublish(f)} disabled={busy} title="Take offline">⏹ Unpublish</Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => togglePublish(f)} disabled={busy} title="Go live with a shareable link">🚀 Publish</Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => remove(f)} disabled={busy}>🗑</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
