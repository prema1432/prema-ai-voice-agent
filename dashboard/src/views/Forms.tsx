import { useCallback, useEffect, useState } from "react";
import { FormDef, api } from "../api";
import { Badge, Button, Card, EmptyState, StatusBadge } from "../components";
import ViewToggle, { useView } from "../components/ViewToggle";
import { navigate } from "../router";

export default function Forms() {
  const [forms, setForms] = useState<FormDef[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useView("forms");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "live" | "draft">("all");

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

  const filtered = forms.filter((f) => {
    if (status === "live" && !f.published) return false;
    if (status === "draft" && f.published) return false;
    if (!q.trim()) return true;
    const hay = `${f.title} ${f.description ?? ""} ${f.slug ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

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

      <div className="toolbar">
        <div className="search">
          <input
            className="input"
            placeholder="Search title, description, slug…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="chips">
          {(["all", "live", "draft"] as const).map((s) => (
            <button key={s} className={`chip ${status === s ? "on" : ""}`} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="📝"
            title={forms.length === 0 ? "No forms yet" : "Nothing matches"}
            sub={
              forms.length === 0
                ? "Create a form builder page — add text, choices, numbers, ratings, computed fields and dynamic dropdowns fed by an API."
                : "Try a different search term or status filter."
            }
          />
        </Card>
      ) : view === "rows" ? (
        <FormsTable
          forms={filtered}
          fieldCount={fieldCount}
          busy={busy}
          onBuild={(id) => navigate(`forms/${id}`)}
          onSubmissions={(id, has) => has && navigate(`forms/${id}/submissions`)}
          onTogglePublish={togglePublish}
          onShare={shareLink}
          onRemove={remove}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((f) => (
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

/* ── Forms table (Rows view) ────────────────────────────── */
function FormsTable({
  forms,
  fieldCount,
  busy,
  onBuild,
  onSubmissions,
  onTogglePublish,
  onShare,
  onRemove,
}: {
  forms: FormDef[];
  fieldCount: (f: FormDef) => number;
  busy: boolean;
  onBuild: (id: string) => void;
  onSubmissions: (id: string, has: boolean) => void;
  onTogglePublish: (f: FormDef) => void;
  onShare: (f: FormDef) => void;
  onRemove: (f: FormDef) => void;
}) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Form</th>
              <th style={{ textAlign: "right" }}>Fields</th>
              <th style={{ textAlign: "right" }}>Steps</th>
              <th style={{ textAlign: "right" }}>Actions</th>
              <th style={{ textAlign: "right" }}>Submissions</th>
              <th style={{ textAlign: "right" }}>Controls</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((f) => (
              <tr key={f.id}>
                <td><StatusBadge status={f.published ? "Live" : "Draft"} /></td>
                <td>
                  <button className="link" style={{ fontWeight: 700, fontSize: 13, textAlign: "left" }} onClick={() => onBuild(f.id)}>
                    {f.title}
                  </button>
                  {f.slug && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>/{f.slug}</div>
                  )}
                </td>
                <td style={{ textAlign: "right" }} className="num">{fieldCount(f)}</td>
                <td style={{ textAlign: "right" }} className="num">{f.steps.length}</td>
                <td style={{ textAlign: "right" }} className="num">{(f.actions ?? []).length}</td>
                <td style={{ textAlign: "right" }} className="num">{f.submissions ?? 0}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Button size="sm" variant="primary" onClick={() => onBuild(f.id)}>🛠 Build</Button>{" "}
                  <Button size="sm" disabled={!f.submissions} onClick={() => onSubmissions(f.id, !!f.submissions)}>📥</Button>{" "}
                  {f.published && <Button size="sm" onClick={() => onShare(f)} title="Copy public link">🔗</Button>}{" "}
                  <Button size="sm" disabled={busy} onClick={() => onTogglePublish(f)} title={f.published ? "Unpublish" : "Publish"}>
                    {f.published ? "⏹" : "🚀"}
                  </Button>{" "}
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => onRemove(f)}>🗑</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
