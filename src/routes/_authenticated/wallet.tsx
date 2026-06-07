import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  History as HistoryIcon,
  Loader2,
  AlertCircle,
  Inbox,
} from "lucide-react";

import {
  submitDepositRequest,
  submitWithdrawalRequest,
  listMyRequests,
} from "@/lib/api/requests.functions";
import {
  DEPOSIT_METHODS,
  WITHDRAWAL_METHODS,
  type RequestErrorCode,
  type RequestRow,
} from "@/lib/requests.shared";
import { StatusBadge } from "@/components/wallet/StatusBadge";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet · VFarmers" }] }),
  component: WalletPage,
});

type Tab = "deposit" | "withdraw" | "history";

const KNOWN_CODES: RequestErrorCode[] = [
  "invalid_amount",
  "invalid_method",
  "invalid_proof",
  "insufficient_balance",
  "unauthorized",
  "internal",
];

const ERROR_MESSAGES: Record<RequestErrorCode, string> = {
  invalid_amount:
    "Enter a valid amount greater than 0 with at most two decimal places.",
  invalid_method: "Choose a supported method.",
  invalid_proof: "Proof must be a JPEG, PNG, or PDF no larger than 10 MB.",
  insufficient_balance: "Amount exceeds your available Primary balance.",
  unauthorized: "Your session expired. Please sign in again.",
  internal: "Something went wrong. Please try again.",
};

function errorCodeOf(err: unknown): RequestErrorCode {
  const msg = err instanceof Error ? err.message : String(err);
  return KNOWN_CODES.find((c) => msg.includes(c)) ?? "internal";
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  usdt_trc20: "USDT (TRC20)",
  usdt_erc20: "USDT (ERC20)",
  card: "Card",
};

function WalletPage() {
  const [tab, setTab] = useState<Tab>("deposit");

  return (
    <div className="min-h-screen bg-hero">
      <main className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit deposit and withdrawal requests and track their status.
        </p>

        <div className="mt-6 inline-flex rounded-xl border border-border bg-card/40 p-1 text-sm">
          <TabButton active={tab === "deposit"} onClick={() => setTab("deposit")} icon={ArrowDownToLine}>
            Deposit
          </TabButton>
          <TabButton active={tab === "withdraw"} onClick={() => setTab("withdraw")} icon={ArrowUpFromLine}>
            Withdraw
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={HistoryIcon}>
            History
          </TabButton>
        </div>

        <div className="mt-6">
          {tab === "deposit" && (
            <RequestForm
              key="deposit"
              kind="deposit"
              methods={DEPOSIT_METHODS as readonly string[]}
              submit={(fd) => submitDepositRequest({ data: fd })}
            />
          )}
          {tab === "withdraw" && (
            <RequestForm
              key="withdraw"
              kind="withdraw"
              methods={WITHDRAWAL_METHODS as readonly string[]}
              submit={(fd) => submitWithdrawalRequest({ data: fd })}
            />
          )}
          {tab === "history" && <HistoryList />}
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function RequestForm({
  kind,
  methods,
  submit,
}: {
  kind: "deposit" | "withdraw";
  methods: readonly string[];
  submit: (fd: FormData) => Promise<{ request: RequestRow; deduped?: boolean }>;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RequestErrorCode | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("amount", amount);
      fd.set("method", method);
      if (file) fd.set("proof", file);
      const res = await submit(fd);
      setSuccess(
        res.deduped
          ? "This matches a recent pending request — showing the existing one."
          : `${kind === "deposit" ? "Deposit" : "Withdrawal"} request submitted.`,
      );
      setAmount("");
      setFile(null);
    } catch (err) {
      setError(errorCodeOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="glass space-y-4 rounded-3xl p-6">
      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (Seed)</label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-sm outline-none focus:border-primary/60"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-sm outline-none focus:border-primary/60"
        >
          {methods.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABELS[m] ?? m}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Proof (optional · JPEG, PNG, PDF · max 10 MB)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-card file:px-3 file:py-1.5 file:text-sm"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {ERROR_MESSAGES[error]}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {kind === "deposit" ? "Submit deposit request" : "Submit withdrawal request"}
      </button>
    </form>
  );
}

function HistoryList() {
  const [items, setItems] = useState<RequestRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (nextCursor: string | null, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(false);
    try {
      const page = await listMyRequests({
        data: { limit: 20, ...(nextCursor ? { cursor: nextCursor } : {}) },
      });
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch {
      setError(true);
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(null, false);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-card/40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-3 text-sm text-muted-foreground">
          We couldn't load your requests.
        </p>
        <button
          onClick={() => void load(null, false)}
          className="mt-4 rounded-xl border border-border bg-card/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-card"
        >
          Try again
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          No requests yet. Your deposits and withdrawals will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div
          key={`${r.type}-${r.id}`}
          className="glass flex items-center justify-between rounded-2xl px-4 py-3"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-medium capitalize">
              {r.type}
              <span className="text-muted-foreground">· {METHOD_LABELS[r.method] ?? r.method}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{r.amount}</span>
            <StatusBadge status={r.status} />
          </div>
        </div>
      ))}

      {cursor && (
        <button
          onClick={() => void load(cursor, true)}
          disabled={loadingMore}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-card disabled:opacity-60"
        >
          {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Load older requests
        </button>
      )}
    </div>
  );
}
