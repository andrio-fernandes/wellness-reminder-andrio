import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Mail, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [emailReminders, setEmailReminders] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
    if (!user) return;
    supabase
      .from("profiles")
      .select("email_reminders_enabled")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setEmailReminders(data.email_reminders_enabled);
        setLoading(false);
      });
  }, [user]);

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Your browser doesn't support notifications");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Notifications enabled");
    else toast.error("Notifications blocked. Update browser settings to enable.");
  };

  const toggleEmail = async (v: boolean) => {
    if (!user) return;
    setEmailReminders(v);
    const { error } = await supabase
      .from("profiles")
      .update({ email_reminders_enabled: v })
      .eq("id", user.id);
    if (error) {
      toast.error("Could not save preference");
      setEmailReminders(!v);
      return;
    }
    toast.success(v ? "Email reminders on" : "Email reminders off");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage notifications and your account.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <section className="rounded-3xl border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Browser notifications</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get a popup when it's time to take a medicine.
                </p>
                <div className="mt-3">
                  {permission === "granted" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                      Enabled
                    </span>
                  ) : permission === "denied" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
                      Blocked — change in browser settings
                    </span>
                  ) : (
                    <Button size="sm" onClick={requestPermission}>
                      Enable notifications
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lavender/30 text-lavender-foreground">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Email reminders</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Backup reminder sent to {user?.email} when a dose is due. Helpful when
                      your browser is closed.
                    </p>
                  </div>
                  <Switch checked={emailReminders} onCheckedChange={toggleEmail} />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-6 shadow-sm">
            <h2 className="font-semibold">Account</h2>
            <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-4">
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
            <Label className="sr-only">Account</Label>
          </section>
        </>
      )}
    </div>
  );
}
