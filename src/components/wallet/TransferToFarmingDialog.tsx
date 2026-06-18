import { useState, type ReactNode } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { transferToFarmingFn } from "@/lib/farm.functions";
import { usdtToSeed, fmtAmount } from "@/lib/currency";

export function TransferToFarmingDialog({
  primaryAvailableSeed,
  rate,
  onDone,
  trigger,
}: {
  primaryAvailableSeed: number;
  rate: number;
  onDone?: () => void;
  /** Custom trigger element; defaults to the wallet-page styled button. */
  trigger?: ReactNode;
}) {
  const transferFn = useServerFn(transferToFarmingFn);
  const [open, setOpen] = useState(false);
  const [usdtStr, setUsdtStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const usdt = Number(usdtStr);
  const seedAmount =
    Number.isFinite(usdt) && usdt > 0 ? usdtToSeed(usdt, rate) : 0;
  const primaryAvailableUsdt = primaryAvailableSeed * rate;
  const insufficient = seedAmount > 0 && seedAmount > primaryAvailableSeed;
  const valid = seedAmount > 0 && !insufficient;

  async function handleSubmit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      await transferFn({ data: { amount: Number(seedAmount.toFixed(8)) } });
      toast.success(
        `Transferred ${fmtAmount(seedAmount)} Seed to farming wallet`,
      );
      setOpen(false);
      setUsdtStr("");
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  const defaultTrigger = (
    <button
      type="button"
      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-5 py-3 text-sm font-semibold transition-colors hover:bg-card"
    >
      <ArrowRightLeft className="h-4 w-4" />
      To Farming
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer to Farming Wallet</DialogTitle>
          <DialogDescription>
            Move USDT from your primary wallet. It will be converted to Seed at
            the current rate of 1 Seed = {fmtAmount(rate, 4)} USDT.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Primary available</span>
            <span className="tabular-nums">
              {fmtAmount(primaryAvailableUsdt)} USDT ·{" "}
              {fmtAmount(primaryAvailableSeed)} Seed
            </span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Amount (USDT)
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={usdtStr}
              onChange={(e) => setUsdtStr(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="mt-1 text-[11px] text-primary hover:underline"
              onClick={() => setUsdtStr(primaryAvailableUsdt.toFixed(2))}
            >
              Use max
            </button>
          </div>
          {seedAmount > 0 && (
            <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">You'll receive</span>
                <span className="font-semibold tabular-nums text-primary">
                  {fmtAmount(seedAmount)} Seed
                </span>
              </div>
            </div>
          )}
          {insufficient && (
            <p className="text-xs text-destructive">
              Insufficient primary balance.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || submitting}>
            {submitting ? "Transferring…" : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}