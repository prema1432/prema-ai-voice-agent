import { useEffect, useRef, useState } from "react";
import { navigate } from "../router";

export interface UserInfo {
  name: string;
  email: string;
}

/** Topbar profile chip: opens account menu with profile + preferences + logout. */
export default function UserMenu({ user }: { user?: UserInfo | null }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  function logout() {
    try {
      localStorage.removeItem("prema-theme");
      localStorage.removeItem("prema.sidebar.collapsed");
    } catch {
      /* ignore storage errors */
    }
    setOpen(false);
    navigate("");
  }

  if (!user) {
    return (
      <button className="btn ghost sm" onClick={() => navigate("")}>
        Sign out →
      </button>
    );
  }

  return (
    <div className="um-wrap" ref={boxRef}>
      <button className="um-trigger" onClick={() => setOpen((o) => !o)} title={user.email}>
        <span className="um-avatar">{initials(user.name)}</span>
        <span className="um-text">
          <b>{user.name}</b>
          <em>{user.email}</em>
        </span>
        <span className={`um-caret ${open ? "on" : ""}`}>⌄</span>
      </button>

      {open && (
        <div className="um-pop pop">
          <div className="um-pop-head">
            <span className="um-avatar lg">{initials(user.name)}</span>
            <div>
              <b>{user.name}</b>
              <em>{user.email}</em>
            </div>
          </div>

          <div className="um-menu">
            <button onClick={() => { setOpen(false); navigate("profile"); }}>
              👤 My profile
            </button>
            <button onClick={() => { setOpen(false); navigate("invoices"); }}>
              🧾 My invoices
            </button>
            <button onClick={() => { setOpen(false); navigate("audit"); }}>
              🧾 Activity log
            </button>
            <button
              onClick={() => {
                setOpen(false);
                navigate("app");
              }}
            >
              🎙️ Dashboard
            </button>
          </div>

          <button className="um-logout" onClick={logout}>
            ⎋ Sign out
          </button>
        </div>
      )}
    </div>
  );
}