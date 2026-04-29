import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getScheduledTimesForDay, type Medicine } from "@/lib/schedule";

const CHECK_INTERVAL_MS = 30_000; // 30 seconds
const TRIGGER_WINDOW_MS = 60_000; // fire if slot is within 1 min before to 1 min after current time
const SNOOZE_MS = 10 * 60_000;

interface PendingNotif {
  doseLogId: string;
  medicineId: string;
  scheduledFor: number;
  name: string;
  dosage: string;
}

/**
 * Background scheduler that:
 * - Asks for notification permission once
 * - Polls every 30s for medicines due in the current minute
 * - Creates a dose_log row (UNIQUE constraint on (medicine_id, scheduled_for) prevents dupes)
 * - Fires a browser notification with Taken / Snooze actions
 * - Marks past pending slots as "missed"
 */
export function useDoseScheduler() {
  const { user } = useAuth();
  const firedRef = useRef<Set<string>>(new Set()); // session-scoped dedupe key
  const snoozedRef = useRef<Map<string, number>>(new Map()); // doseLogId -> next fire ts

  useEffect(() => {
    if (!user) return;

    // Request notification permission once
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }

    const tick = async () => {
      const now = Date.now();
      const today = new Date();

      // Fetch active medicines
      const { data: meds } = await supabase
        .from("medicines")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true);
      if (!meds) return;

      // For each medicine, find slots due now
      for (const med of meds as Medicine[]) {
        const times = getScheduledTimesForDay(med, today);
        for (const slot of times) {
          const slotTs = slot.getTime();
          const dedupeKey = `${med.id}|${slotTs}`;

          // Snoozed?
          const snoozeUntil = snoozedRef.current.get(dedupeKey);
          if (snoozeUntil && now < snoozeUntil) continue;

          // Within trigger window?
          if (Math.abs(slotTs - now) > TRIGGER_WINDOW_MS) continue;
          if (firedRef.current.has(dedupeKey) && !snoozeUntil) continue;

          // Insert (or fetch existing) dose log row
          const { data: existing } = await supabase
            .from("dose_logs")
            .select("id, status")
            .eq("medicine_id", med.id)
            .eq("scheduled_for", slot.toISOString())
            .maybeSingle();

          let doseLogId = existing?.id ?? null;
          if (!existing) {
            const { data: inserted } = await supabase
              .from("dose_logs")
              .insert({
                user_id: user.id,
                medicine_id: med.id,
                scheduled_for: slot.toISOString(),
                status: "pending",
              })
              .select("id")
              .single();
            doseLogId = inserted?.id ?? null;
          } else if (existing.status === "taken") {
            firedRef.current.add(dedupeKey);
            continue;
          }

          if (!doseLogId) continue;

          firedRef.current.add(dedupeKey);
          snoozedRef.current.delete(dedupeKey);

          fireNotification({
            doseLogId,
            medicineId: med.id,
            scheduledFor: slotTs,
            name: med.name,
            dosage: med.dosage,
          }, () => {
            // Snooze callback — re-arm for SNOOZE_MS
            snoozedRef.current.set(dedupeKey, Date.now() + SNOOZE_MS);
            firedRef.current.delete(dedupeKey);
          });
        }
      }

      // Mark long-overdue pending logs as missed (>15 min late)
      const cutoff = new Date(now - 15 * 60_000).toISOString();
      await supabase
        .from("dose_logs")
        .update({ status: "missed" })
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lt("scheduled_for", cutoff);
    };

    tick();
    const id = window.setInterval(tick, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [user]);
}

function fireNotification(p: PendingNotif, onSnooze: () => void) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const time = new Date(p.scheduledFor).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const n = new Notification(`💊 Time for ${p.name}`, {
    body: `${p.dosage} • due at ${time}\nClick to mark as taken. Right-click to dismiss.`,
    tag: `dose-${p.doseLogId}`,
    requireInteraction: true,
  });
  n.onclick = async () => {
    await supabase
      .from("dose_logs")
      .update({ status: "taken", taken_at: new Date().toISOString() })
      .eq("id", p.doseLogId);
    n.close();
    window.focus();
  };
  // Auto-snooze if dismissed without action after 60s
  const snoozeTimer = window.setTimeout(() => {
    onSnooze();
  }, 60_000);
  n.onclose = () => window.clearTimeout(snoozeTimer);
}
