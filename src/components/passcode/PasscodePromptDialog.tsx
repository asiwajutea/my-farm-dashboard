import { useState } from "react";
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
import { PasscodeInput } from "./PasscodeInput";

/**
 * Generic 6-digit prompt. Caller passes the action title and an async confirm
 * handler that receives the verified code. The dialog stays open on error so
 * the user can retry without retyping the form.
 */
export function PasscodePromptDialog({
  open,
  onOpenChange,
  title = "Enter transaction passcode",
  description = "Confirm this action with your 6-digit transaction passcode.",
  onConfirm,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: (code: string) => Promise<void> | void;
  submitting?: boolean;
}) {
  const [code, setCode] = useState("");

  async function handle() {
    if (code.length !== 6) return;
    await onConfirm(code);
    setCode("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setCode(""); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <PasscodeInput value={code} onChange={setCode} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={code.length !== 6 || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}