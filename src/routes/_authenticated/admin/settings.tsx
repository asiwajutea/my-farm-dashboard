import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Settings, Users } from "lucide-react";

import {
  getPlatformSettings,
  adminUpdatePlatformSettings,
  type PlatformSettings,
} from "@/lib/settings.functions";
import { seedToUsdt, usdtToSeed, fmtAmount } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";
import { BoosterManager } from "@/components/admin/BoosterManager";
import { TickerEditor } from "@/components/admin/TickerEditor";
import { PayoutScheduleEditor } from "@/components/admin/PayoutScheduleEditor";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings · Admin" }] }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const getFn = useServerFn(getPlatformSettings);
  const saveFn = useServerFn(adminUpdatePlatformSettings);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const save = useMutation({
    mutationFn: (f: PlatformSettings) => saveFn({ data: f }),
    onSuccess: () => {
      toast.success("Platform settings saved");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-5">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 3 }).map((_, i) => (
          <section key={i} className="rounded-2xl border border-border bg-card/40 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-64" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-16 rounded-lg" />
              ))}
            </div>
          </section>
        ))}
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>
    );
  }

  const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) =>
    setForm({ ...form, [k]: v });
  const pct = (v: number) => (v * 100).toFixed(2);
  const fromPct = (v: string) => Math.max(0, Math.min(100, Number(v) || 0)) / 100;
  const cycleInvalid = form.max_cycle_seed < form.min_cycle_seed;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h1 className="text-2xl font-semibold tracking-tight">Platform Settings</h1>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        Core economic parameters. Affiliate commissions & maintenance fees are managed separately.
      </p>

      {/* Conversion */}
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Conversion</h2>
        <p className="text-xs text-muted-foreground">USDT value of 1 Seed, used across wallet & P2P.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField
            label="1 Seed = USDT"
            step="0.00000001"
            value={form.seed_to_usdt}
            onChange={(v) => set("seed_to_usdt", v)}
          />
        </div>
      </section>

      {/* Deposits & withdrawals */}
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Deposits & withdrawals</h2>
        <p className="text-xs text-muted-foreground">Minimums are set in USDT.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <UsdtField
            label="Min deposit (USDT)"
            seedValue={form.min_deposit_seed}
            rate={form.seed_to_usdt}
            onChangeSeed={(v) => set("min_deposit_seed", v)}
          />
          <UsdtField
            label="Min withdraw (USDT)"
            seedValue={form.min_withdraw_seed}
            rate={form.seed_to_usdt}
            onChangeSeed={(v) => set("min_withdraw_seed", v)}
          />
          <PctField
            label="Withdraw fee %"
            value={pct(form.withdraw_fee_pct)}
            onChange={(v) => set("withdraw_fee_pct", fromPct(v))}
          />
        </div>
      </section>

      {/* Transfers */}
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Transfers</h2>
        <p className="text-xs text-muted-foreground">Fee applied to peer-to-peer Seed transfers.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <PctField
            label="P2P fee %"
            value={pct(form.p2p_fee_pct)}
            onChange={(v) => set("p2p_fee_pct", fromPct(v))}
          />
        </div>
      </section>

      {/* Farming cycles */}
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Farming cycles</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField
            label="Duration (days)"
            step="1"
            value={form.cycle_duration_days}
            onChange={(v) => set("cycle_duration_days", Math.max(1, Math.round(v)))}
          />
          <PctField
            label="Base reward %"
            value={pct(form.cycle_base_reward_pct)}
            onChange={(v) => set("cycle_base_reward_pct", fromPct(v))}
          />
          <UsdtField
            label="Min cycle (USDT)"
            seedValue={form.min_cycle_seed}
            rate={form.seed_to_usdt}
            onChangeSeed={(v) => set("min_cycle_seed", v)}
          />
          <UsdtField
            label="Max cycle (USDT)"
            seedValue={form.max_cycle_seed}
            rate={form.seed_to_usdt}
            onChangeSeed={(v) => set("max_cycle_seed", v)}
            invalid={cycleInvalid}
          />
        </div>
        {cycleInvalid && (
          <p className="mt-2 text-xs text-destructive">
            Max cycle amount must be greater than or equal to the minimum.
          </p>
        )}
      </section>

      {/* Referral */}
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Referral</h2>
        <p className="text-xs text-muted-foreground">One-off signup bonus basis for referrals.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <PctField
            label="Referral bonus %"
            value={pct(form.referral_bonus_pct)}
            onChange={(v) => set("referral_bonus_pct", fromPct(v))}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => save.mutate(form)}
          disabled={save.isPending || cycleInvalid}
          className="rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save settings"}
        </button>
        <Link
          to="/admin/affiliates"
          className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2 text-sm hover:bg-card"
        >
          <Users className="h-4 w-4" />
          Affiliate & maintenance settings
        </Link>
      </div>

      {/* Payout schedule (self-contained save) */}
      <PayoutScheduleEditor />

      {/* Boosters (full CRUD) */}
      <BoosterManager rate={form.seed_to_usdt} />

      {/* Marquee ticker */}
      <TickerEditor />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = "0.01",
  invalid = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  invalid?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`mt-1 w-full rounded-lg border bg-background/60 px-3 py-2 text-sm outline-none ${
          invalid ? "border-destructive" : "border-border focus:border-primary/60"
        }`}
      />
    </div>
  );
}

/**
 * Edits an amount in USDT while the form stores it in Seed (the ledger's unit).
 * The USDT input is the controlled value; on change we convert to Seed and push
 * it up. We keep local text state so typing isn't disturbed by round-trip
 * rounding, re-syncing from props only while the field is not focused (e.g.
 * after the conversion rate is edited). The Seed equivalent is shown below.
 */
function UsdtField({
  label,
  seedValue,
  rate,
  onChangeSeed,
  invalid = false,
}: {
  label: string;
  seedValue: number;
  rate: number;
  onChangeSeed: (seed: number) => void;
  invalid?: boolean;
}) {
  const focused = useRef(false);
  const [text, setText] = useState(() => seedToUsdt(seedValue, rate).toFixed(2));

  // Re-sync the displayed USDT from the stored Seed value when not actively
  // editing (covers initial load and rate changes).
  useEffect(() => {
    if (!focused.current) {
      setText(seedToUsdt(seedValue, rate).toFixed(2));
    }
  }, [seedValue, rate]);

  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div
        className={`mt-1 flex items-center rounded-lg border bg-background/60 px-3 py-2 ${
          invalid ? "border-destructive" : "border-border focus-within:border-primary/60"
        }`}
      >
        <input
          type="number"
          step="0.01"
          min="0"
          value={text}
          onFocus={() => (focused.current = true)}
          onBlur={() => (focused.current = false)}
          onChange={(e) => {
            setText(e.target.value);
            const usdt = Number(e.target.value) || 0;
            onChangeSeed(usdtToSeed(usdt, rate));
          }}
          className="w-full bg-transparent text-sm outline-none"
        />
        <span className="text-xs text-muted-foreground">USDT</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">≈ {fmtAmount(seedValue)} Seed</p>
    </div>
  );
}

function PctField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-background/60 px-3 py-2 focus-within:border-primary/60">
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm outline-none"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}
