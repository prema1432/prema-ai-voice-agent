import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { navigate } from "../router";

const PAGES: { label: string; icon: string; path: string }[] = [
  { label: "Dashboard", icon: "📊", path: "" },
  { label: "Campaigns", icon: "📋", path: "campaigns" },
  { label: "Forms", icon: "📝", path: "forms" },
  { label: "CRM Board", icon: "🗂", path: "crm" },
  { label: "Agents", icon: "🤖", path: "agents" },
  { label: "Voice Lab", icon: "🎤", path: "voicelab" },
  { label: "Call Logs", icon: "📞", path: "calls" },
  { label: "LLM & Cost", icon: "🧠", path: "llm" },
  { label: "LLM Models", icon: "📚", path: "llm/models" },
  { label: "Integrations", icon: "🔌", path: "integrations" },
  { label: "Notifications", icon: "🔔", path: "notifications" },
  { label: "Audit Logs", icon: "🧾", path: "audit" },
];

type Item = {
  id: string;
  label: string;
  sub: string;
  icon: string;
  path: string;
};

const noop = () => {};

/** Header search: quick actions to every page + live lookup of campaigns, agents, forms. */
export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [forms, setForms] = useState<{ id: string; title: string; slug?: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K focuses the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Debounced live lookup once the query is meaningful.
  useEffect(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) {
      setCampaigns([]); setAgents([]); setForms([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const [cs, as, fs] = await Promise.all([
          api.listCampaigns(),
          api.listAgents(),
          api.listForms(),
        ]);
        setCampaigns(cs.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 5));
        setAgents(as.filter((a) => a.name.toLowerCase().includes(term)).slice(0, 5));
        setForms(fs.filter((f) => (f.title + " " + (f.slug ?? "")).toLowerCase().includes(term)).slice(0, 5));
      } catch {
        noop();
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const items: { group: string; list: Item[] }[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const groups: { group: string; list: Item[] }[] = [];
    if (!term) {
      groups.push({
        group: "Quick actions",
        list: PAGES.map((p) => ({
          id: `p:${p.path || "dashboard"}`,
          label: p.label,
          sub: `/${p.path || ""}`,
          icon: p.icon,
          path: p.path,
        })),
      });
      return groups;
    }
    const pages = PAGES.filter(
      (p) => p.label.toLowerCase().includes(term) || p.path.toLowerCase().includes(term),
    );
    if (pages.length) {
      groups.push({
        group: "Pages",
        list: pages.map((p) => ({
          id: `p:${p.path || "dashboard"}`,
          label: p.label,
          sub: `/${p.path || ""}`,
          icon: p.icon,
          path: p.path,
        })),
      });
    }
    if (campaigns.length) {
      groups.push({
        group: "Campaigns",
        list: campaigns.map((c) => ({
          id: `c:${c.id}`,
          label: c.name,
          sub: "Campaign",
          icon: "📋",
          path: `campaigns/${c.id}`,
        })),
      });
    }
    if (agents.length) {
      groups.push({
        group: "Agents",
        list: agents.map((a) => ({
          id: `a:${a.id}`,
          label: a.name,
          sub: "Agent",
          icon: "🤖",
          path: `voicelab/${encodeURIComponent(a.id)}`,
        })),
      });
    }
    if (forms.length) {
      groups.push({
        group: "Forms",
        list: forms.map((f) => ({
          id: `f:${f.id}`,
          label: f.title,
          sub: "Form",
          icon: "📝",
          path: `forms/${f.id}`,
        })),
      });
    }
    return groups;
  }, [q, campaigns, agents, forms]);

  const allItems = useMemo(() => items.flatMap((g) => g.list), [items]);

  function pick(item: Item) {
    setOpen(false);
    setQ("");
    setIdx(0);
    navigate(item.path);
  }

  const shown = open && allItems.length > 0;
  const queryEmpty = q.trim().length === 0;

  return (
    <div className="gs-wrap" ref={wrapRef}>
      <span className="gs-ic">🔎</span>
      <input
        ref={inputRef}
        className="gs-input"
        placeholder="Search pages, campaigns, agents, forms…"
        value={q}
        onFocus={() => { setOpen(true); setIdx(0); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
          if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, allItems.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && allItems[idx]) pick(allItems[idx]);
        }}
      />
      <kbd className="gs-kbd">⌘K</kbd>

      {open && (
        <div className="gs-drop">
          {!queryEmpty && allItems.length === 0 && (
            <div className="gs-empty">No matches for “{q}”</div>
          )}
          {shown &&
            items.map((group) => (
              <div key={group.group}>
                <div className="gs-group">{group.group}</div>
                {group.list.map((item) => {
                  const fi = allItems.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      className={`gs-item ${fi === idx ? "on" : ""}`}
                      onMouseEnter={() => setIdx(fi)}
                      onClick={() => pick(item)}
                    >
                      <span className="gs-item-ic">{item.icon}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="gs-item-label">{item.label}</span>
                        <span className="gs-item-sub">{item.sub}</span>
                      </span>
                      {fi === idx && <span className="gs-go">↵</span>}
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}