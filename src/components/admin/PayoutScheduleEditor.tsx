import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";

import { getPayoutSettings, adminUpdatePayoutSettings } from "@/lib/payout.functions";
import { getPayoutLockState, type PayoutConfig } from "@/lib/payout";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

const COMMON_TIMEZONES = [
  "Africa/Lagos",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
];

function isFriday(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 5;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.trim().length > 0;
  } catch {
    return false;
  }
}

function fmtDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Admin editor for the bi-weekly payout schedule + withdrawal lock window. */
export function PayoutScheduleEditor() {
  const getFn = useServerFn(getPayoutSettings);
  const saveFn = useServerFn(adminUpdatePayoutSettings);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["payout-settings"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<PayoutConfig | null>(null);
  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const save = useMutation({
    mutationFn: (f: PayoutConfig) => saveFn({ data: f }),
    onSuccess: () => {
      toast.success("Payout schedule saved");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) {
    return (
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-72" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  const anchorValid = isFriday(form.anchor);
  const tzValid = isValidTimeZone(form.timeZone);
  const canSave = anchorValid && tzValid && !save.isPending;

  // Live preview of the next payout + lock window for the current form values.
  const preview = anchorValid && tzValid ? getPayoutLockState(new Date(), form) : null;

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Payout schedule</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Payouts run every other Friday from the anchor date. Withdrawals lock from Thursday 12:00 AM
        through Friday 11:59 PM of each payout week so requests can be vetted before payout.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground">Anchor payout date (a Friday)</label>
          <input
            type="date"
            value={form.anchor}
            onChange={(e) => setForm({ ...form, anchor: e.target.value })}
            className={`mt-1 w-full rounded-lg border bg-background/60 px-3 py-2 text-sm outline-none ${
              anchorValid ? "border-border focus:border-primary/60" : "border-destructive"
            }`}
          />
          {!anchorValid && <p className="mt-1 text-[11px] text-destructive">Pick a Friday.</p>}
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Time zone</label>
          <input
            type="text"
            list="payout-timezones"
            value={form.timeZone}
            onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
            className={`mt-1 w-full rounded-lg border bg-background/60 px-3 py-2 text-sm outline-none ${
              tzValid ? "border-border focus:border-primary/60" : "border-destructive"
            }`}
          />
          <datalist id="payout-timezones">
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          {!tzValid && <p className="mt-1 text-[11px] text-destructive">Unknown time zone.</p>}
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Lock window</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
            <Switch
              checked={form.lockEnabled}
              onCheckedChange={(v) => setForm({ ...form, lockEnabled: v })}
            />
            <span className="text-sm">{form.lockEnabled ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
      </div>

      {preview && (
        <p className="mt-3 text-xs text-muted-foreground">
          Next payout{" "}
          <span className="font-medium text-foreground">{fmtDate(preview.nextPayoutDate)}</span>.{" "}
          {form.lockEnabled ? (
            <>
              Withdrawals lock {fmtDate(preview.lockStartDate)} → {fmtDate(preview.lockEndDate)}
              {preview.locked && " — currently locked."}
            </>
          ) : (
            "Lock window is disabled."
          )}
        </p>
      )}

      <button
        onClick={() => save.mutate(form)}
        disabled={!canSave}
        className="mt-4 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {save.isPending ? "Saving…" : "Save payout schedule"}
      </button>
    </section>
  );
}
