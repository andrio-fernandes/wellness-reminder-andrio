import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Pill, LayoutDashboard, ListChecks, History, Settings, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useDoseScheduler } from "@/lib/use-dose-scheduler";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/medicines", label: "Medicines", icon: ListChecks },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  // Background notification scheduler — runs on every authenticated page
  useDoseScheduler();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Pill className="h-4 w-4" />
          </div>
          <span className="font-semibold">WellnessReminder</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)}>
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      <div className="mx-auto flex max-w-6xl">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-x-0 top-[57px] z-20 border-b bg-background p-4 md:static md:top-auto md:w-60 md:shrink-0 md:border-b-0 md:border-r md:p-6",
            open ? "block" : "hidden md:block",
          )}
        >
          <Link to="/dashboard" className="mb-8 hidden items-center gap-2 md:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Pill className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">WellnessReminder</span>
          </Link>

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl bg-secondary/60 p-3 text-xs">
            <div className="font-medium text-foreground truncate">{user?.email}</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-8 w-full justify-start gap-2 px-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
