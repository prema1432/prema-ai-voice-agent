import { useEffect, useMemo, useState } from "react";
import { AuditEntry, api } from "../api";
import { Badge, Card, EmptyState, fmtDate } from "../components";

const ACTION_TONE = (a: string): "green" | "amber" | "red" | "gray" | "blue" | "violet" =>
  a.includes("delete") || a === "call.ended"
    ? "red"
    : a.includes("start") || a.includes("created")
      ? "green"
      : a.includes("pause")
        ? "amber"
      : a.includes("moved") || a.includes("updated")
        ? "blue"
          : a.includes("test") || a.includes("sample")
            ? "violet"
            : "gray";

/** Append-only audit trail — every meaningful action, searchable & filterable. */
export default function AuditLogs() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [limit, setLimit] = useState(100);

  const load = (params: Record<string, string> = {}) => {
    const p: Record<string, string> = { limit: String(limit), ...params };
    if (action) p.action = action;
    if (entity) p.entity_type = entity;
    api.listAudit(p).then(setRows).catch((e) => setErr(String(e)));
  };

  useEffect(() => {
    load();
    api.auditStats().then((s) => setStats(s.by_action)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const actions = useMemo(() => Object.keys(stats).sort(), [stats]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🧾 Audit Logs</h2>
          <div className="sub">Append-only trail of every action — campaign ops, lead moves, integrations, call results</div>
        </div>
        <div className="page-head-actions">
          <select className="select" style={{ width: "auto" }} value={entity} onChange={(e) => { setEntity(e.target.value); load({ entity_type: e.target.value }); }}>
            <option value="">All entity types</option>
            {["campaign", "lead", "call", "agent", "integration", "notification"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="select" style={{ width: "auto", maxWidth: 230 }} value={action} onChange={(e) => { setAction(e.target.value); load({ action: e.target.value }); }}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a} ({stats[a]})</option>
            ))}
          </select>
          <select className="select" style={{ width: "auto" }} value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
            {[50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>{n} rows</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      <Card>
        {rows === null ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="🧾" title="Nothing logged yet" sub="Start campaigns, move leads, or test integrations — every action lands here." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(r.ts)}</td>
                    <td><Badge tone={ACTION_TONE(r.action)}>{r.action}</Badge></td>
                    <td style={{ fontSize: 12.5 }}>{r.actor}</td>
                    <td style={{ fontSize: 12.5 }}>
                      {r.entity_type ? (
                        <>
                          {r.entity_type}
                          {r.entity_id && (
                            <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", marginLeft: 4 }}>{r.entity_id.slice(0, 10)}…</span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "var(--text-faint)" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 380 }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {JSON.stringify(r.meta ?? {})}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {Object.keys(stats).length > 0 && (
        <Card title="📊 By action" style={{ marginTop: 18 }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {actions.map((a) => (
              <Badge key={a} tone={ACTION_TONE(a)}>
                {a}: {stats[a]}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
