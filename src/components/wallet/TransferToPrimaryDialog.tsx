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
import { transferToPrimaryFn } from "@/lib/farm.functions";
import { fmtAmount } from "@/lib/currency";
import { PasscodePromptDialog } from "@/components/passcode/PasscodePromptDialog";

export function TransferToPrimaryDialog({
  farmingAvailableSeed,
  rate,
  onDone,
  trigger,
}: {
  farmingAvailableSeed: number;
  rate: number;
  onDone?: () => void;
  trigger?: ReactNode;
}) {
  const transferFn = useServerFn(transferToPrimaryFn);
  const [open, setOpen] = useState(false);
  const [seedStr, setSeedStr] = useState("");
  const [askPasscode, setAskPasscode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const seed = Number(seedStr);
  const usdtEquivalent = rate > 0 ? seed * rate : 0;
  const insufficient = seed > 0 && seed > farmingAvailableSeed;
  const valid = seed > 0 && !insufficient;

  async function doTransfer(code: string) {
    setSubmitting(true);
    try {
      await transferFn({ data: { amount: Number(seed.toFixed(8)), passcode: code } });
      toast.success(`Transferred ${fmtAmount(seed)} Seed → ${fmtAmount(usdtEquivalent)} USDT to primary wallet`);
      setAskPasscode(false);
      setOpen(false);
      setSeedStr("");
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
      To Primary
    </button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer to Primary Wallet</DialogTitle>
            <DialogDescription>
              Convert Seed from your farming wallet to USDT at the current rate of 1 Seed = {fmtAmount(rate, 4)} USDT.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Farming available</span>
              <span className="tabular-nums">{fmtAmount(farmingAvailableSeed)} Seed</span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Amount (Seed)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.00000001"
                placeholder="0.00"
                value={seedStr}
                onChange={(e) => setSeedStr(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="mt-1 text-[11px] text-primary hover:underline"
                onClick={() => setSeedStr(farmingAvailableSeed.toFixed(8))}
              >
                Use max
              </button>
            </div>
            {seed > 0 && (
              <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You'll receive</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {fmtAmount(usdtEquivalent)} USDT
                  </span>
                </div>
              </div>
            )}
            {insufficient && (
              <p className="text-xs text-destructive">Insufficient farming balance.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setAskPasscode(true)} disabled={!valid}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PasscodePromptDialog
        open={askPasscode}
        onOpenChange={setAskPasscode}
        title="Confirm Farming → Primary"
        description={`Convert ${fmtAmount(seed)} Seed to ${fmtAmount(usdtEquivalent)} USDT.`}
        onConfirm={doTransfer}
        submitting={submitting}
      />
    </>
  );
}