import type { Database } from "@/integrations/supabase/types";

export type Medicine = Database["public"]["Tables"]["medicines"]["Row"];
export type DoseLog = Database["public"]["Tables"]["dose_logs"]["Row"];
export type FrequencyType = Database["public"]["Enums"]["frequency_type"];
export type DoseStatus = Database["public"]["Enums"]["dose_status"];
export type MissedReason = Database["public"]["Enums"]["missed_reason"];

export const MISSED_REASON_LABELS: Record<MissedReason, string> = {
  forgot: "Forgot",
  not_available: "Not available",
  skipped: "Skipped intentionally",
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Is this medicine due on the given date based on frequency? */
export function isDueOnDate(med: Medicine, date: Date): boolean {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const start = new Date(med.start_date);
  start.setHours(0, 0, 0, 0);
  if (day < start) return false;
  if (med.end_date) {
    const end = new Date(med.end_date);
    end.setHours(0, 0, 0, 0);
    if (day > end) return false;
  }
  if (!med.active) return false;

  switch (med.frequency_type) {
    case "daily":
      return true;
    case "alternate": {
      const diffDays = Math.round((day.getTime() - start.getTime()) / 86400000);
      return diffDays % 2 === 0;
    }
    case "weekdays": {
      const cfg = (med.frequency_config as { days?: number[] }) ?? {};
      const days = cfg.days ?? [];
      return days.includes(day.getDay());
    }
    case "interval": {
      const cfg = (med.frequency_config as { every?: number }) ?? {};
      const every = Math.max(1, cfg.every ?? 1);
      const diffDays = Math.round((day.getTime() - start.getTime()) / 86400000);
      return diffDays % every === 0;
    }
    default:
      return false;
  }
}

/** Build the list of scheduled Date objects for a given medicine on a given day. */
export function getScheduledTimesForDay(med: Medicine, date: Date): Date[] {
  if (!isDueOnDate(med, date)) return [];
  return (med.times ?? [])
    .map((t) => parseTimeOnDate(t, date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
}

function parseTimeOnDate(hhmm: string, date: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const d = new Date(date);
  d.setHours(h, min, 0, 0);
  return d;
}

export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function describeFrequency(med: Medicine): string {
  switch (med.frequency_type) {
    case "daily":
      return "Daily";
    case "alternate":
      return "Every other day";
    case "weekdays": {
      const cfg = (med.frequency_config as { days?: number[] }) ?? {};
      const days = (cfg.days ?? []).map((d) => WEEKDAY_LABELS[d]).join(", ");
      return days ? `On ${days}` : "Weekly";
    }
    case "interval": {
      const cfg = (med.frequency_config as { every?: number }) ?? {};
      const every = cfg.every ?? 1;
      return every === 1 ? "Daily" : `Every ${every} days`;
    }
    default:
      return "—";
  }
}
