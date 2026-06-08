import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ticket, Loader2, Plus, Layers, Copy } from "lucide-react";

import {
  adminListCoupons,
  adminCreateCoupon,
  adminCreateCouponsBulk,
  adminSetCouponActive,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  head: () => ({ meta: [{ title: "Coupons · Admin" }] }),
  component: AdminCoupons,
});

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
type Currency = "seed" | "usdt";
type Mode = "single" | "bulk";

function AdminCoupons() {
  const listFn = useServerFn(adminListCoupons);
  const createFn = useServerFn(adminCreateCoupon);
  const bulkFn = useServerFn(adminCreateCouponsBulk);
  const toggleFn = useServerFn(adminSetCouponActive);
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("single");
  const [currency, setCurrency] = useState<Currency>("seed");
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [max, setMax] = useState("1");
  const [expires, setExpires] = useState("");
  // bulk-only
  const [count, setCount] = useState("10");
  const [prefix, setPrefix] = useState("");
  const [generated, setGenerated] = useState<string[] | null>(null);

  const q = useQuery({ queryKey: ["admin-coupons"], queryFn: () => listFn() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-coupons"] });

  const resetShared = () => {
    setAmount("");
    setMax("1");
    setExpires("");
  };

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          code: code.trim(),
          amount: Number(amount) || 0,
          maxRedemptions: Number(max) || 1,
          currency,
          expiresAt: expires ? new Date(expires).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Coupon created.");
      setCode("");
      resetShared();
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: () =>
      bulkFn({
        data: {
          count: Number(count) || 0,
          amount: Number(amount) || 0,
          maxRedemptions: Number(max) || 1,
          currency,
          prefix: prefix.trim() || undefined,
          expiresAt: expires ? new Date(expires).toISOString() : undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(`${r.codes.length} coupons created.`);
      setGenerated(r.codes);
      setPrefix("");
      resetShared();
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      toast.success("Coupon updated.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((Number(amount) || 0) <= 0) return toast.error("Enter a valid amount.");
    if (mode === "single") {
      if (code.trim().length < 2) return toast.error("Code too short.");
      create.mutate();
    } else {
      const c = Number(count) || 0;
      if (c < 1 || c > 500) return toast.error("Count must be between 1 and 500.");
      bulk.mutate();
    }
  };

  const copyCodes = async () => {
    if (!generated?.length) return;
    try {
      await navigator.clipboard.writeText(generated.join("\n"));
      toast.success("Codes copied to clipboard.");
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  const rows = q.data ?? [];
  const pending = create.isPending || bulk.isPending;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Ticket className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-sm text-muted-foreground">
            Create single or bulk promo codes in Seed or USDT, and disable existing ones.
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="glass mt-6 space-y-4 rounded-3xl p-6">
        {/* Mode + currency toggles */}
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              <Toggle active={mode === "single"} onClick={() => setMode("single")} icon={Plus} label="Single" />
              <Toggle active={mode === "bulk"} onClick={() => setMode("bulk")} icon={Layers} label="Bulk" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Currency</Label>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              <Toggle active={currency === "seed"} onClick={() => setCurrency("seed")} label="Seed" />
              <Toggle active={currency === "usdt"} onClick={() => setCurrency("usdt")} label="USDT" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {mode === "single" ? (
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" placeholder="WELCOME50" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="count">How many</Label>
              <Input id="count" inputMode="numeric" placeholder="10" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ({currency === "usdt" ? "USDT" : "Seed"})</Label>
            <Input id="amount" inputMode="decimal" placeholder="50" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max">Max redemptions (each)</Label>
            <Input id="max" inputMode="numeric" placeholder="1" value={max} onChange={(e) => setMax(e.target.value)} />
          </div>

          {mode === "bulk" && (
            <div className="space-y-2">
              <Label htmlFor="prefix">Code prefix (optional)</Label>
              <Input id="prefix" maxLength={12} placeholder="PROMO" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="expires">Expires (optional)</Label>
            <Input id="expires" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : mode === "bulk" ? (
            <Layers className="mr-2 h-4 w-4" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {mode === "bulk" ? `Generate ${Number(count) || 0} coupons` : "Create coupon"}
        </Button>
      </form>

      {generated && generated.length > 0 && (
        <div className="glass mt-4 rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{generated.length} codes generated</h2>
            <Button size="sm" variant="outline" onClick={copyCodes}>
              <Copy className="mr-1 h-4 w-4" /> Copy all
            </Button>
          </div>
          <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-border/60 bg-card/40 p-3 font-mono text-xs leading-relaxed">
            {generated.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
        </div>
      )}

      <div className="glass mt-4 rounded-3xl p-2 sm:p-4">
        {q.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No coupons yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="font-mono">{c.code}</span>
                    <span className="font-mono tabular-nums">
                      {fmt(c.amount)} {c.currency === "usdt" ? "USDT" : "Seed"}
                    </span>
                    {!c.active && (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.used_redemptions}/{c.max_redemptions} used
                    {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                  disabled={toggle.isPending}
                >
                  {c.active ? "Disable" : "Enable"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
