import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { submitDepositRequest, submitWithdrawalRequest, RequestError } from "@/lib/api/requests.functions";
import {
  DEPOSIT_METHODS,
  WITHDRAWAL_METHODS,
  PROOF_MAX_BYTES,
  PROOF_MIME,
  type DepositMethod,
  type WithdrawalMethod,
} from "@/lib/requests.shared";
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

interface Props {
  type: "deposit" | "withdrawal";
  minAmount: number;
  hint?: string;
}

export function RequestForm({ type, minAmount, hint }: Props) {
  const isDeposit = type === "deposit";
  const methods = isDeposit ? DEPOSIT_METHODS : WITHDRAWAL_METHODS;

  const submitDeposit = useServerFn(submitDepositRequest);
  const submitWithdraw = useServerFn(submitWithdrawalRequest);
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<DepositMethod | WithdrawalMethod | "">("");
  const [file, setFile] = useState<File | null>(null);

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
      setAmount("");
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
    if (file && !(PROOF_MIME as readonly string[]).includes(file.type)) {
      toast.error(ERROR_MESSAGE.invalid_proof);
      return;
    }
    if (file && file.size > PROOF_MAX_BYTES) {
      toast.error(ERROR_MESSAGE.invalid_proof);
      return;
    }
    const fd = new FormData();
    fd.set("amount", amount);
    fd.set("method", method);
    if (file) fd.set("proof", file);
    mutation.mutate(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${type}-amount`}>Amount (Seeds)</Label>
        <Input
          id={`${type}-amount`}
          inputMode="decimal"
          step="0.01"
          min={minAmount}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
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
