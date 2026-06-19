import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setPasscode } from "@/lib/passcode.functions";
import { PasscodeInput } from "./PasscodeInput";

export function PasscodeSetupDialog({
  open,
  onOpenChange,
  isChange,
  onDone,
  forceSet,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** True when the user already has a passcode and wants to change it. */
  isChange?: boolean;
  onDone?: () => void;
  /** When true, the dialog cannot be dismissed (forced-setup gate). */
  forceSet?: boolean;
}) {
  const setFn = useServerFn(setPasscode);
  const qc = useQueryClient();
  const [current, setCurrent] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCurrent("");
    setCode("");
    setConfirm("");
  };

  async function handleSubmit() {
    if (code.length !== 6) return toast.error("Enter a 6-digit code");
    if (code !== confirm) return toast.error("Codes do not match");
    if (isChange && current.length !== 6) return toast.error("Enter your current passcode");
    setSubmitting(true);
    try {
      await setFn({ data: { code, currentCode: isChange ? current : undefined } });
      toast.success(isChange ? "Passcode updated" : "Transaction passcode set");
      qc.invalidateQueries({ queryKey: ["has-passcode"] });
      reset();
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set passcode");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (forceSet && !v) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => forceSet && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            {isChange ? "Change transaction passcode" : "Set transaction passcode"}
          </DialogTitle>
          <DialogDescription>
            This 6-digit code authorises every withdrawal and P2P transfer. Keep it private — it is
            stored securely and cannot be recovered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isChange && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Current passcode</label>
              <PasscodeInput value={current} onChange={setCurrent} autoFocus />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">New passcode</label>
            <PasscodeInput value={code} onChange={setCode} autoFocus={!isChange} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Confirm passcode</label>
            <PasscodeInput value={confirm} onChange={setConfirm} />
          </div>
        </div>

        <DialogFooter>
          {!forceSet && (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isChange ? "Update" : "Set passcode"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}