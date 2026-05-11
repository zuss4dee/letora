/** Pure display helpers + types for property inspector activity — safe for `"use client"`. */

export type PropertyInspectorActivityAccent = "default" | "success" | "attention" | "danger";

export type PropertyInspectorActivityEntry = {
  id: string;
  at: string;
  title: string;
  detail: string;
  accent: PropertyInspectorActivityAccent;
};

export function formatPropertyInspectorActivityClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function propertyInspectorActivityBarClass(accent: PropertyInspectorActivityAccent): string {
  switch (accent) {
    case "success":
      return "bg-emerald-500 dark:bg-emerald-400";
    case "danger":
      return "bg-red-500";
    case "attention":
      return "bg-amber-500";
    default:
      return "bg-zinc-800";
  }
}
