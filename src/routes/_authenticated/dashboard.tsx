import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Pill, Plus, Check, AlertTriangle, Activity, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  describeFrequency,
  formatTime,
  getScheduledTimesForDay,
  type DoseLog,
  type Medicine,
} from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

interface SlotItem {
  key: string;
  medicine: Medicine;
  scheduledFor: Date;
  log?: DoseLog;
}

function Dashboard() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [todayLogs, setTodayLogs] = useState<DoseLog[]>([]);
  const [weekLogs, setWeekLogs] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [upcomingLogs, setUpcomingLogs] = useState<DoseLog[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAhead = new Date(today);
    weekAhead.setDate(weekAhead.getDate() + 8);

    const [{ data: meds }, { data: tLogs }, { data: wLogs }, { data: uLogs }] = await Promise.all([
      supabase.from("medicines").select("*").eq("user_id", user.id).order("created_at"),
      supabase
        .from("dose_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("scheduled_for", today.toISOString())
        .lt("scheduled_for", tomorrow.toISOString()),
      supabase
        .from("dose_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("scheduled_for", weekAgo.toISOString())
        .lt("scheduled_for", tomorrow.toISOString()),
      supabase
        .from("dose_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("scheduled_for", today.toISOString())
        .lt("scheduled_for", weekAhead.toISOString()),
    ]);

    setMedicines((meds ?? []) as Medicine[]);
    setTodayLogs((tLogs ?? []) as DoseLog[]);
    setWeekLogs((wLogs ?? []) as DoseLog[]);
    setUpcomingLogs((uLogs ?? []) as DoseLog[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Build today's schedule
  const today = new Date();
  const slots: SlotItem[] = medicines
    .flatMap((med) =>
      getScheduledTimesForDay(med, today).map((scheduledFor) => {
        const log = todayLogs.find(
          (l) =>
            l.medicine_id === med.id &&
            new Date(l.scheduled_for).getTime() === scheduledFor.getTime(),
        );
        return {
          key: `${med.id}-${scheduledFor.getTime()}`,
          medicine: med,
          scheduledFor,
          log,
        };
      }),
    )
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

  const taken = slots.filter((s) => s.log?.status === "taken").length;
  const missed = slots.filter((s) => s.log?.status === "missed").length;
  const pending = slots.length - taken - missed;

  // Next upcoming dose across all medicines (look up to 7 days ahead)
  let nextSlot: { medicine: Medicine; scheduledFor: Date } | null = null;
  outer: for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + i);
    const candidates = medicines
      .flatMap((med) =>
        getScheduledTimesForDay(med, day).map((scheduledFor) => ({ medicine: med, scheduledFor })),
      )
      .filter(({ medicine, scheduledFor }) => {
        if (scheduledFor.getTime() <= now.getTime()) return false;
        const log = upcomingLogs.find(
          (l) =>
            l.medicine_id === medicine.id &&
            new Date(l.scheduled_for).getTime() === scheduledFor.getTime(),
        );
        // Skip slots already resolved or deferred for this exact scheduled time
        if (log?.status === "taken" || log?.status === "snoozed" || log?.status === "missed") {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
    if (candidates.length > 0) {
      nextSlot = candidates[0];
      break outer;
    }
  }

  const nextMinutes = nextSlot
    ? Math.max(0, Math.round((nextSlot.scheduledFor.getTime() - now.getTime()) / 60000))
    : null;
  const isToday =
    nextSlot &&
    nextSlot.scheduledFor.toDateString() === now.toDateString();

  function formatCountdown(mins: number): string {
    if (mins < 1) return "Due now";
    if (mins < 60) return `in ${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh === 0 ? `in ${d} d` : `in ${d} d ${rh} h`;
  }

  // Weekly adherence chart
  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - i));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);

    // total scheduled slots that day across all meds
    const scheduled = medicines.reduce(
      (sum, m) => sum + getScheduledTimesForDay(m, day).length,
      0,
    );
    const takenCount = weekLogs.filter(
      (l) =>
        l.status === "taken" &&
        new Date(l.scheduled_for) >= day &&
        new Date(l.scheduled_for) < next,
    ).length;
    const pct = scheduled > 0 ? Math.round((takenCount / scheduled) * 100) : 0;
    return {
      day: day.toLocaleDateString([], { weekday: "short" }),
      adherence: pct,
    };
  });

  const weekAdherence =
    weekData.length > 0
      ? Math.round(weekData.reduce((s, d) => s + d.adherence, 0) / weekData.length)
      : 0;

  const markTaken = async (slot: SlotItem) => {
    if (!user) return;
    if (slot.log) {
      await supabase
        .from("dose_logs")
        .update({ status: "taken", taken_at: new Date().toISOString() })
        .eq("id", slot.log.id);
    } else {
      // Upsert against the unique (user_id, medicine_id, scheduled_for) constraint
      // so concurrent inserts (e.g. notification scheduler) don't create duplicates.
      await supabase.from("dose_logs").upsert(
        {
          user_id: user.id,
          medicine_id: slot.medicine.id,
          scheduled_for: slot.scheduledFor.toISOString(),
          status: "taken",
          taken_at: new Date().toISOString(),
        },
        { onConflict: "user_id,medicine_id,scheduled_for" },
      );
    }
    toast.success(`${slot.medicine.name} marked as taken`);
    load();
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="animate-rise-in">
        <h1 className="text-4xl font-bold tracking-tight text-gradient-primary">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Medicines added",
            value: medicines.length,
            icon: Pill,
            tone: "default" as const,
            hint: `${slots.length} dose${slots.length === 1 ? "" : "s"} today`,
          },
          {
            label: "Taken today",
            value: taken,
            icon: Check,
            tone: "success" as const,
            hint: `of ${slots.length} scheduled`,
          },
          {
            label: "Missed today",
            value: missed,
            icon: AlertTriangle,
            tone: "destructive" as const,
            hint: pending > 0 ? `${pending} still pending` : "All caught up",
          },
          {
            label: "7-day adherence",
            value: `${weekAdherence}%`,
            icon: Activity,
            tone: "lavender" as const,
            hint: "Doses taken on time",
          },
        ].map((c, i) => (
          <div
            key={c.label}
            className="animate-rise-in"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <StatCard {...c} />
          </div>
        ))}
      </div>

      {/* Next upcoming dose */}
      <section className="card-hover animate-rise-in rounded-3xl border bg-gradient-to-br from-lavender/40 via-card to-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ${
              nextMinutes !== null && nextMinutes <= 5 ? "animate-pulse-ring" : "animate-float-slow"
            }`}
          >
            <Clock className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next dose
            </div>
            {nextSlot && nextMinutes !== null ? (
              <>
                <div className="mt-0.5 truncate text-xl font-semibold">
                  {nextSlot.medicine.name}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {nextSlot.medicine.dosage}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {isToday ? "Today" : nextSlot.scheduledFor.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}{" "}
                  at {formatTime(nextSlot.scheduledFor)}
                </div>
              </>
            ) : (
              <div className="mt-0.5 text-base font-medium text-muted-foreground">
                No upcoming doses scheduled
              </div>
            )}
          </div>
          {nextSlot && nextMinutes !== null && (
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-primary">
                {formatCountdown(nextMinutes)}
              </div>
              <div className="text-xs text-muted-foreground">
                {nextMinutes < 1 ? "It's time" : `${nextMinutes} minute${nextMinutes === 1 ? "" : "s"} away`}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Taken vs Missed comparison */}
      <section className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Today's progress</h2>
            <p className="text-sm text-muted-foreground">
              {taken} of {slots.length} doses taken
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums">
            {slots.length > 0 ? Math.round((taken / slots.length) * 100) : 0}%
          </span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
          {slots.length > 0 ? (
            <>
              <div
                className="bg-success transition-all"
                style={{ width: `${(taken / slots.length) * 100}%` }}
              />
              <div
                className="bg-destructive transition-all"
                style={{ width: `${(missed / slots.length) * 100}%` }}
              />
              <div
                className="bg-warning transition-all"
                style={{ width: `${(pending / slots.length) * 100}%` }}
              />
            </>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <LegendDot tone="success" label={`Taken · ${taken}`} />
          <LegendDot tone="destructive" label={`Missed · ${missed}`} />
          <LegendDot tone="warning" label={`Pending · ${pending}`} />
        </div>
      </section>

      {/* Today's schedule */}
      <section className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Today's schedule</h2>
          <Button asChild size="sm" variant="outline">
            <Link to="/medicines">
              <Plus className="mr-1 h-4 w-4" />
              Add medicine
            </Link>
          </Button>
        </div>
        {slots.length === 0 ? (
          <div className="rounded-2xl bg-secondary/40 p-8 text-center">
            <Pill className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No doses scheduled today</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a medicine to start tracking your schedule.
            </p>
            <Button asChild className="mt-4">
              <Link to="/medicines">Add your first medicine</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {slots.map((slot) => {
              const status = slot.log?.status ?? "pending";
              const isPast = slot.scheduledFor.getTime() < Date.now() - 60_000;
              const tone =
                status === "taken"
                  ? "success"
                  : status === "missed" || (status === "pending" && isPast)
                    ? "destructive"
                    : "warning";
              return (
                <li
                  key={slot.key}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <StatusDot tone={tone} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{slot.medicine.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {slot.medicine.dosage} · {formatTime(slot.scheduledFor)} ·{" "}
                      {describeFrequency(slot.medicine)}
                    </div>
                  </div>
                  {status === "taken" ? (
                    <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                      Taken
                    </span>
                  ) : status === "missed" ? (
                    <span className="rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                      Missed
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => markTaken(slot)}>
                      <Check className="mr-1 h-3 w-3" />
                      Mark taken
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Weekly adherence chart */}
      <section className="rounded-3xl border bg-card p-6 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold">Weekly adherence</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Doses taken on time over the last 7 days.
        </p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                }}
                formatter={(v: number) => [`${v}%`, "Adherence"]}
              />
              <Bar dataKey="adherence" fill="var(--primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {missed > 0 && (
          <p className="mt-3 text-xs text-destructive">
            {missed} missed dose{missed > 1 ? "s" : ""} today.
          </p>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  icon: typeof Pill;
  tone: "default" | "success" | "warning" | "lavender" | "destructive";
  hint?: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-warning/20 text-warning-foreground"
        : tone === "destructive"
          ? "bg-destructive/15 text-destructive"
          : tone === "lavender"
            ? "bg-lavender/30 text-lavender-foreground"
            : "bg-secondary text-primary";
  return (
    <div className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function StatusDot({ tone }: { tone: "success" | "warning" | "destructive" }) {
  const cls =
    tone === "success" ? "bg-success" : tone === "destructive" ? "bg-destructive" : "bg-warning";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

function LegendDot({ tone, label }: { tone: "success" | "warning" | "destructive"; label: string }) {
  const cls =
    tone === "success" ? "bg-success" : tone === "destructive" ? "bg-destructive" : "bg-warning";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${cls}`} aria-hidden />
      {label}
    </span>
  );
}
