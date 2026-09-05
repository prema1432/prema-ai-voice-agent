export type Route =
  | { name: "dashboard" }
  | { name: "campaigns" }
  | { name: "campaign-detail"; id: string }
  | { name: "voicelab" }
  | { name: "calls" }
  | { name: "call-detail"; id: string };

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  const parts = h.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "dashboard" };
  if (parts[0] === "campaigns" && parts[1]) return { name: "campaign-detail", id: parts[1] };
  if (parts[0] === "calls" && parts[1]) return { name: "call-detail", id: parts[1] };
  if (parts[0] === "campaigns") return { name: "campaigns" };
  if (parts[0] === "voicelab") return { name: "voicelab" };
  if (parts[0] === "calls") return { name: "calls" };
  return { name: "dashboard" };
}

export function navigate(path: string) {
  if (location.hash === `#/${path}`) return;
  location.hash = `#/${path}`;
}
