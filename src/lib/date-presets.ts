// Date-range presets for the admin accounting sections (Task 49 §5).
// All boundaries are computed in the ADMIN'S local timezone (the browser's),
// which is what "today" means to a shop owner.

export type DatePresetKey =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "last-month"
  | "year"
  | "custom";

export const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom range" },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** [from, to) — to is exclusive so a range covers its last moment fully. */
export function computePreset(key: DatePresetKey, fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case "today": {
      const from = startOfDay(now);
      return { from, to: new Date(from.getTime() + 24 * 3600 * 1000) };
    }
    case "yesterday": {
      const from = startOfDay(new Date(now.getTime() - 24 * 3600 * 1000));
      return { from, to: new Date(from.getTime() + 24 * 3600 * 1000) };
    }
    case "week": {
      const day = now.getDay(); // 0 = Sunday — week starts Monday here
      const offset = (day + 6) % 7;
      const from = startOfDay(new Date(now.getTime() - offset * 24 * 3600 * 1000));
      return { from, to: new Date(from.getTime() + 7 * 24 * 3600 * 1000) };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    case "last-month":
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    case "custom": {
      const from = fromStr ? new Date(`${fromStr}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
      const toRaw = toStr ? new Date(`${toStr}T00:00:00`) : now;
      // inclusive custom end date → exclusive boundary next midnight
      const to = new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate() + 1);
      return { from, to };
    }
  }
}
