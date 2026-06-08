import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ticket, Loader2, Plus } from "lucide-react";

import {
  adminListCoupons,
  adminCreateCoupon,
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

function AdminCoupons() {
  const listFn = useServerFn(adminListCoupons);
  const createFn = useServerFn(adminCreateCoupon);
  const toggleFn = useServerFn(adminSetCouponActive);
  const qc = useQueryClient();

  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [max, setMax] = useState("1");
  const [expires, setExpires] = useState("");

  const q = useQuery({ queryKey: ["admin-coupons"], queryFn: () => listFn() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-coupons"] });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          code: code.trim(),
          amount: Number(amount) || 0,
          maxRedemptions: Number(max) || 1,
          expiresAt: expires ? new Date(expires).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Coupon created.");
      setCode("");
      setAmount("");
      setMax("1");
      setExpires("");
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
    if (code.trim().length < 2) return toast.error("Code too short.");
    if ((Number(amount) || 0) <= 0) return toast.error("Enter a valid amount.");
    create.mutate();
  };

  const rows = q.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Ticket className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-sm text-muted-foreground">Create promo codes and disable existing ones.</p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="glass mt-6 grid gap-3 rounded-3xl p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input id="code" placeholder="WELCOME50" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (Seed)</Label>
          <Input id="amount" inputMode="decimal" placeholder="50" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max">Max redemptions</Label>
          <Input id="max" inputMode="numeric" placeholder="1" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expires">Expires (optional)</Label>
          <Input id="expires" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create coupon
          </Button>
        </div>
      </form>

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
                    <span className="font-mono tabular-nums">{fmt(c.amount)} Seed</span>
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
