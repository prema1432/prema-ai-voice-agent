import { useCallback, useEffect, useState } from "react";
import { NotificationItem, api } from "../api";
import { Badge, Button, Card, EmptyState, fmtDate } from "../components";

const KIND_ICON: Record<string, string> = {
  call: "📞",
  campaign: "📋",
  integration: "🔌",
  info: "🔔",
};

function channelTone(status: string) {
  if (status === "sent" || status === "delivered") return "green" as const;
  if (status === "pending") return "amber" as const;
  return "gray" as const;
}

/** Full notification feed — read/unread, per-channel delivery status. */
export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const load = useCallback(() => {
    api.listNotifications(onlyUnread).then(setItems).catch((e) => setErr(String(e)));
  }, [onlyUnread]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function markRead(id: string) {
    await api.markNotificationRead(id).catch(() => {});
    load();
  }

  async function sendSample() {
    await api.sendSampleNotification().catch((e) => setErr(String(e)));
    load();
  }

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🔔 Notifications</h2>
          <div className="sub">In-app feed with per-channel delivery status (email / SMS / WhatsApp / push)</div>
        </div>
        <div className="page-head-actions">
          <Button size="sm" onClick={sendSample}>🧪 Send test notification</Button>
          <Button size="sm" onClick={() => api.markAllRead().then(load)}>✓ Mark all read</Button>
          <Button size="sm" variant={onlyUnread ? "primary" : "default"} onClick={() => setOnlyUnread((v) => !v)}>
            {onlyUnread ? "Unread only" : `All (${unread} unread)`}
          </Button>
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      {items === null ? (
        <Card><div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)" }}>Loading…</div></Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon="🔕" title="No notifications" sub="Campaign start/stop, hot leads, DND requests and integration events will show here." />
        </Card>
      ) : (
        <div className="stack">
          {items.map((n) => (
            <Card key={n.id} className={n.read ? "notif read" : "notif unread"} style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 20 }}>{KIND_ICON[n.kind] ?? "🔔"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <b style={{ fontSize: 13.5 }}>{n.title}</b>
                    {!n.read && <Badge tone="blue">new</Badge>}
                    {n.ts && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-faint)" }}>{fmtDate(n.ts)}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.55 }}>{n.body}</div>
                  {n.channels && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {Object.entries(n.channels).map(([ch, st]) => (
                        <Badge key={ch} tone={channelTone(st)}>
                          {ch === "in_app" ? "🖥 in-app" : ch} · {st.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {!n.read && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(n.id)} title="Mark read">✓</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
