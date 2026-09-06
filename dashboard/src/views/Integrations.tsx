import { useEffect, useState } from "react";
import { DeliveryLog, Integration, IntegrationCatalogType, api } from "../api";
import { Badge, Button, Card, EmptyState } from "../components";

const ALL_EVENTS = [
  "campaign.started", "campaign.paused", "campaign.completed",
  "leads.added", "lead.moved", "call.ended", "agent.created", "*",
];

type FormState =
  | { mode: "create"; type: string }
  | { mode: "edit"; type: string; instance: Integration }
  | null;

/** Dynamic integrations: catalog-driven cards, inline connect/edit, no popups. */
export default function Integrations() {
  const [list, setList] = useState<Integration[] | null>(null);
  const [types, setTypes] = useState<Record<string, IntegrationCatalogType> | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>([]);
  const [form, setForm] = useState<FormState>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => {
    api.listIntegrations().then(setList).catch((e) => setErr(String(e)));
    api.listDeliveries().then(setDeliveries).catch(() => {});
  };

  useEffect(() => {
    load();
    api.integrationCatalog()
      .then((c) => { setTypes(c.types); setEvents(c.events); })
      .catch(() => {});
    const t = setInterval(() => api.listDeliveries().then(setDeliveries).catch(() => {}), 6000);
    return () => clearInterval(t);
  }, []);

  async function toggle(integration: Integration) {
    setBusyId(integration.id);
    try {
      await api.updateIntegration(integration.id, { enabled: !integration.enabled });
      load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(integration: Integration) {
    if (!window.confirm(`Delete integration "${integration.name}"?`)) return;
    await api.deleteIntegration(integration.id).catch((e) => setErr(String(e)));
    load();
  }

  async function test(integration: Integration) {
    setBusyId(integration.id);
    await api.testIntegration(integration.id).catch((e) => setErr(String(e)));
    setBusyId(null);
  }

  async function copyInbound(integration: Integration) {
    const url = `${location.origin}/api/integrations/in/${integration.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(integration.id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setErr("Clipboard unavailable — copy manually from the card.");
    }
  }

  const byType = new Map<string, Integration[]>();
  for (const i of list ?? []) {
    byType.set(i.type, [...(byType.get(i.type) ?? []), i]);
  }
  const total = list?.length ?? 0;
  const enabled = list?.filter((i) => i.enabled).length ?? 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🔌 Integrations</h2>
          <div className="sub">Connect WhatsApp, Instagram, webhooks, email, SMS &amp; more — every card is a live connection</div>
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Card className="border-top-accent1">
          <div className="value">{total}</div>
          <div className="sub">Total connections</div>
        </Card>
        <Card className="border-top-green">
          <div className="value">{enabled}</div>
          <div className="sub">Live / enabled</div>
        </Card>
        <Card className="border-top-accent3">
          <div className="value">{types ? Object.keys(types).length : "…"}</div>
          <div className="sub">Catalog types</div>
        </Card>
        <Card className="border-top-amber">
          <div className="value">{deliveries.length}</div>
          <div className="sub">Recent deliveries</div>
        </Card>
      </div>

      {types === null ? (
        <Card><div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)" }}>Loading catalog…</div></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, marginTop: 16 }}>
          {Object.entries(types).map(([key, t]) => (
            <TypeCard
              key={key}
              typeKey={key}
              meta={t}
              instances={byType.get(key) ?? []}
              events={events}
              busyId={busyId}
              copied={copied}
              form={form}
              onForm={setForm}
              onToggle={toggle}
              onTest={test}
              onRemove={remove}
              onCopy={copyInbound}
              onChanged={() => { setForm(null); load(); }}
            />
          ))}
        </div>
      )}

      <Card title={<span>🚚 Recent deliveries</span>} style={{ marginTop: 18 }}>
        {deliveries.length === 0 ? (
          <EmptyState icon="🚚" title="No deliveries yet" sub="Enable an integration with a URL and trigger an event to see it here." />
        ) : (
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {deliveries.map((d) => (
              <div key={d.id} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "center" }}>
                <Badge tone={d.direction === "in" ? "blue" : "violet"}>{d.direction === "in" ? "IN" : "OUT"}</Badge>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{d.integration_name ?? d.integration_type} · {d.event}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.url || (d.direction === "in" ? "inbound message" : "no url")}
                  </div>
                </div>
                <Badge tone={d.status.startsWith("delivered") || d.status === "received" ? "green" : d.status.startsWith("error") || d.status.startsWith("http") ? "red" : "amber"}>
                  {d.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** One catalog-type card: status of every instance + inline connect/edit form. */
function TypeCard({
  typeKey, meta, instances, events, busyId, copied, form,
  onForm, onToggle, onTest, onRemove, onCopy, onChanged,
}: {
  typeKey: string;
  meta: IntegrationCatalogType;
  instances: Integration[];
  events: string[];
  busyId: string | null;
  copied: string | null;
  form: FormState;
  onForm: (f: FormState) => void;
  onToggle: (i: Integration) => void;
  onTest: (i: Integration) => void;
  onRemove: (i: Integration) => void;
  onCopy: (i: Integration) => void;
  onChanged: () => void;
}) {
  const active = instances.filter((i) => i.enabled).length;
  const editing = form && form.type === typeKey ? form : null;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 750, fontSize: 14.5 }}>{meta.label}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{meta.blurb}</div>
        </div>
        {instances.length > 0 && (
          <Badge tone={active > 0 ? "green" : "gray"}>
            {active > 0 ? `● ${active}/${instances.length} live` : "○ disconnected"}
          </Badge>
        )}
      </div>

      {/* Connected instances, inline */}
      {instances.map((i) => (
        <div
          key={i.id}
          className={i.enabled ? "" : "muted-card"}
          style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", background: "var(--well)" }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ fontSize: 13 }}>{i.name}</b>
            <Badge tone={i.enabled ? "green" : "gray"}>{i.enabled ? "● connected" : "○ disconnected"}</Badge>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, wordBreak: "break-all" }}>
            {i.config.url || "no endpoint yet"} · {i.events?.join(", ")}
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
            <Button size="sm" variant={i.enabled ? "default" : "primary"} disabled={busyId === i.id} onClick={() => onToggle(i)}>
              {i.enabled ? "Pause" : "Enable"}
            </Button>
            <Button size="sm" disabled={busyId === i.id} onClick={() => onTest(i)} title="Send a test ping">🧪</Button>
            <Button size="sm" disabled={busyId === i.id} onClick={() => onForm({ mode: "edit", type: typeKey, instance: i })} title="Modify config">
              ✏️
            </Button>
            {i.token && (
              <button className="btn ghost sm" style={{ padding: "2px 6px", fontSize: 11 }} onClick={() => onCopy(i)}>
                {copied === i.id ? "✓ Copied" : "📥 Inbound URL"}
              </button>
            )}
            <Button size="sm" variant="danger" disabled={busyId === i.id} onClick={() => onRemove(i)}>🗑</Button>
          </div>
        </div>
      ))}

      {/* Inline connect / modify form — no popup */}
      {editing ? (
        <InlineForm
          key={editing.mode === "edit" ? editing.instance.id : "new"}
          typeKey={typeKey}
          mode={editing.mode}
          meta={meta}
          events={events}
          instance={editing.mode === "edit" ? editing.instance : undefined}
          onCancel={() => onForm(null)}
          onDone={onChanged}
        />
      ) : (
        <Button
          variant={instances.length === 0 ? "primary" : "ghost"}
          size="sm"
          onClick={() => onForm({ mode: "create", type: typeKey })}
          style={{ marginTop: "auto" }}
        >
          {instances.length === 0 ? `➕ Connect ${meta.label}` : "➕ Add another connection"}
        </Button>
      )}
    </Card>
  );
}

/** Compact inline form reused for both connect (create) and modify (edit). */
function InlineForm({
  typeKey, mode, meta, events, instance, onCancel, onDone,
}: {
  typeKey: string;
  mode: "create" | "edit";
  meta: IntegrationCatalogType;
  events: string[];
  instance?: Integration;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(instance?.name ?? "");
  const [desc, setDesc] = useState(instance?.description ?? "");
  const [url, setUrl] = useState(instance?.config.url ?? "");
  const [secret, setSecret] = useState(instance?.config.secret ?? "");
  const [selected, setSelected] = useState<string[]>(instance?.events?.length ? instance.events : ["*"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleEvent(ev: string) {
    setSelected((s) => {
      if (ev === "*") return s.includes("*") ? [] : ["*"];
      if (s.includes("*")) return [ev];
      return s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev];
    });
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        name: name.trim() || `${meta.label} ${Date.now().toString(36)}`,
        description: desc.trim(),
        config: { url: url.trim(), secret: secret.trim() },
        events: selected.length ? selected : ["*"],
      };
      if (mode === "edit" && instance) await api.updateIntegration(instance.id, body);
      else await api.createIntegration({ ...body, type: typeKey, enabled: true });
      onDone();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 10, background: "var(--well)", display: "flex", flexDirection: "column", gap: 7 }}>
      <div className="lbl" style={{ marginTop: 0 }}>{mode === "edit" ? "✏️ Modify connection" : `🔗 Connect ${meta.label}`}</div>
      <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" placeholder="Endpoint URL (where events are POSTed)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <input className="input" placeholder="Secret / token (X-Webhook-Secret)" value={secret} onChange={(e) => setSecret(e.target.value)} />
      <input className="input" placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div>
        <div className="lbl" style={{ marginBottom: 4 }}>Events</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {(events.length ? events : ALL_EVENTS).map((ev) => (
            <button key={ev} className={`chip ${selected.includes(ev) ? "on" : ""}`} onClick={() => toggleEvent(ev)}>
              {ev}
            </button>
          ))}
        </div>
      </div>
      {err && <div className="msg err" style={{ fontSize: 11.5, padding: "6px 8px" }}>{err}</div>}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <Button size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={submit}>
          {busy ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Saving…</> : mode === "edit" ? "💾 Save" : "✨ Connect"}
        </Button>
      </div>
    </div>
  );
}