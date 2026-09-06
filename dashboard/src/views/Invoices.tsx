import { useMemo, useState } from "react";
import { Button, Card, EmptyState } from "../components";

interface LineItem {
  id: string;
  desc: string;
  qty: number;
  rate: number;
}

interface Invoice {
  id: string;
  no: string;
  client: string;
  clientEmail: string;
  items: LineItem[];
  gstPct: number;
  notes: string;
  created_at: string;
  status: "draft" | "sent" | "paid";
}

const KEY = "prema.invoices";

function load(): Invoice[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Invoice[];
  } catch {
    return [];
  }
}

function nid() {
  return `inv-${Date.now().toString(36)}`;
}

function blankItems(): LineItem[] {
  return [{ id: nid(), desc: "AI voice campaign — 1,000 leads", qty: 1, rate: 1999 }];
}

export default function Invoices() {
  const [rows, setRows] = useState<Invoice[]>(() => load());
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [items, setItems] = useState<LineItem[]>(blankItems());

  const totals = useMemo(() => {
    const sub = items.reduce((s, it) => s + it.qty * it.rate, 0);
    const gst = (editing?.gstPct ?? 0) / 100;
    return {
      sub,
      gst: sub * gst,
      total: sub * (1 + gst),
    };
  }, [items, editing?.gstPct]);

  function startNew() {
    setItems(blankItems());
    setEditing({
      id: nid(),
      no: `PAI-${String(rows.length + 1).padStart(3, "0")}`,
      client: "",
      clientEmail: "",
      items: blankItems(),
      gstPct: 0,
      notes: "Thank you for your business!",
      created_at: new Date().toISOString(),
      status: "draft",
    });
  }

  function save() {
    if (!editing?.client.trim()) return;
    setRows(rows.some((r) => r.id === editing.id)
      ? rows.map((r) => (r.id === editing.id ? { ...editing, items: items.map((x) => ({ ...x })) } : r))
      : [{ ...editing, items: items.map((x) => ({ ...x })) }, ...rows]);
    setEditing(null);
  }

  function setItem(id: string, patch: Partial<LineItem>) {
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function setStatus(id: string, status: Invoice["status"]) {
    setRows(rows.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      localStorage.setItem(KEY, JSON.stringify(rows.map((r) => (r.id === id ? { ...r, status } : r))));
    } catch {
      /* ignore */
    }
  }

  function printInvoice(inv: Invoice) {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    const sub = inv.items.reduce((s, it) => s + it.qty * it.rate, 0);
    const gst = sub * (inv.gstPct / 100);
    w.document.write(`<!doctype html><html><head><title>${inv.no}</title><style>
      body{font-family:Inter,Arial,sans-serif;max-width:680px;margin:40px auto;color:#111;padding:0 20px}
      h1{font-size:22px}h2{font-size:14px;color:#555}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
      table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:left;padding:8px;border-bottom:1px solid #eee}th{color:#666;font-size:12px;text-transform:uppercase}
      .tot{font-weight:700;font-size:15px}.muted{color:#888}.right{text-align:right}@media print{body{margin:10px}}
      </style></head><body onload="window.print()">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><h1>🎙️ Prema AI Voice Agent</h1><div class="muted">Self-hosted AI calling · invoice</div></div>
        <div class="right"><b class="tot">${inv.no}</b><div class="muted">${new Date(inv.created_at).toLocaleDateString()}</div></div>
      </div>
      <h2>Bill to</h2><div>${inv.client.replace(/</g, "&lt;")}</div><div class="muted">${inv.clientEmail}</div>
      <table><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr>
      ${inv.items.map((it) => `<tr><td>${it.desc.replace(/</g, "&lt;")}</td><td class="right">${it.qty}</td><td class="right">₹${it.rate.toLocaleString("en-IN")}</td><td class="right">₹${(it.qty * it.rate).toLocaleString("en-IN")}</td></tr>`).join("")}
      </table>
      <div style="margin-top:14px;max-width:280px;margin-left:auto">
        <div class="row"><span>Subtotal</span><span>₹${sub.toLocaleString("en-IN")}</span></div>
        <div class="row"><span>GST (${inv.gstPct}%)</span><span>₹${gst.toLocaleString("en-IN")}</span></div>
        <div class="row tot"><span>Total</span><span>₹${(sub + gst).toLocaleString("en-IN")}</span></div>
      </div>
      <p class="muted" style="margin-top:26px">${inv.notes}</p>
      </body></html>`);
    w.document.close();
  }

  const totalDue = useMemo(
    () => rows.filter((r) => r.status === "draft" || r.status === "sent").reduce((s, inv) => {
      const sub = inv.items.reduce((x, it) => x + it.qty * it.rate, 0);
      return s + sub * (1 + inv.gstPct / 100);
    }, 0),
    [rows],
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🧾 Invoice Generator</h2>
          <div className="sub">Create GST-ready invoices for campaigns, agents and platform services</div>
        </div>
        <div className="page-head-actions">
          <Button variant="primary" onClick={startNew}>＋ New invoice</Button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card tone-violet"><span className="tone-line" /><span className="label">Invoices</span><div className="value">{rows.length}</div><div className="sub">all time</div></div>
        <div className="stat-card tone-green"><span className="tone-line" /><span className="label">Paid</span><div className="value">{rows.filter((r) => r.status === "paid").length}</div><div className="sub">settled</div></div>
        <div className="stat-card tone-amber"><span className="tone-line" /><span className="label">Outstanding</span><div className="value">₹{totalDue.toLocaleString("en-IN")}</div><div className="sub">draft + sent</div></div>
      </div>n
      {editing && (
        <Card title={rows.some((r) => r.id === editing.id) ? "✏️ Edit invoice" : "➕ New invoice"} style={{ marginBottom: 20 }}>
          <div className="req-form">
            <div>
              <label className="lbl">Invoice no.</label>
              <input className="input" value={editing.no} onChange={(e) => setEditing({ ...editing, no: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Client</label>
              <input className="input" value={editing.client} onChange={(e) => setEditing({ ...editing, client: e.target.value })} placeholder="Client / company name" />
            </div>
            <div>
              <label className="lbl">Client email</label>
              <input className="input" value={editing.clientEmail} onChange={(e) => setEditing({ ...editing, clientEmail: e.target.value })} placeholder="billing@client.com" />
            </div>
            <div>
              <label className="lbl">GST %</label>
              <select className="select" value={editing.gstPct} onChange={(e) => setEditing({ ...editing, gstPct: Number(e.target.value) })}>
                {[0, 5, 12, 18].map((g) => <option key={g} value={g}>{g === 0 ? "0% (no GST)" : `${g}%`}</option>)}
              </select>
            </div>
          </div>

          <div className="lbl" style={{ marginTop: 18 }}>Line items</div>
          <div className="inv-items">
            {items.map((it) => (
              <div className="inv-item" key={it.id}>
                <input className="input" value={it.desc} onChange={(e) => setItem(it.id, { desc: e.target.value })} placeholder="Description" />
                <input className="input qty" type="number" min={1} value={it.qty} onChange={(e) => setItem(it.id, { qty: Number(e.target.value) })} />
                <input className="input rate" type="number" min={0} value={it.rate} onChange={(e) => setItem(it.id, { rate: Number(e.target.value) })} />
                <b className="inv-total">₹{(it.qty * it.rate).toLocaleString("en-IN")}</b>
                <button className="inv-del" onClick={() => setItems(items.filter((x) => x.id !== it.id))}>✕</button>
              </div>
            ))}
          </div>
          <Button size="sm" onClick={() => setItems([...items, { id: nid(), desc: "", qty: 1, rate: 0 }])}>
            ＋ Add line
          </Button>

          <div className="inv-summary">
            <div><span>Subtotal</span><b>₹{totals.sub.toLocaleString("en-IN")}</b></div>
            <div><span>GST ({editing.gstPct}%)</span><b>₹{totals.gst.toLocaleString("en-IN")}</b></div>
            <div className="grand"><span>Total</span><b>₹{totals.total.toLocaleString("en-IN")}</b></div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button variant="primary" onClick={save}>Save invoice</Button>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      {rows.length === 0 && !editing ? (
        <Card><EmptyState icon="🧾" title="No invoices" sub="Generate your first invoice for a campaign or service" /></Card>
      ) : (
        <div className="inv-list">
          {rows.map((inv) => {
            const sub = inv.items.reduce((s, it) => s + it.qty * it.rate, 0);
            const total = sub * (1 + inv.gstPct / 100);
            return (
              <Card key={inv.id} className="inv-row" onClick={() => { setEditing(inv); setItems(inv.items.map((x) => ({ ...x }))); }}>
                <div className="inv-row-head">
                  <b>{inv.no}</b>
                  <span className={`badge ${inv.status === "paid" ? "green" : inv.status === "sent" ? "blue" : "amber"}`}>{inv.status}</span>
                </div>
                <div className="inv-client">{inv.client || "—"} <em>{inv.clientEmail}</em></div>
                <div className="inv-meta">{inv.items.reduce((s, it) => s + it.qty, 0)} items · {new Date(inv.created_at).toLocaleDateString()}</div>
                <div className="inv-row-bottom">
                  <b>₹{total.toLocaleString("en-IN")}</b>
                  <div className="inv-actions">
                    <button onClick={(e) => { e.stopPropagation(); printInvoice(inv); }}>🖨 Print</button>
                    <button onClick={(e) => { e.stopPropagation(); setStatus(inv.id, inv.status === "draft" ? "sent" : "paid"); }}>
                      {inv.status === "paid" ? "✓ paid" : inv.status === "sent" ? "✓ mark paid" : "→ mark sent"}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
