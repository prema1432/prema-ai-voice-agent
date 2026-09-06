import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

/* ── Shared chart chrome ─────────────────────────────────── */
const AXIS = { fontSize: 11, fill: "var(--text-faint)", tickLine: false, axisLine: false };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 12,
        boxShadow: "var(--shadow)",
      }}
    >
      {label !== undefined && (
        <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--text)" }}>{String(label)}</div>
      )}
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: "var(--text-muted)" }}>
          {p.name}:{" "}
          <b style={{ color: p.color ?? p.stroke ?? "var(--text)" }}>
            {formatter ? formatter(p.value) : p.value}
          </b>
        </div>
      ))}
    </div>
  );
}

/* ── Area trend chart (calls / tokens / spend over time) ── */
export function TrendChart({
  data, xKey, series, height = 230,
  colors = ["var(--accent-1)", "var(--accent-3)", "#10b981"],
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; name: string; color?: string }[];
  height?: number;
  colors?: string[];
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? colors[i % colors.length]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color ?? colors[i % colors.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
          <XAxis dataKey={xKey} {...AXIS} />
          <YAxis {...AXIS} allowDecimals={false} />
          <Tooltip content={<ChartTip />} />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? colors[i % colors.length]}
              strokeWidth={2.5}
              fill={`url(#g-${s.key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Line chart (lead score / latency) ──────────────────── */
export function LineTrend({
  data, xKey, yKey, name, color = "var(--accent-2)", height = 210,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  name: string;
  color?: string;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
          <XAxis dataKey={xKey} {...AXIS} />
          <YAxis {...AXIS} domain={[0, 100]} />
          <Tooltip content={<ChartTip />} />
          <Line
            type="monotone"
            dataKey={yKey}
            name={name}
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Bar chart (per-day, per-model, languages) ──────────── */
export function ColumnsChart({
  data, xKey, yKey, name, color = "var(--accent-1)", colors, height = 210,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  name: string;
  color?: string;
  colors?: string[];
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
          <XAxis dataKey={xKey} {...AXIS} />
          <YAxis {...AXIS} allowDecimals={false} />
          <Tooltip content={<ChartTip />} />
          <Bar dataKey={yKey} name={name} radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors ? colors[i % colors.length] : color} opacity={0.88} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Donut (outcomes, languages, status mix) ────────────── */
const DONUT_COLORS = [
  "#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#22d3ee", "#a855f7", "#84cc16",
];

export function Donut({
  data, height = 220, centerLabel, centerValue,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <ResponsiveContainer>
        <PieChart>
          <Tooltip content={<ChartTip />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue !== undefined) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {centerValue !== undefined && <b style={{ fontSize: 26, letterSpacing: "-0.02em" }}>{centerValue}</b>}
          {centerLabel && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ── Legend chips for donut charts ──────────────────────── */
export function LegendRow({ items }: { items: { name: string; value: string | number; color?: string }[] }) {
  return (
    <div className="legend-row">
      {items.map((it) => (
        <span className="legend-item" key={it.name}>
          <i className={it.color ? undefined : "legend-color"} style={{ background: it.color }} />
          {it.name}
          <b>{it.value}</b>
        </span>
      ))}
    </div>
  );
}