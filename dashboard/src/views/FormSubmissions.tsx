import { useCallback, useEffect, useState } from "react";
import { FormDef, FormSubmission, api } from "../api";
import { Badge, Button, Card, EmptyState } from "../components";
import { navigate } from "../router";

export default function FormSubmissions({ id }: { id: string }) {
  const [form, setForm] = useState<FormDef | null>(null);
  const [rows, setRows] = useState<FormSubmission[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api.getForm(id).then(setForm).catch(() => setForm(null));
    api.formSubmissions(id).then(setRows).catch((e) => setMsg({ ok: false, text: String(e).slice(0, 200) }));
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function remove(sid: string) {
    if (!window.confirm("Delete this submission?")) return;
    try {
      await api.deleteSubmission(sid);
      load();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 200) });
    }
  }

  const subtitle = (s: FormSubmission) => {
    const a = Object.entries(s.answers ?? {});
    const first = a.find(([, v]) => v !== null && v !== undefined && v !== "")?.[1];
    return first !== undefined ? String(first) : new Date(s.created_at ?? "").toLocaleString();
  };

  if (!form) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate("forms")}>← Back to forms</Button>
        <EmptyState icon="🔍" title="Form not found" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate(`forms/${id}`)}>← Back to builder</Button>

      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h2>📥 {form.title} — submissions</h2>
          <div className="sub">{rows.length} response{rows.length === 1 ? "" : "s"} · stored in MongoDB</div>
        </div>
        <div className="page-head-actions">
          {form.published && form.slug && (
            <Button onClick={() => window.open(`${location.origin}/#/f/${form.slug}`, "_blank")}>🔗 Open form</Button>
          )}
        </div>
      </div>

      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="📭"
            title="No submissions yet"
            sub={form.published ? "Share the form link — every response lands here with its workflow results." : "Publish the form first, then share its link."}
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((s) => {
            const isOpen = open === s.id;
            const okCount = (s.actions ?? []).filter((a) => a.status === "ok").length;
            const failCount = (s.actions ?? []).length - okCount;
            return (
              <Card key={s.id} className={isOpen ? "pop" : ""}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : s.id)}>
                  <span className="dot blue" />
                  <b style={{ fontSize: 13.5 }}>{subtitle(s)}</b>
                  <Badge tone="gray">
                    {new Date(s.created_at ?? "").toLocaleString()}
                  </Badge>
                  {(s.actions ?? []).length > 0 && (
                    <>
                      <Badge tone={failCount > 0 ? "red" : "green"}>⚙ {okCount}/{s.actions?.length} ok</Badge>
                      {failCount > 0 && <Badge tone="red">{failCount} failed</Badge>}
                    </>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-faint)" }}>
                    {isOpen ? "▴" : "▾"}
                  </span>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, borderTop: "1px dashed var(--border-soft)", paddingTop: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
                      <div>
                        <div className="card-head"><h3 style={{ fontSize: 13 }}>🧾 Answers</h3></div>
                        <table className="table">
                          <tbody>
                            {Object.entries(s.answers ?? {}).map(([k, v]) => (
                              <tr key={k}>
                                <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>{k}</td>
                                <td>{Array.isArray(v) ? v.join(", ") : String(v ?? "—")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div>
                        <div className="card-head">
                          <h3 style={{ fontSize: 13 }}>⚙ Workflow results</h3>
                          <Button size="sm" variant="danger" onClick={() => remove(s.id)}>🗑 Delete</Button>
                        </div>
                        {(s.actions ?? []).length === 0 ? (
                          <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No actions ran (none enabled).</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {(s.actions ?? []).map((a, i) => (
                              <div key={i} style={{ border: "1px solid var(--border-soft)", borderRadius: 9, padding: "7px 9px", fontSize: 12 }}>
                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                  <Badge tone={a.status === "ok" ? "green" : "red"}>{a.status === "ok" ? "✓" : "✗"}</Badge>
                                  <b>{a.name}</b>
                                  <span style={{ color: "var(--text-faint)", fontSize: 10.5 }}>{a.type}</span>
                                </div>
                                <div style={{ color: "var(--text-muted)", marginTop: 3, wordBreak: "break-word" }}>{a.detail}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
