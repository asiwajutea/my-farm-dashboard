import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ticket, Loader2, CheckCircle2 } from "lucide-react";

import { redeemCoupon, listMyRedemptions } from "@/lib/coupons.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/coupons")({
  head: () => ({ meta: [{ title: "Coupons · VFarmers" }] }),
  component: CouponsPage,
});

function CouponsPage() {
  const redeemFn = useServerFn(redeemCoupon);
  const listFn = useServerFn(listMyRedemptions);
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const redemptions = useQuery({ queryKey: ["my-redemptions"], queryFn: () => listFn() });

  const redeem = useMutation({
    mutationFn: (c: string) => redeemFn({ data: { code: c.toUpperCase().trim() } }),
    onSuccess: () => {
      toast.success("Coupon redeemed — Seeds credited to your Primary wallet.");
      setCode("");
      qc.invalidateQueries({ queryKey: ["my-redemptions"] });
    },
    onError: (e: Error) => toast.error(e.message.replace(/^.*?:\s*/, "")),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!code.trim()) return;
    redeem.mutate(code);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Redeem a Coupon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a coupon code to credit Seeds to your Primary wallet. Each coupon can only be redeemed once per Farmer.
        </p>
      </header>

      <form onSubmit={onSubmit} className="glass space-y-4 rounded-3xl p-6">
        <div className="space-y-2">
          <Label htmlFor="code">Coupon code</Label>
          <div className="relative">
            <Ticket className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="code"
              className="pl-9 font-mono uppercase tracking-wider"
              placeholder="WELCOME10"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="off"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={redeem.isPending || !code.trim()}>
          {redeem.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Redeem
        </Button>
      </form>

      <section className="glass rounded-3xl p-6">
        <h2 className="mb-3 text-lg font-semibold">Redemption history</h2>
        {redemptions.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : (redemptions.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No coupons redeemed yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {(redemptions.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-mono text-sm uppercase tracking-wider">{r.code ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.redeemed_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="font-mono text-sm tabular-nums text-primary">
                  +{r.amount.toLocaleString()} Seed
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
