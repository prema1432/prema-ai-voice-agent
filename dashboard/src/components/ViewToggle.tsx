import { useEffect, useState } from "react";

export type ViewMode = "cards" | "rows";

/**
 * Persistent view mode for a page ("cards" tile grid vs "rows" dense table).
 * Preference survives reloads and is namespaced per page key.
 */
export function useView(key: string): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem(`prema.view.${key}`) === "rows" ? "rows" : "cards",
  );
  useEffect(() => {
    localStorage.setItem(`prema.view.${key}`, view);
  }, [view, key]);
  return [view, setView];
}

/** Segmented control — place at the right end of a page's filter toolbar. */
export default function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="view-toggle" role="group" aria-label="Change layout">
      <button
        type="button"
        className={value === "cards" ? "on" : ""}
        onClick={() => onChange("cards")}
        title="Card view"
        aria-pressed={value === "cards"}
      >
        ▦ Cards
      </button>
      <button
        type="button"
        className={value === "rows" ? "on" : ""}
        onClick={() => onChange("rows")}
        title="Row / table view"
        aria-pressed={value === "rows"}
      >
        ☰ Rows
      </button>
    </div>
  );
}