import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Pill, Bell, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Pill className="h-5 w-5" />
          </div>
          <span className="text-base sm:text-lg font-semibold">WellnessReminder</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-12 text-center sm:py-16 md:py-24">
          <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Your gentle medicine companion
          </span>
          <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight md:text-6xl">
            Never miss a dose,<br />
            <span className="text-primary">stay on track with ease.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground">
            WellnessReminder helps you manage every medicine, get timely reminders right in your browser
            (and email backup), and see your adherence improve week by week.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">Start tracking — free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 pb-20 sm:grid-cols-2 md:grid-cols-3">
          {[
            {
              icon: Pill,
              title: "Smart medicine list",
              text: "Add medicines with dosage, multiple daily times, and flexible schedules.",
            },
            {
              icon: Bell,
              title: "Timely reminders",
              text: "Browser notifications when it's time, with a Taken or Snooze action.",
            },
            {
              icon: BarChart3,
              title: "Adherence insights",
              text: "See today's schedule and your weekly streak at a glance.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border bg-card p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="mb-20 flex items-center gap-3 rounded-3xl bg-accent p-6 text-accent-foreground">
          <ShieldCheck className="h-6 w-6 shrink-0" />
          <p className="text-sm">
            Your data is private and secure. Only you can see your medicines and history.
          </p>
        </section>
      </main>
    </div>
  );
}
