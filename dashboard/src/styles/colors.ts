/**
 * Centralized color tokens — mirrors CSS variables in styles.css
 * Use these in JS/TS instead of inline `var(--color)` strings.
 */
export const colors = {
  // Base
  bg: "var(--bg)",
  bgSoft: "var(--bg-soft)",
  card: "var(--card)",
  cardHover: "var(--card-hover)",
  border: "var(--border)",
  borderSoft: "var(--border-soft)",
  text: "var(--text)",
  textMuted: "var(--text-muted)",
  textFaint: "var(--text-faint)",

  // Accents
  accent1: "var(--accent-1)",
  accent2: "var(--accent-2)",
  accent3: "var(--accent-3)",

  // Semantic
  green: "var(--green)",
  amber: "var(--amber)",
  red: "var(--red)",
  violet: "var(--violet)",
  blue: "var(--blue)",

  // Effects
  gradient: "var(--gradient)",
  shadow: "var(--shadow)",
  well: "var(--well)",
  glow: "var(--glow)",
} as const;

export type ColorKey = keyof typeof colors;