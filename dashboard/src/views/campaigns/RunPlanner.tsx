import { useEffect, useState } from "react";
import { AgentDirectoryItem, api, Campaign } from "../../api";
import { Avatar, Badge, Button, Card, fmtDate } from "../../components";

/* ── datetime-local helpers ───────────────────────────── */
const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function futureInput(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60000);
  d.setSeconds(0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function countdownText(leftMs: number): string {
  const s = Math.max(0, Math.floor(leftMs / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  if (m || h || d) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}

/* ── Live countdown ───────────────────────────────────── */
function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs]);
  return now;
}

/* ── Scheduled campaign summary (used on the list) ────── */
export function ScheduleChip({ campaign }: { campaign: Campaign }) {
  const target = campaign.schedule_start ? new Date(campaign.schedule_start).getTime() : 0;
  const now = useNow(target > 0);
  if (!target) return null;
  const left = target - now;
  const late = left <= 0;
  return (
    <Badge tone={late ? "green" : "violet"}>
      ⏳ {late ? "starting…" : `auto-run in ${countdownText(left)}`}
      {campaign.concurrency > 1 ? ` · ${campaign.concurrency} agents` : ""}
      {campaign.expected_leads ? ` · ≥${campaign.expected_leads} leads` : ""}
    </Badge>
  );
}

/* ── Agent team picker ────────────────────────────────── */
function TeamPicker({
  agents,
  selected,
  onChange,
}: {
  agents: AgentDirectoryItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div>
      <label className="lbl">Agent team to rotate calls across (empty = inline campaign agent)</label>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          maxHeight: 168,
          overflowY: "auto",
          padding: 4,
        }}
      >
        {agents.length === 0 && (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Loading agent directory…
          </span>
        )}
        {agents.map((a) => {
          const on = selected.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className={`agent-chip ${on ? "on" : ""}`}
              title={a.requirements ?? a.description ?? ""}
            >
              <Avatar name={a.name} avatar={a.avatar} accent={a.accent} size={26} />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                <b style={{ fontSize: 12.5 }}>{a.name}</b>
                <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{a.specialization}</span>
              </span>
              {on && <span className="chip-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Run planner card ─────────────────────────────────── */
export default function CampaignRunCard({
  campaign,
  onUpdate,
}: {
  campaign: Campaign;
  onUpdate: () => void;
}) {
  const [agents, setAgents] = useState<AgentDirectoryItem[]>([]);
  const [team, setTeam] = useState<string[]>(campaign.team_agent_ids ?? []);
  const [spin, setSpin] = useState<number>(campaign.concurrency || 1);
  const [goal, setGoal] = useState<string>(
    campaign.expected_leads ? String(campaign.expected_leads) : "",
  );
  const [startVal, setStartVal] = useState<string>(
    toLocalInput(campaign.schedule_start) || futureInput(15),
  );
  const [endVal, setEndVal] = useState<string>(toLocalInput(campaign.schedule_end));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.listAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  const byId = new Map(agents.map((a) => [a.id, a]));
  const teamAgents = (campaign.team_agent_ids ?? [])
    .map((id) => byId.get(id))
    .filter((a): a is AgentDirectoryItem => Boolean(a));

  const isScheduled = campaign.status === "scheduled";
  const target = campaign.schedule_start ? new Date(campaign.schedule_start).getTime() : 0;
  const now = useNow(isScheduled && target > 0);
  const leftMs = target - now;

  async function arm() {
    const start = new Date(startVal);
    if (!startVal || Number.isNaN(start.getTime())) {
      setMsg({ ok: false, text: "Pick a start date & time first." });
      return;
    }
    if (start.getTime() <= Date.now()) {
      setMsg({ ok: false, text: "Start time must be in the future." });
      return;
    }
    const end = endVal ? new Date(endVal) : null;
    if (end && end.getTime() <= start.getTime()) {
      setMsg({ ok: false, text: "End time must be after the start time (or leave it empty)." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.scheduleCampaign(campaign.id, {
        schedule_start: start.toISOString(),
        schedule_end: end ? end.toISOString() : null,
        expected_leads: goal ? Math.max(1, parseInt(goal, 10) || 1) : null,
        concurrency: Math.max(1, Math.min(50, spin)),
        team_agent_ids: team,
      });
      setMsg({ ok: true, text: `⏰ Armed for ${start.toLocaleString()} — campaign will auto-start and spin agents.` });
      onUpdate();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  async function cancelRun() {
    setBusy(true);
    setMsg(null);
    try {
      await api.cancelSchedule(campaign.id);
      setMsg({ ok: true, text: "Run cancelled — campaign is back to draft." });
      onUpdate();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  async function startNow() {
    setBusy(true);
    try {
      await api.startCampaign(campaign.id);
      onUpdate();
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 300) });
    } finally {
      setBusy(false);
    }
  }

  /* Running → the header's Start/Pause already governs it. */
  if (campaign.status === "running") return null;

  if (isScheduled) {
    const late = leftMs <= 0;
    return (
      <Card title="⏰ Scheduled auto-run">
        <div className="run-summary">
          <div className="run-countdown" style={{ fontSize: 26, fontWeight: 800 }}>
            {late ? "Starting now…" : countdownText(leftMs)}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            fires {campaign.schedule_start ? fmtDate(campaign.schedule_start) : "—"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 14px" }}>
            <Badge tone="blue">👥 {campaign.concurrency || 1} agent(s) spinning</Badge>
            {campaign.expected_leads ? (
              <Badge tone="green">🎯 target ≥ {campaign.expected_leads} leads</Badge>
            ) : (
              <Badge tone="gray">🎯 no lead target set</Badge>
            )}
            {campaign.schedule_end && <Badge tone="amber">⏹ auto-pause {fmtDate(campaign.schedule_end)}</Badge>}
            <Badge tone="violet">
              {teamAgents.length > 0 ? `${teamAgents.map((a) => a.name).join(", ")} rotate` : `inline agent ${campaign.agent?.name ?? ""}`}
            </Badge>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="danger" disabled={busy} onClick={cancelRun}>
              ✕ Cancel run
            </Button>
            <Button variant="primary" disabled={busy} onClick={startNow}>
              ▶ Start now instead
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="⚡ Schedule a run"
      action={
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          auto-start · spin agents · set a lead goal
        </span>
      }
    >
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div>
          <label className="lbl">Starts at</label>
          <input
            type="datetime-local"
            className="input"
            value={startVal}
            onChange={(e) => setStartVal(e.target.value)}
          />
        </div>
        <div>
          <label className="lbl">Ends at (optional auto-pause)</label>
          <input
            type="datetime-local"
            className="input"
            value={endVal}
            onChange={(e) => setEndVal(e.target.value)}
          />
        </div>
        <div>
          <label className="lbl">🤖 Agents to spin (max live calls)</label>
          <input
            type="number"
            min={1}
            max={50}
            className="input"
            value={spin}
            onChange={(e) => setSpin(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>
        <div>
          <label className="lbl">🎯 Expected leads (minimum goal)</label>
          <input
            type="number"
            min={1}
            className="input"
            placeholder="e.g. 20"
            value={goal}
            onChange={(e) => setGoal(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
      </div>

      <TeamPicker agents={agents} selected={team} onChange={setTeam} />

      {msg && (
        <div className={`msg ${msg.ok ? "ok" : "err"}`} style={{ marginTop: 10 }}>
          {msg.text}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        <Button variant="primary" disabled={busy} onClick={arm}>
          {busy ? <span className="spinner" /> : "⏰ Arm schedule"}
        </Button>
        <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          At the start time the campaign flips to running and spins up to{" "}
          <b>{spin}</b> agent(s) in parallel — each call is handled by a rotating
          team member{team.length === 0 ? " (your inline agent)" : ""}.
        </span>
      </div>
    </Card>
  );
}
