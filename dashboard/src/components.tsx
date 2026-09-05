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