import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Handshake,
  Loader2,
  Search,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lookupRecipient, type RecipientPreview } from "@/lib/p2p.functions";
import { createEscrow, listMyEscrows } from "@/lib/escrow.functions";
import { EscrowStatusBadge } from "@/components/escrow/EscrowStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loadable } from "@/components/ui/loadable";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";

export const Route = createFileRoute("/_authenticated/escrow/")({
  head: () => ({ meta: [{ title: "Escrow · VFarmers" }] }),
  component: EscrowPage,
});

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function EscrowPage() {
  const lookupFn = useServerFn(lookupRecipient);
  const createFn = useServerFn(createEscrow);
  const listFn = useServerFn(listMyEscrows);
  const qc = useQueryClient();

  const [handle, setHandle] = useState("");
  const [payee, setPayee] = useState<RecipientPreview | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [balance, setBalance] = useState(0);

  const amt = Number(amount) || 0;

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: w } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .eq("kind", "primary")
        .maybeSingle();
      setBalance(Number(w?.balance ?? 0));
    })();
  }, []);

  const escrowsQ = useQuery({ queryKey: ["my-escrows"], queryFn: () => listFn() });

  const lookup = useMutation({
    mutationFn: (h: string) => lookupFn({ data: { handle: h } }),
    onSuccess: (r, h) => {
      if (!r) {
        setPayee(null);
        setNotFound(h);
        toast.error(`No farmer matches "${h}". Check the username or referral code.`);
        return;
      }
      setNotFound(null);
      setPayee(r);
    },
    onError: (e: Error, h) => {
      setPayee(null);
      setNotFound(h);
      toast.error(e.message || "Couldn't look up that farmer.");
    },
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          payeeId: payee!.id,
          amount: amt,
          title: title.trim() || undefined,
          terms: terms.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`Escrow opened — ${fmt(amt)} Seed held until release.`);
      setHandle("");
      setPayee(null);
      setAmount("");
      setTitle("");
      setTerms("");
      qc.invalidateQueries({ queryKey: ["my-escrows"] });
      // refresh balance
      supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) return;
        const { data: w } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", data.user.id)
          .eq("kind", "primary")
          .maybeSingle();
        setBalance(Number(w?.balance ?? 0));
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payee) return toast.error("Look up a counterparty first.");
    if (amt <= 0) return toast.error("Enter a valid amount.");
    if (amt > balance) return toast.error("Insufficient balance.");
    create.mutate();
  };

  const escrows = escrowsQ.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Escrow Trades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trade safely with other Farmers. You fund the escrow up front; the Seeds are held until you
          release them — or an admin resolves a dispute.
        </p>
      </header>

      <form onSubmit={onSubmit} className="glass space-y-5 rounded-3xl p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Open a new escrow
        </div>

        <div className="space-y-2">
          <Label htmlFor="handle">Counterparty (username or referral code)</Label>
          <div className="flex gap-2">
            <Input
              id="handle"
              placeholder="e.g. alice or AB12CD34"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setPayee(null);
                setNotFound(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (handle.trim()) lookup.mutate(handle.trim());
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => handle.trim() && lookup.mutate(handle.trim())}
              disabled={lookup.isPending || !handle.trim()}
            >
              {lookup.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          {notFound && !payee && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              No farmer found for “{notFound}”. Check the username or referral code and try again.
            </p>
          )}
          {payee && (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
              {payee.avatar_url ? (
                <img src={payee.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                  {(payee.display_name ?? payee.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {payee.display_name ?? payee.username}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {payee.username ? `@${payee.username}` : payee.referral_code}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount (Seed)</Label>
          <Input
            id="amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <div className="text-xs text-muted-foreground">
            Available: {fmt(balance)} Seed · held in escrow until released
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title (optional)</Label>
          <Input
            id="title"
            maxLength={120}
            placeholder="e.g. Logo design"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="terms">Terms (optional)</Label>
          <Textarea
            id="terms"
            maxLength={1000}
            placeholder="Describe what the counterparty must deliver before you release the Seeds."
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={create.isPending || !payee || amt <= 0}>
          {create.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Handshake className="mr-2 h-4 w-4" />
          )}
          Open escrow & fund {amt > 0 ? `(${fmt(amt)} Seed)` : ""}
        </Button>
      </form>

      <section className="glass rounded-3xl p-6">
        <h2 className="mb-3 text-lg font-semibold">My escrows</h2>
        <Loadable loading={escrowsQ.isLoading} skeleton={<ListSkeleton rows={3} />}>
          {escrows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No escrow trades yet.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {escrows.map((t) => {
                const outgoing = t.role === "payer";
                return (
                  <li key={t.id}>
                    <Link
                      to="/escrow/$id"
                      params={{ id: t.id }}
                      className="flex items-center justify-between gap-3 py-3 transition-colors hover:opacity-80"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full ${
                            outgoing ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                          }`}
                        >
                          {outgoing ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownLeft className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {t.title ?? (outgoing ? "Escrow to " : "Escrow from ") +
                              (t.counterparty?.display_name ?? t.counterparty?.username ?? "Farmer")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {outgoing ? "To " : "From "}
                            {t.counterparty?.display_name ?? t.counterparty?.username ?? "Farmer"} ·{" "}
                            {new Date(t.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono text-sm tabular-nums">{fmt(t.amount)} Seed</div>
                          <div className="mt-0.5">
                            <EscrowStatusBadge status={t.status} />
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Loadable>
      </section>
    </div>
  );
}
