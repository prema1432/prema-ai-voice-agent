import { useEffect, useState } from "react";
import { DeliveryLog, Integration, IntegrationCatalogType, api } from "../api";
import { Badge, Button, Card, EmptyState } from "../components";
import { CreateIntegrationModal } from "./integrations/CreateIntegrationModal";

const TYPE_ICON: Record<string, string> = {
  webhook: "🔗", whatsapp: "💬", instagram: "📸", email: "✉️", sms: "📱",
  push: "🔔", telegram: "✈️", crm: "🗂", custom: "🧩",
};

/** Dynamic integrations: catalog-driven cards, enable/test/delete + deliveries. */
export default function Integrations() {
  const [list, setList] = useState<Integration[] | null>(null);
  const [types, setTypes] = useState<Record<string, IntegrationCatalogType> | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>([]);
  const [showCreate, setShowCreate] = useState(false);
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

  const total = list?.length ?? 0;
  const enabled = list?.filter((i) => i.enabled).length ?? 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🔌 Integrations</h2>
          <div className="sub">Connect WhatsApp, Instagram, webhooks, email, SMS &amp; more — dynamically, no code</div>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>➕ Add integration</Button>
      </div>

      {err && <div className="msg err">{err}</div>}

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Card style={{ borderTop: "3px solid var(--accent-1)" }}>
          <div className="value">{total}</div>
          <div className="sub">Total integrations</div>
        </Card>
        <Card style={{ borderTop: "3px solid var(--green)" }}>
          <div className="value">{enabled}</div>
          <div className="sub">Enabled</div>
        </Card>
        <Card style={{ borderTop: "3px solid var(--accent-3)" }}>
          <div className="value">{types ? Object.keys(types).length : "…"}</div>
          <div className="sub">Catalog types</div>
        </Card>
        <Card style={{ borderTop: "3px solid #f59e0b" }}>
          <div className="value">{deliveries.length}</div>
          <div className="sub">Recent deliveries</div>
        </Card>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          {list === null ? (
            <Card><div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)" }}>Loading…</div></Card>
          ) : list.length === 0 ? (
            <Card>
              <EmptyState icon="🔌" title="No integrations yet" sub="Add a webhook or WhatsApp gateway to start receiving platform events." />
            </Card>
          ) : (
            <div className="stack">
              {list.map((integration) => (
                <Card key={integration.id} className={integration.enabled ? "" : "muted-card"} style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ fontSize: 22 }}>{TYPE_ICON[integration.type] ?? "🔌"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <b>{integration.name}</b>
                        <Badge tone="violet">{integration.type}</Badge>
                        <Badge tone={integration.enabled ? "green" : "gray"}>{integration.enabled ? "● active" : "○ off"}</Badge>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {integration.config.url || "no endpoint yet"} · {integration.events?.join(", ")}
                      </div>
                      {integration.token && (
                        <button
                          className="btn ghost sm"
                          style={{ marginTop: 6, padding: "2px 6px", fontSize: 11 }}
                          onClick={() => copyInbound(integration)}
                        >
                          {copied === integration.id ? "✓ Copied" : "📥 Copy inbound URL"}
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Button size="sm" variant={integration.enabled ? "default" : "primary"} disabled={busyId === integration.id} onClick={() => toggle(integration)}>
                        {integration.enabled ? "Pause" : "Enable"}
                      </Button>
                      <Button size="sm" disabled={busyId === integration.id} onClick={() => test(integration)} title="Send a test ping">
                        🧪
                      </Button>
                      <Button size="sm" variant="danger" disabled={busyId === integration.id} onClick={() => remove(integration)}>
                        🗑
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <Card title={<span>🚚 Recent deliveries</span>}>
            {deliveries.length === 0 ? (
              <EmptyState icon="🚚" title="No deliveries yet" sub="Enable an integration with a URL and trigger an event to see it here." />
            ) : (
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
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
      </div>

      {showCreate && (
        <CreateIntegrationModal
          types={types ?? {}}
          events={events}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
