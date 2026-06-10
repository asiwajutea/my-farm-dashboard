import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { submitDepositRequest, submitWithdrawalRequest, RequestError } from "@/lib/api/requests.functions";
import {
  DEPOSIT_METHODS,
  WITHDRAWAL_METHODS,
  PROOF_MAX_BYTES,
  PROOF_MIME,
  type DepositMethod,
  type WithdrawalMethod,
} from "@/lib/requests.shared";
import { usdtToSeed, usdtToSeedString, fmtSeed } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  usdt_trc20: "USDT (TRC20)",
  usdt_erc20: "USDT (ERC20)",
  card: "Card",
};

const ERROR_MESSAGE: Record<string, string> = {
  invalid_amount: "Enter a valid amount (max 2 decimals).",
  invalid_method: "Choose a valid method.",
  invalid_proof: `Proof must be PNG, JPG, or PDF, up to ${PROOF_MAX_BYTES / (1024 * 1024)}MB.`,
  insufficient_balance: "Insufficient available balance.",
  withdrawals_locked:
    "Withdrawals are locked for payout processing (Thursday–Friday). Please try again after the payout.",
  unauthorized: "Please sign in again.",
  internal: "Something went wrong. Please try again.",
};

function pickMessage(err: unknown): string {
  if (err instanceof RequestError) return ERROR_MESSAGE[err.code] ?? "Request failed.";
  if (err instanceof Error) {
    const msg = err.message;
    if (msg in ERROR_MESSAGE) return ERROR_MESSAGE[msg];
  }
  return "Request failed.";
}

/** Shared rate hook: USDT value of 1 Seed (app_settings.seed_to_usdt). */
export function useSeedRate() {
  return useQuery({
    queryKey: ["seed-rate"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("seed_to_usdt").maybeSingle();
      const rate = Number(data?.seed_to_usdt ?? 0);
      return rate > 0 ? rate : 1;
    },
  });
}

interface Props {
  type: "deposit" | "withdrawal";
  /** Minimum amount expressed in USDT. */
  minUsdt?: number;
  /** Available primary-wallet balance in Seed, for withdrawal guards. */
  availableSeed?: number;
  hint?: string;
}

export function RequestForm({ type, minUsdt = 0, availableSeed, hint }: Props) {
  const isDeposit = type === "deposit";
  const methods = isDeposit ? DEPOSIT_METHODS : WITHDRAWAL_METHODS;

  const submitDeposit = useServerFn(submitDepositRequest);
  const submitWithdraw = useServerFn(submitWithdrawalRequest);
  const qc = useQueryClient();
  const { data: rate = 1 } = useSeedRate();

  // Amount is entered in USDT; we submit the Seed equivalent to the API.
  const [usdt, setUsdt] = useState("");
  const [method, setMethod] = useState<DepositMethod | WithdrawalMethod | "">("");
  const [file, setFile] = useState<File | null>(null);

  const usdtNum = Number(usdt) || 0;
  const seedEquivalent = usdtToSeed(usdtNum, rate);
  const availableUsdt = availableSeed !== undefined ? availableSeed * rate : undefined;
  const overBalance =
    !isDeposit && availableUsdt !== undefined && usdtNum > availableUsdt + 1e-9;
  const belowMin = usdtNum > 0 && usdtNum < minUsdt;

  const mutation = useMutation({
    mutationFn: async (fd: FormData) => {
      return isDeposit ? submitDeposit({ data: fd }) : submitWithdraw({ data: fd });
    },
    onSuccess: (res) => {
      const deduped = (res as { deduped?: boolean })?.deduped;
      toast.success(
        deduped
          ? "Duplicate detected — showing your existing pending request."
          : `${isDeposit ? "Deposit" : "Withdrawal"} request submitted.`,
      );
      setUsdt("");
      setMethod("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["my-requests"] });
    },
    onError: (err) => toast.error(pickMessage(err)),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!method) {
      toast.error("Choose a method.");
      return;
    }
    if (usdtNum <= 0) {
      toast.error("Enter an amount in USDT.");
      return;
    }
    if (belowMin) {
      toast.error(`Minimum is ${minUsdt} USDT.`);
      return;
    }
    if (overBalance) {
      toast.error("Amount exceeds your available balance.");
      return;
    }
    if (file && !(PROOF_MIME as readonly string[]).includes(file.type)) {
      toast.error(ERROR_MESSAGE.invalid_proof);
      return;
    }
    if (file && file.size > PROOF_MAX_BYTES) {
      toast.error(ERROR_MESSAGE.invalid_proof);
      return;
    }
    const fd = new FormData();
    // The API is Seed-denominated; submit the converted Seed amount (2 dp).
    fd.set("amount", usdtToSeedString(usdtNum, rate));
    fd.set("method", method);
    if (file) fd.set("proof", file);
    mutation.mutate(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${type}-amount`}>Amount (USDT)</Label>
        <Input
          id={`${type}-amount`}
          inputMode="decimal"
          step="0.01"
          min={minUsdt || undefined}
          placeholder="0.00"
          value={usdt}
          onChange={(e) => setUsdt(e.target.value)}
          required
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {usdtNum > 0 ? (
              <>≈ <span className="font-medium text-foreground">{fmtSeed(seedEquivalent)}</span></>
            ) : (
              hint
            )}
          </span>
          {!isDeposit && availableUsdt !== undefined && (
            <span className="text-muted-foreground">
              Available: {availableUsdt.toFixed(2)} USDT
            </span>
          )}
        </div>
        {belowMin && (
          <p className="text-xs text-destructive">Minimum is {minUsdt} USDT.</p>
        )}
        {overBalance && (
          <p className="text-xs text-destructive">Amount exceeds your available balance.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${type}-method`}>Method</Label>
        <Select value={method} onValueChange={(v) => setMethod(v as DepositMethod | WithdrawalMethod)}>
          <SelectTrigger id={`${type}-method`}>
            <SelectValue placeholder="Choose method" />
          </SelectTrigger>
          <SelectContent>
            {methods.map((m) => (
              <SelectItem key={m} value={m}>
                {METHOD_LABEL[m] ?? m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${type}-proof`}>Proof (optional)</Label>
        <Input
          id={`${type}-proof`}
          type="file"
          accept={PROOF_MIME.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">PNG, JPG, or PDF up to 10MB.</p>
      </div>

      <Button type="submit" className="w-full" disabled={mutation.isPending || belowMin || overBalance}>
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          `Submit ${isDeposit ? "deposit" : "withdrawal"} request`
        )}
      </Button>
    </form>
  );
}
