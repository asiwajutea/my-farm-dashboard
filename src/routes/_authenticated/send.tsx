import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send as SendIcon, ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  lookupRecipient,
  sendP2P,
  listMyTransfers,
  getP2PFeePct,
  type RecipientPreview,
} from "@/lib/p2p.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/send")({
  head: () => ({ meta: [{ title: "Send · VFarmers" }] }),
  component: SendPage,
});

function SendPage() {
  const lookupFn = useServerFn(lookupRecipient);
  const sendFn = useServerFn(sendP2P);
  const feeFn = useServerFn(getP2PFeePct);
  const txFn = useServerFn(listMyTransfers);
  const qc = useQueryClient();

  const [handle, setHandle] = useState("");
  const [recipient, setRecipient] = useState<RecipientPreview | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [balance, setBalance] = useState(0);

  const { data: feeData } = useQuery({ queryKey: ["p2p-fee"], queryFn: () => feeFn() });
  const feePct = feeData?.feePct ?? 0;
  const amt = Number(amount) || 0;
  const fee = +(amt * feePct / 100).toFixed(8);
  const total = +(amt + fee).toFixed(8);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
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

  const transfersQ = useQuery({ queryKey: ["my-transfers"], queryFn: () => txFn() });

  const lookup = useMutation({
    mutationFn: (h: string) => lookupFn({ data: { handle: h } }),
    onSuccess: (r) => {
      if (!r) toast.error("No farmer found with that handle.");
      setRecipient(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () =>
      sendFn({ data: { receiverId: recipient!.id, amount: amt, note: note || undefined } }),
    onSuccess: () => {
      toast.success(`Sent ${amt} Seed to ${recipient?.username ?? recipient?.display_name}.`);
      setAmount("");
      setNote("");
      setRecipient(null);
      setHandle("");
      qc.invalidateQueries({ queryKey: ["my-transfers"] });
      // refresh local balance
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recipient) return toast.error("Look up a recipient first.");
    if (amt <= 0) return toast.error("Enter a valid amount.");
    if (total > balance) return toast.error("Insufficient balance.");
    send.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Send to a Farmer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Transfer Seeds to another farmer using their username or referral code.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="glass space-y-5 rounded-3xl p-6">
        <div className="space-y-2">
          <Label htmlFor="handle">Recipient (username or referral code)</Label>
          <div className="flex gap-2">
            <Input
              id="handle"
              placeholder="e.g. alice or AB12CD34"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setRecipient(null);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => handle.trim() && lookup.mutate(handle.trim())}
              disabled={lookup.isPending || !handle.trim()}
            >
              {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {recipient && (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
              {recipient.avatar_url ? (
                <img src={recipient.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                  {(recipient.display_name ?? recipient.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{recipient.display_name ?? recipient.username}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {recipient.username ? `@${recipient.username}` : recipient.referral_code}
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
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Available: {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} Seed</span>
            <span>
              Fee: {fee.toLocaleString(undefined, { maximumFractionDigits: 2 })} Seed ({feePct}%)
            </span>
          </div>
          {amt > 0 && (
            <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs">
              Total debit: <span className="font-semibold">{total.toLocaleString()}</span> Seed
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button type="submit" className="w-full" disabled={send.isPending || !recipient || amt <= 0}>
          {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendIcon className="mr-2 h-4 w-4" />}
          Send
        </Button>
      </form>

      <section className="glass rounded-3xl p-6">
        <h2 className="mb-3 text-lg font-semibold">Recent transfers</h2>
        {transfersQ.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : (transfersQ.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No transfers yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {(transfersQ.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    t.direction === "in" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {t.direction === "in" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {t.direction === "in" ? "From " : "To "}
                      {t.counterparty?.display_name ?? t.counterparty?.username ?? "Farmer"}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className={`font-mono text-sm tabular-nums ${t.direction === "in" ? "text-primary" : ""}`}>
                  {t.direction === "in" ? "+" : "−"}{t.amount.toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
