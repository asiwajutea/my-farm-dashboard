import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import {
  getAffiliateSettings,
  adminUpdateAffiliateSettings,
  adminRunMonthlyMaintenance,
} from "@/lib/affiliate.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/affiliates")({
  head: () => ({ meta: [{ title: "Affiliates · Admin" }] }),
  component: AdminAffiliates,
});

type Form = {
  aff_gen1_pct: number;
  aff_gen2_pct: number;
  aff_gen3_pct: number;
  aff_basis: "profit" | "profit_plus_capital";
  maint_fee_seed: number;
  maint_fee_day: number;
  aff_maint_gen1_pct: number;
  aff_maint_gen2_pct: number;
  aff_maint_gen3_pct: number;
};

function AdminAffiliates() {
  const getFn = useServerFn(getAffiliateSettings);
  const saveFn = useServerFn(adminUpdateAffiliateSettings);
  const runFn = useServerFn(adminRunMonthlyMaintenance);

  const { data, isLoading, refetch } = useQuery({ queryKey: ["aff-settings"], queryFn: () => getFn() });
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (data && !form) {
      setForm({
        aff_gen1_pct: Number(data.aff_gen1_pct),
        aff_gen2_pct: Number(data.aff_gen2_pct),
        aff_gen3_pct: Number(data.aff_gen3_pct),
        aff_basis: data.aff_basis as Form["aff_basis"],
        maint_fee_seed: Number(data.maint_fee_seed),
        maint_fee_day: Number(data.maint_fee_day),
        aff_maint_gen1_pct: Number(data.aff_maint_gen1_pct),
        aff_maint_gen2_pct: Number(data.aff_maint_gen2_pct),
        aff_maint_gen3_pct: Number(data.aff_maint_gen3_pct),
      });
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: (f: Form) => saveFn({ data: f }),
    onSuccess: () => {
      toast.success("Saved");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const run = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r: { created: number }) => toast.success(`Created ${r.created} fee(s)`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-5">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 2 }).map((_, i) => (
          <section key={i} className="rounded-2xl border border-border bg-card/40 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-64" />
            <div className="mt-4 grid grid-cols-3 gap-3">
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

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const pct = (v: number) => (v * 100).toFixed(2);
  const fromPct = (v: string) => Math.max(0, Math.min(100, Number(v) || 0)) / 100;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5">
      <h1 className="text-2xl font-semibold tracking-tight">Affiliate Settings</h1>

      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Cycle commission</h2>
        <p className="text-xs text-muted-foreground">Paid when a downline reaps a farming cycle.</p>

        <div className="mt-3">
          <label className="text-xs text-muted-foreground">Commission basis</label>
          <select
            value={form.aff_basis}
            onChange={(e) => set("aff_basis", e.target.value as Form["aff_basis"])}
            className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
          >
            <option value="profit">Profit only (reward)</option>
            <option value="profit_plus_capital">Profit + Capital (reward + principal)</option>
          </select>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {([1, 2, 3] as const).map((g) => {
            const key = `aff_gen${g}_pct` as keyof Form;
            return (
              <PctField
                key={key}
                label={`Gen ${g} %`}
                value={pct(form[key] as number)}
                onChange={(v) => set(key, fromPct(v) as Form[typeof key])}
              />
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Maintenance fee</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Monthly amount (Seed)</label>
            <input
              type="number"
              step="0.01"
              value={form.maint_fee_seed}
              onChange={(e) => set("maint_fee_seed", Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Charge day (1–28)</label>
            <input
              type="number"
              min={1}
              max={28}
              value={form.maint_fee_day}
              onChange={(e) => set("maint_fee_day", Math.max(1, Math.min(28, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {([1, 2, 3] as const).map((g) => {
            const key = `aff_maint_gen${g}_pct` as keyof Form;
            return (
              <PctField
                key={key}
                label={`Gen ${g} %`}
                value={pct(form[key] as number)}
                onChange={(v) => set(key, fromPct(v) as Form[typeof key])}
              />
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => save.mutate(form)}
          disabled={save.isPending}
          className="rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save settings"}
        </button>
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2 text-sm hover:bg-card disabled:opacity-60"
        >
          <Users className="h-4 w-4" />
          Run maintenance for this month
        </button>
      </div>
    </div>
  );
}

function PctField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-background/60 px-3 py-2">
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
