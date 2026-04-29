import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, X, Pill } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  describeFrequency,
  WEEKDAY_LABELS,
  type FrequencyType,
  type Medicine,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/medicines")({
  component: MedicinesPage,
});

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

const formSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  dosage: z.string().trim().min(1, "Dosage required").max(100),
  notes: z.string().trim().max(500).optional(),
  times: z
    .array(z.string().regex(TIME_REGEX, "Use HH:MM format"))
    .min(1, "Add at least one time"),
  frequency_type: z.enum(["daily", "alternate", "weekdays", "interval"]),
  frequency_config: z.record(z.string(), z.any()),
  start_date: z.string(),
  end_date: z.string().optional().nullable(),
  active: z.boolean(),
});

type FormState = z.infer<typeof formSchema>;

const emptyForm = (): FormState => ({
  name: "",
  dosage: "",
  notes: "",
  times: ["09:00"],
  frequency_type: "daily",
  frequency_config: {},
  start_date: new Date().toISOString().slice(0, 10),
  end_date: null,
  active: true,
});

function MedicinesPage() {
  const { user } = useAuth();
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("medicines")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMeds((data ?? []) as Medicine[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (m: Medicine) => {
    setEditing(m);
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("medicines").delete().eq("id", deleteId);
    toast.success("Medicine deleted");
    setDeleteId(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Medicines</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your medicines and reminder schedules.
          </p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Add medicine
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : meds.length === 0 ? (
        <div className="rounded-3xl border bg-card p-12 text-center shadow-sm">
          <Pill className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">No medicines yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first medicine to start receiving reminders.
          </p>
          <Button className="mt-5" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" />
            Add medicine
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {meds.map((m) => (
            <article
              key={m.id}
              className={cn(
                "rounded-3xl border bg-card p-5 shadow-sm",
                !m.active && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold">{m.name}</h3>
                  <p className="text-sm text-muted-foreground">{m.dosage}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(m.times ?? []).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{describeFrequency(m)}</p>
              {m.notes && <p className="mt-2 text-sm text-muted-foreground">{m.notes}</p>}
            </article>
          ))}
        </div>
      )}

      <MedicineDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => {
          setOpen(false);
          load();
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this medicine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the medicine and all its dose history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MedicineDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Medicine | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        dosage: editing.dosage,
        notes: editing.notes ?? "",
        times: editing.times?.length ? editing.times : ["09:00"],
        frequency_type: editing.frequency_type,
        frequency_config:
          (editing.frequency_config as Record<string, unknown>) ?? {},
        start_date: editing.start_date,
        end_date: editing.end_date,
        active: editing.active,
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, open]);

  const updateTime = (i: number, v: string) => {
    setForm((f) => ({ ...f, times: f.times.map((t, idx) => (idx === i ? v : t)) }));
  };
  const addTime = () =>
    setForm((f) => ({ ...f, times: [...f.times, "12:00"] }));
  const removeTime = (i: number) =>
    setForm((f) => ({ ...f, times: f.times.filter((_, idx) => idx !== i) }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: parsed.data.name,
      dosage: parsed.data.dosage,
      notes: parsed.data.notes || null,
      times: parsed.data.times,
      frequency_type: parsed.data.frequency_type,
      frequency_config: parsed.data.frequency_config,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date || null,
      active: parsed.data.active,
    };
    const { error } = editing
      ? await supabase.from("medicines").update(payload).eq("id", editing.id)
      : await supabase.from("medicines").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Medicine updated" : "Medicine added");
    onSaved();
  };

  const weekdayDays = (form.frequency_config.days as number[] | undefined) ?? [];
  const intervalEvery = (form.frequency_config.every as number | undefined) ?? 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit medicine" : "Add medicine"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Vitamin D"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dosage">Dosage</Label>
            <Input
              id="dosage"
              value={form.dosage}
              onChange={(e) => setForm({ ...form, dosage: e.target.value })}
              placeholder="e.g. 1 tablet, 5ml syrup"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Reminder times</Label>
            <div className="space-y-2">
              {form.times.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="time"
                    value={t}
                    onChange={(e) => updateTime(i, e.target.value)}
                    required
                  />
                  {form.times.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTime(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addTime}>
                <Plus className="mr-1 h-3 w-3" />
                Add another time
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={form.frequency_type}
              onValueChange={(v: FrequencyType) =>
                setForm({ ...form, frequency_type: v, frequency_config: {} })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="alternate">Every other day</SelectItem>
                <SelectItem value="weekdays">Specific weekdays</SelectItem>
                <SelectItem value="interval">Every N days</SelectItem>
              </SelectContent>
            </Select>

            {form.frequency_type === "weekdays" && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {WEEKDAY_LABELS.map((label, idx) => {
                  const active = weekdayDays.includes(idx);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? weekdayDays.filter((d) => d !== idx)
                          : [...weekdayDays, idx];
                        setForm({
                          ...form,
                          frequency_config: { days: next.sort() },
                        });
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {form.frequency_type === "interval" && (
              <div className="flex items-center gap-2 pt-2 text-sm">
                <span>Every</span>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  className="w-20"
                  value={intervalEvery}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      frequency_config: { every: Math.max(1, Number(e.target.value)) },
                    })
                  }
                />
                <span>days</span>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End date (optional)</Label>
              <Input
                id="end"
                type="date"
                value={form.end_date ?? ""}
                onChange={(e) => setForm({ ...form, end_date: e.target.value || null })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. take with food"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-secondary/50 px-4 py-3">
            <div>
              <Label htmlFor="active" className="text-sm">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Pause reminders without deleting the medicine.
              </p>
            </div>
            <Switch
              id="active"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add medicine"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
