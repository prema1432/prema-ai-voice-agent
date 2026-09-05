import { useEffect, useRef, useState } from "react";
import { NotificationItem, api } from "../api";
import { navigate } from "../router";

/** Sidebar bell: unread badge, dropdown feed, mark-as-read, link to full page. */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const refresh = () => {
    api.unreadCount().then((r) => setUnread(r.count)).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    api.listNotifications(true).then(setItems).catch(() => {});
  }, [open, unread]);

  // Click-outside to close.
  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function openItem(n: NotificationItem) {
    if (!n.read) {
      await api.markNotificationRead(n.id).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    const campaignId = n.data?.campaign_id as string | undefined;
    const callId = n.data?.call_id as string | undefined;
    if (callId) navigate(`calls/${callId}`);
    else if (campaignId) navigate(`campaigns/${campaignId}`);
  }

  const kindIcon = (k: string) =>
    k === "call" ? "📞" : k === "campaign" ? "📋" : k === "integration" ? "🔌" : "🔔";

  return (
    <div className="bell-wrap" ref={boxRef}>
      <button className="btn sm bell-btn" onClick={() => setOpen((o) => !o)} title="Notifications">
        🔔
        {unread > 0 && <span className="bell-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="bell-pop pop">
          <div className="bell-pop-head">
            <b>Notifications</b>
            <button
              className="btn ghost sm"
              onClick={async () => {
                await api.markAllRead().catch(() => {});
                setUnread(0);
              }}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: "26px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
              🔕 All caught up!
            </div>
          ) : (
            items.map((n) => (
              <button key={n.id} className="bell-item" onClick={() => openItem(n)}>
                <span style={{ fontSize: 16 }}>{kindIcon(n.kind)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 650, fontSize: 12.5, display: "block" }}>{n.title}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block" }}>{n.body}</span>
                </span>
              </button>
            ))
          )}
          <button className="bell-viewall" onClick={() => { setOpen(false); navigate("notifications"); }}>
            View all notifications →
          </button>
        </div>
      )}
    </div>
  );
}
