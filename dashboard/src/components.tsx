import React from "react";
import { LANGUAGES } from "./api";

/* ── Badge ─────────────────────────────────────────────── */
export function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "red" | "gray" | "blue" | "violet";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function StatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? "").toLowerCase();
  const tone: "green" | "amber" | "red" | "gray" | "blue" | "violet" =
    s === "running" || s === "connected" || s === "interested" || s === "completed"
      ? "green"
      : s === "paused" || s === "callback_requested" || s === "new" || s === "dialing"
        ? "amber"
        : s === "failed" || s === "not_interested" || s === "dnd"
          ? "red"
          : s === "in_progress"
            ? "blue"
            : "gray";
  return <Badge tone={tone}>{status ?? "—"}</Badge>;
}

/* ── Button ────────────────────────────────────────────── */
export function Button({
  children,
  onClick,
  variant = "default",
  size,
  block,
  disabled,
  title,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm";
  block?: boolean;
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      className={`btn ${variant} ${size ?? ""} ${block ? "block" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={style}
    >
      {children}
    </button>
  );
}

/* ── Card ──────────────────────────────────────────────── */
export function Card({
  title,
  action,
  children,
  className,
  onClick,
  style,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`card ${onClick ? "clickable" : ""} ${className ?? ""}`}
      onClick={onClick}
      style={style}
    >
      {title !== undefined && (
        <div className="card-head">
          <h3>{title}</h3>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── StatCard ──────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: string;
  tone?: "indigo" | "violet" | "cyan" | "green" | "amber" | "red";
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span className="tone-line" />
      {icon && <span className="icon">{icon}</span>}
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/* ── Progress ──────────────────────────────────────────── */
export function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <div className="bar" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────── */
export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="empty">
      <div className="ic">{icon}</div>
      <div className="t">{title}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

/* ── Language pill (maps code → label) ─────────────────── */
export function LangPill({ code }: { code?: string | null }) {
  if (!code) return <Badge tone="gray">—</Badge>;
  return <Badge tone="violet">{LANGUAGES[code] ?? code}</Badge>;
}

/* ── Avatar (DiceBear image with initials fallback) ────── */
function useAvatarOk(avatar?: string | null) {
  const [ok, setOk] = React.useState(true);
  React.useEffect(() => setOk(true), [avatar]);
  return { ok, fail: () => setOk(false) };
}

export function Avatar({
  name,
  avatar,
  accent = "indigo",
  size = 40,
}: {
  name?: string | null;
  avatar?: string | null;
  accent?: string;
  size?: number;
}) {
  const initials = (name ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  const { ok, fail } = useAvatarOk(avatar);
  return (
    <span className={`avatar accent-${accent}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {avatar && ok ? <img src={avatar} alt={name ?? "agent"} onError={fail} /> : <span>{initials}</span>}
    </span>
  );
}

/* ── Star rating ────────────────────────────────────────── */
export function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
  const filled = Math.round(Math.max(0, Math.min(max, rating)));
  return (
    <span className="stars" title={`${rating.toFixed(1)} / ${max}`}>
      {"★".repeat(filled)}
      <span className="off">{"★".repeat(max - filled)}</span>
    </span>
  );
}

/* ── Simple CSS bar sparkline ───────────────────────────── */
export function Bars({ data, color = "var(--accent-1)" }: { data: number[]; color?: string }) {
  const max = Math.max(1, ...data);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="fade-up"
          style={{
            flex: 1,
            background: color,
            borderRadius: "4px 4px 2px 2px",
            height: `${Math.max(4, (v / max) * 100)}%`,
            opacity: 0.55 + (i / Math.max(1, data.length - 1)) * 0.45,
            transition: "height 0.4s ease",
          }}
        />
      ))}
    </div>
  );
}

/* ── Time helper ───────────────────────────────────────── */
export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}