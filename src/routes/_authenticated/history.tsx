import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock, AlertTriangle, History as HistoryIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatTime, MISSED_REASON_LABELS, type DoseLog, type Medicine } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

interface Row {
  log: DoseLog;
  medicine?: Medicine;
}

function HistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const [{ data: logs }, { data: meds }] = await Promise.all([
        supabase
          .from("dose_logs")
          .select("*")
          .eq("user_id", user.id)
          .gte("scheduled_for", since.toISOString())
          .order("scheduled_for", { ascending: false })
          .limit(200),
        supabase.from("medicines").select("*").eq("user_id", user.id),
      ]);
      const medMap = new Map((meds ?? []).map((m) => [m.id, m as Medicine]));
      setRows(
        (logs ?? []).map((l) => ({ log: l as DoseLog, medicine: medMap.get(l.medicine_id) })),
      );
      setLoading(false);
    })();
  }, [user]);

  // Group by day
  const grouped = rows.reduce<Record<string, Row[]>>((acc, r) => {
    const key = formatDate(r.log.scheduled_for);
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your dose log over the last 30 days.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border bg-card p-12 text-center shadow-sm">
          <HistoryIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">No dose history yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once you start taking medicines, your history will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{day}</h2>
              <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
                <ul className="divide-y">
                  {items.map(({ log, medicine }) => {
                    const tone =
                      log.status === "taken"
                        ? "success"
                        : log.status === "missed"
                          ? "destructive"
                          : "warning";
                    const Icon =
                      log.status === "taken"
                        ? Check
                        : log.status === "missed"
                          ? AlertTriangle
                          : Clock;
                    const toneClass =
                      tone === "success"
                        ? "bg-success/15 text-success"
                        : tone === "destructive"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-warning/20 text-warning-foreground";
                    return (
                      <li key={log.id} className="flex items-center gap-3 px-5 py-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {medicine?.name ?? "Deleted medicine"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {medicine?.dosage} · scheduled {formatTime(log.scheduled_for)}
                            {log.taken_at && ` · taken ${formatTime(log.taken_at)}`}
                            {log.status === "missed" && log.missed_reason
                              ? ` · ${MISSED_REASON_LABELS[log.missed_reason]}`
                              : ""}
                          </div>
                        </div>
                        <span className="text-xs font-medium capitalize text-muted-foreground">
                          {log.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
