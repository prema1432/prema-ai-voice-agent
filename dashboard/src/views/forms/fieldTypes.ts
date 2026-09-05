import type { FormField } from "../../api";

/** Catalog of every field type the form builder supports. */
export interface FieldTypeMeta {
  type: string;
  label: string;
  icon: string;
  group: "basic" | "choice" | "media" | "logic";
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: "text", label: "Short text", icon: "🔤", group: "basic" },
  { type: "textarea", label: "Paragraph", icon: "📄", group: "basic" },
  { type: "email", label: "Email", icon: "✉️", group: "basic" },
  { type: "phone", label: "Phone", icon: "📱", group: "basic" },
  { type: "number", label: "Number", icon: "🔢", group: "basic" },
  { type: "url", label: "Website / URL", icon: "🔗", group: "basic" },
  { type: "date", label: "Date", icon: "📅", group: "basic" },
  { type: "time", label: "Time", icon: "🕐", group: "basic" },
  { type: "datetime-local", label: "Date + time", icon: "📆", group: "basic" },
  { type: "select", label: "Dropdown", icon: "🔽", group: "choice" },
  { type: "radio", label: "Single choice", icon: "⚪", group: "choice" },
  { type: "multiselect", label: "Multi dropdown", icon: "☑️", group: "choice" },
  { type: "checkbox", label: "Checkboxes", icon: "✅", group: "choice" },
  { type: "toggle", label: "Yes/No switch", icon: "🔄", group: "choice" },
  { type: "rating", label: "Star rating", icon: "⭐", group: "media" },
  { type: "slider", label: "Slider", icon: "🎚️", group: "media" },
  { type: "color", label: "Color", icon: "🎨", group: "media" },
  { type: "hidden", label: "Hidden value", icon: "🫥", group: "logic" },
  { type: "computed", label: "Computed (formula)", icon: "🧮", group: "logic" },
];

export const CHOICE_TYPES = ["select", "multiselect", "radio", "checkbox"];
export const optionTypes = (t: string) => CHOICE_TYPES.includes(t);
export const typeMeta = (t: string) => FIELD_TYPES.find((f) => f.type === t) ?? FIELD_TYPES[0];

export const fieldTypeLabel = (t: string) => typeMeta(t).label;

export const newFieldId = (() => {
  let seq = 0;
  return (label: string) => {
    seq += 1;
    const base = (label || "field").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";
    return `${base}_${Date.now().toString(36)}${seq}`;
  };
})();

export const newStepId = (() => {
  let seq = 0;
  return () => `step_${Date.now().toString(36)}_${++seq}`;
})();

export const newActionId = (() => {
  let seq = 0;
  return () => `act_${Date.now().toString(36)}_${++seq}`;
})();

export function sampleField(type: string): FormField {
  const f: FormField = {
    id: newFieldId(type),
    label: fieldTypeLabel(type),
    type,
    required: false,
    width: "full",
    options: optionTypes(type) ? ["Option 1", "Option 2"] : [],
  };
  if (type === "toggle") {
    f.label = "Agree to terms?";
    f.default = "false";
  }
  if (type === "rating") f.validation = { max: 5 };
  if (type === "slider") f.validation = { min: 0, max: 100, step: 1 };
  if (type === "computed") {
    f.label = "Total";
    f.computed = true;
    f.formula = "0";
    f.help = "Auto-calculated: use {{field_id}} references, e.g. {{price}} * {{qty}}";
  }
  return f;
}
