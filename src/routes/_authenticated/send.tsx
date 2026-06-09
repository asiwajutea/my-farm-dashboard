import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Send as SendIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

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
import { Loadable } from "@/components/ui/loadable";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/send")({
  head: () => ({ meta: [{ title: "Send · VFarmers" }] }),
  component: SendPage,
});

const fmt = (n: number, max = 2) =>
  n.toLocaleString(undefined, { maximumFractionDigits: max });

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
  const [rate, setRate] = useState(0); // seed_to_usdt: USDT value of 1 Seed
  const [usdtIn, setUsdtIn] = useState("1"); // inline converter input

  // Recipient confirmation popup state
  const [pending, setPending] = useState<RecipientPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Handle that failed to resolve, for the inline "no farmer found" notice.
  const [notFound, setNotFound] = useState<string | null>(null);

  const { data: feeData } = useQuery({ queryKey: ["p2p-fee"], queryFn: () => feeFn() });
  const feePct = feeData?.feePct ?? 0;
  const amt = Number(amount) || 0;
  const fee = +((amt * feePct) / 100).toFixed(8);
  const total = +(amt + fee).toFixed(8);

  // Inline USDT -> Seed conversion (1 Seed = `rate` USDT, so 1 USDT = 1/rate Seed).
  const usdtNum = Number(usdtIn) || 0;
  const seedOut = rate > 0 ? usdtNum / rate : 0;

  const loadBalance = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: w }, { data: settings }] = await Promise.all([
      supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .eq("kind", "primary")
        .maybeSingle(),
      supabase.from("app_settings").select("seed_to_usdt").maybeSingle(),
    ]);
    setBalance(Number(w?.balance ?? 0));
    if (settings?.seed_to_usdt) setRate(Number(settings.seed_to_usdt));
  };

  useEffect(() => {
    loadBalance();
  }, []);

  const transfersQ = useQuery({ queryKey: ["my-transfers"], queryFn: () => txFn() });

  const lookup = useMutation({
    mutationFn: (h: string) => lookupFn({ data: { handle: h } }),
    onSuccess: (r, h) => {
      if (!r) {
        // No matching account for the entered username/referral code.
        setRecipient(null);
        setNotFound(h);
        toast.error(`No farmer matches "${h}". Check the username or referral code and try again.`);
        return;
      }
      // Surface the matched account for explicit confirmation before sending.
      setNotFound(null);
      setPending(r);
      setConfirmOpen(true);
    },
    onError: (e: Error, h) => {
      setRecipient(null);
      setNotFound(h);
      toast.error(e.message || "Couldn't look up that farmer. Please try again.");
    },
  });

  const confirmRecipient = () => {
    setRecipient(pending);
    setConfirmOpen(false);
  };

  const cancelRecipient = () => {
    setPending(null);
    setConfirmOpen(false);
  };

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
      loadBalance();
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

  const recipientName = (r: RecipientPreview) =>
    r.display_name ?? r.username ?? "Farmer";
  const recipientHandle = (r: RecipientPreview) =>
    r.username ? `@${r.username}` : r.referral_code ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Send to a Farmer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Transfer Seeds to another farmer using their username or referral code.
        </p>
      </header>

      {/* Inline USDT -> Seed rate converter */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/60 bg-card/40 px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">Rate</span>
        <div className="relative">
          <Input
            inputMode="decimal"
            value={usdtIn}
            onChange={(e) => setUsdtIn(e.target.value)}
            aria-label="USDT amount"
            className="h-8 w-24 pr-12"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            USDT
          </span>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-semibold tabular-nums">
          {fmt(seedOut, 4)} <span className="font-normal text-muted-foreground">Seed</span>
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          1 USDT ≈ {rate > 0 ? fmt(1 / rate, 4) : "—"} Seed
        </span>
      </div>

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
          {notFound && !recipient && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              No farmer found for “{notFound}”. Check the username or referral code and try again.
            </p>
          )}
          {recipient && (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
              {recipient.avatar_url ? (
                <img src={recipient.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                  {recipientName(recipient).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{recipientName(recipient)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {recipientHandle(recipient)}
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
            <span>Available: {fmt(balance)} Seed</span>
            <span>
              Fee: {fmt(fee)} Seed ({feePct}%)
            </span>
          </div>
          {amt > 0 && (
            <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs">
              Total debit: <span className="font-semibold">{total.toLocaleString()}</span> Seed
              {rate > 0 && (
                <span className="text-muted-foreground"> ≈ {fmt(total * rate)} USDT</span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button type="submit" className="w-full" disabled={send.isPending || !recipient || amt <= 0}>
          {send.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <SendIcon className="mr-2 h-4 w-4" />
          )}
          Send
        </Button>
      </form>

      <section className="glass rounded-3xl p-6">
        <h2 className="mb-3 text-lg font-semibold">Recent transfers</h2>
        <Loadable loading={transfersQ.isLoading} skeleton={<ListSkeleton rows={4} />}>
          {(transfersQ.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No transfers yet.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {(transfersQ.data ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        t.direction === "in" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t.direction === "in" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {t.direction === "in" ? "From " : "To "}
                        {t.counterparty?.display_name ?? t.counterparty?.username ?? "Farmer"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`font-mono text-sm tabular-nums ${t.direction === "in" ? "text-primary" : ""}`}
                  >
                    {t.direction === "in" ? "+" : "−"}
                    {t.amount.toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Loadable>
      </section>

      {/* Recipient confirmation popup */}
      <Dialog open={confirmOpen} onOpenChange={(o) => (o ? setConfirmOpen(true) : cancelRecipient())}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm recipient</DialogTitle>
            <DialogDescription>
              Make sure this is the farmer you want to send Seeds to.
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              {pending.avatar_url ? (
                <img src={pending.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-lg font-semibold text-primary">
                  {recipientName(pending).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{recipientName(pending)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {recipientHandle(pending)}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={cancelRecipient}>
              Cancel
            </Button>
            <Button onClick={confirmRecipient}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
