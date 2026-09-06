import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, Card } from "../components";
import { navigate } from "../router";

export default function Profile() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [initials, setInitials] = useState("?");

  useEffect(() => {
    api
      .health()
      .then((h) => {
        const u = h.user as { name: string; email: string } | undefined;
        if (u) {
          setUser(u);
          setInitials(
            u.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?",
          );
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>👤 My Profile</h2>
          <div className="sub">Account details, preferences and session controls</div>
        </div>
      </div>

      <div className="grid-2">
        <Card title="🧑‍💼 Account">
          {!user ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading account from /health…</div>
          ) : (
            <div className="prof-block">
              <span className="prof-av">{initials}</span>
              <div>
                <b>{user.name}</b>
                <em>{user.email}</em>
              </div>
            </div>
          )}
          <div className="kv" style={{ marginTop: 14 }}>
            <span>Role</span><code>Administrator</code>
            <span>Plan</span><code>Self-hosted · open source</code>
            <span>Region</span><code>India (TRAI-aware dialing)</code>
            <span>App</span><code>Prema AI Voice Agent</code>
          </div>
        </Card>

        <Card title="⚙️ Preferences">
          <div className="lbl">Theme</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem("prema-theme", "light"); location.reload(); }}>☀️ Light</Button>
            <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem("prema-theme", "dark"); location.reload(); }}>🌙 Dark</Button>
          </div>
          <div className="lbl" style={{ marginTop: 18 }}>PWA</div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Install this app from your browser's menu (“Add to Home Screen”) to get
            offline caching via the service worker.
          </p>
          <div className="lbl" style={{ marginTop: 18 }}>Session</div>
          <Button
            variant="danger"
            onClick={() => {
              localStorage.removeItem("prema-theme");
              localStorage.removeItem("prema.sidebar.collapsed");
              navigate("");
            }}
          >
            ⎋ Sign out
          </Button>
        </Card>
      </div>

      <Card title="🧰 Tech stack" style={{ marginTop: 18 }}>
        <div className="stack-grid">
          {[
            ["Frontend", ["React 18 + Vite 5", "TypeScript (strict)", "Framer Motion", "Recharts", "CSS design tokens"]],
            ["Backend", ["FastAPI (Python)", "Motor async Mongo driver", "Pydantic schemas", "Event bus + FIFO worker"]],
            ["Voice / AI", ["OpenRouter (LLM)", "faster-whisper / IndicConformer STT", "Piper / Indic-Parler TTS", "Silero VAD + barge-in"]],
            ["Telephony", ["Asterisk ARI + SIP trunk", "Browser WebSocket calls", "WhatsApp / webhook hooks optional"]],
            ["Deploy / Ops", ["Docker compose", "Nginx + PWA service worker", "MongoDB (self-hosted or Atlas)", "Local STT/TTS — no paid SaaS"]],
          ].map(([title, items]) => (
            <div className="stack-col" key={title}>
              <b>{title}</b>
              {(items as string[]).map((it) => <span key={it}>{it}</span>)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}