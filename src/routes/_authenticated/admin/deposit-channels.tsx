import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, Zap, Loader2, Save, CheckCircle2, Lock, Unlock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  adminGetDepositChannelSettings,
  adminUpdateDepositChannelSettings,
  getDepositChannelStatus,
  type DepositChannelSettings,
} from "@/lib/deposit-channels.functions";

export const Route = createFileRoute("/_authenticated/admin/deposit-channels")({
  head: () => ({ meta: [{ title: "Deposit Channels · Admin" }] }),
  component: AdminDepositChannelsPage,
});

function AdminDepositChannelsPage() {
  const getFn    = useServerFn(adminGetDepositChannelSettings);
  const saveFn   = useServerFn(adminUpdateDepositChannelSettings);
  const statusFn = useServerFn(getDepositChannelStatus);
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-deposit-channels"],
    queryFn: () => getFn(),
  });

  const { data: status } = useQuery({
    queryKey: ["deposit-channel-status"],
    queryFn: () => statusFn(),
    refetchInterval: 30_000,
  });

  const [form, setForm] = useState<DepositChannelSettings | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings]);

  const save = useMutation({
    mutationFn: (f: DepositChannelSettings) => saveFn({ data: f }),
    onSuccess: (_, f) => {
      toast.success("Deposit channel settings saved.");
      setSavedKey("all");
      setTimeout(() => setSavedKey(null), 2000);
      qc.invalidateQueries({ queryKey: ["admin-deposit-channels"] });
      qc.invalidateQueries({ queryKey: ["deposit-channel-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const set = <K extends keyof DepositChannelSettings>(k: K, v: DepositChannelSettings[K]) =>
    setForm((prev) => prev ? { ...prev, [k]: v } : prev);

  const ivoryUsedPct = status?.ivorypay.dailyLimitUsdt
    ? Math.min(100, (status.ivorypay.todayUsdt / status.ivorypay.dailyLimitUsdt) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ArrowDownToLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deposit Channels</h1>
          <p className="text-sm text-muted-foreground">
            Enable or lock deposit methods platform-wide. Daily limits reset at UTC midnight.
          </p>
        </div>
      </div>

      {/* ── IvoryPay ── */}
      <section className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-semibold">IvoryPay (Instant)</h2>
              <p className="text-xs text-muted-foreground">USDT crypto deposits via IvoryPay checkout</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {form.ivorypay_enabled
              ? <span className="flex items-center gap-1 text-xs text-primary"><Unlock className="h-3.5 w-3.5" /> Open</span>
              : <span className="flex items-center gap-1 text-xs text-destructive"><Lock className="h-3.5 w-3.5" /> Locked</span>
            }
            <Switch
              checked={form.ivorypay_enabled}
              onCheckedChange={(v) => set("ivorypay_enabled", v)}
            />
          </div>
        </div>

        {/* Daily usage bar */}
        {status?.ivorypay.dailyLimitUsdt > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Today's usage</span>
              <span>
                <span className={status.ivorypay.limitReached ? "text-destructive font-semibold" : "text-foreground font-medium"}>
                  {status.ivorypay.todayUsdt.toFixed(2)} USDT
                </span>
                {" / "}
                {status.ivorypay.dailyLimitUsdt.toFixed(2)} USDT
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  status.ivorypay.limitReached
                    ? "bg-destructive"
                    : ivoryUsedPct > 80
                      ? "bg-amber-400"
                      : "bg-gradient-to-r from-primary to-accent"
                }`}
                style={{ width: `${ivoryUsedPct}%` }}
              />
            </div>
            {status.ivorypay.limitReached && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Daily limit reached — IvoryPay is automatically locked for today.
              </div>
            )}
          </div>
        )}

        {/* Daily limit */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">
            Daily deposit limit (USDT) — set to 0 for unlimited
          </label>
          <div className="relative max-w-[200px]">
            <Input
              type="number"
              min="0"
              step="100"
              value={form.ivorypay_daily_limit_usdt}
              onChange={(e) => set("ivorypay_daily_limit_usdt", Number(e.target.value) || 0)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              USDT
            </span>
          </div>
        </div>

        {/* Locked reason */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">
            Lock reason (shown to users when channel is disabled)
          </label>
          <Input
            placeholder="e.g. Temporarily unavailable for maintenance."
            value={form.ivorypay_locked_reason ?? ""}
            onChange={(e) => set("ivorypay_locked_reason", e.target.value || null)}
          />
        </div>
      </section>

      {/* ── Manual transfer ── */}
      <section className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Manual Transfer</h2>
            <p className="text-xs text-muted-foreground">Bank transfer / USDT with proof upload — admin-approved</p>
          </div>
          <div className="flex items-center gap-2">
            {form.manual_deposit_enabled
              ? <span className="flex items-center gap-1 text-xs text-primary"><Unlock className="h-3.5 w-3.5" /> Open</span>
              : <span className="flex items-center gap-1 text-xs text-destructive"><Lock className="h-3.5 w-3.5" /> Locked</span>
            }
            <Switch
              checked={form.manual_deposit_enabled}
              onCheckedChange={(v) => set("manual_deposit_enabled", v)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">
            Lock reason (shown to users when channel is disabled)
          </label>
          <Input
            placeholder="e.g. Manual deposits paused for system upgrade."
            value={form.manual_deposit_locked_reason ?? ""}
            onChange={(e) => set("manual_deposit_locked_reason", e.target.value || null)}
          />
        </div>
      </section>

      {/* Save */}
      <Button
        className="gap-2"
        onClick={() => save.mutate(form)}
        disabled={save.isPending}
      >
        {save.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : savedKey ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {save.isPending ? "Saving…" : savedKey ? "Saved!" : "Save settings"}
      </Button>
    </div>
  );
}
