import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Banknote, Wallet, Plus, Trash2, Loader2, Lock, Star } from "lucide-react";

import {
  listPayoutMethods,
  savePayoutMethod,
  deletePayoutMethod,
  type PayoutMethod,
} from "@/lib/payout-methods.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasscodePromptDialog } from "@/components/passcode/PasscodePromptDialog";

type Kind = "bank" | "crypto";

type FormState = {
  label: string;
  is_default: boolean;
  // bank
  bank_name: string;
  account_name: string;
  account_number: string;
  routing_number: string;
  iban: string;
  swift: string;
  // crypto
  network: string;
  address: string;
  memo: string;
};

const EMPTY: FormState = {
  label: "",
  is_default: false,
  bank_name: "",
  account_name: "",
  account_number: "",
  routing_number: "",
  iban: "",
  swift: "",
  network: "TRC20",
  address: "",
  memo: "",
};

export function PayoutMethodsSection() {
  const listFn = useServerFn(listPayoutMethods);
  const saveFn = useServerFn(savePayoutMethod);
  const deleteFn = useServerFn(deletePayoutMethod);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["payout-methods"],
    queryFn: () => listFn(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bank");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [askPasscode, setAskPasscode] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (passcode: string) => {
      const payload =
        kind === "bank"
          ? {
              kind: "bank" as const,
              label: form.label,
              is_default: form.is_default,
              bank_name: form.bank_name,
              account_name: form.account_name,
              account_number: form.account_number,
              routing_number: form.routing_number || null,
              iban: form.iban || null,
              swift: form.swift || null,
              passcode,
            }
          : {
              kind: "crypto" as const,
              label: form.label,
              is_default: form.is_default,
              network: form.network,
              address: form.address,
              memo: form.memo || null,
              passcode,
            };
      return saveFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Payout method saved.");
      setForm(EMPTY);
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["payout-methods"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed.");
      qc.invalidateQueries({ queryKey: ["payout-methods"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove"),
  });

  const openAdd = (k: Kind) => {
    setKind(k);
    setForm({ ...EMPTY, network: k === "crypto" ? "TRC20" : EMPTY.network });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) return toast.error("Give this method a label.");
    if (kind === "bank") {
      if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim()) {
        return toast.error("Bank name, account name and account number are required.");
      }
    } else {
      if (!form.network.trim() || !form.address.trim()) {
        return toast.error("Network and wallet address are required.");
      }
    }
    setAskPasscode(true);
  };

  return (
    <section className="glass mt-5 rounded-3xl p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Wallet className="h-4 w-4 text-primary" /> Payout methods
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Save the bank accounts and crypto wallets you want to withdraw to. Your
            transaction passcode is required to save any new details.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openAdd("bank")}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Bank
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openAdd("crypto")}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Wallet
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        )}
        {!isLoading && data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No payout methods yet. Add a bank account or crypto wallet to speed up withdrawals.
          </div>
        )}
        {data.map((m) => (
          <MethodCard
            key={m.id}
            method={m}
            onDelete={() => {
              if (confirm("Remove this payout method?")) deleteMutation.mutate(m.id);
            }}
            deleting={deleteMutation.isPending && deleteMutation.variables === m.id}
          />
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {kind === "bank" ? <Banknote className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
              Add {kind === "bank" ? "bank account" : "crypto wallet"}
            </DialogTitle>
            <DialogDescription>
              You will be asked for your transaction passcode before saving.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pm-label">Label</Label>
              <Input
                id="pm-label"
                placeholder={kind === "bank" ? "e.g. Chase primary" : "e.g. Binance TRC20"}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                maxLength={80}
                required
              />
            </div>
            {kind === "bank" ? (
              <>
                <TwoCol>
                  <FieldRow label="Bank name" value={form.bank_name} onChange={(v) => setForm({ ...form, bank_name: v })} required />
                  <FieldRow label="Account name" value={form.account_name} onChange={(v) => setForm({ ...form, account_name: v })} required />
                </TwoCol>
                <FieldRow label="Account number / IBAN" value={form.account_number} onChange={(v) => setForm({ ...form, account_number: v })} required />
                <TwoCol>
                  <FieldRow label="Routing / sort code" value={form.routing_number} onChange={(v) => setForm({ ...form, routing_number: v })} />
                  <FieldRow label="SWIFT / BIC" value={form.swift} onChange={(v) => setForm({ ...form, swift: v })} />
                </TwoCol>
              </>
            ) : (
              <>
                <FieldRow label="Network" value={form.network} onChange={(v) => setForm({ ...form, network: v.toUpperCase() })} placeholder="TRC20, ERC20, BEP20, SOL…" required />
                <FieldRow label="Wallet address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} required />
                <FieldRow label="Memo / tag (optional)" value={form.memo} onChange={(v) => setForm({ ...form, memo: v })} />
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              Use as default {kind === "bank" ? "bank account" : "wallet"}
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PasscodePromptDialog
        open={askPasscode}
        onOpenChange={setAskPasscode}
        title="Confirm with passcode"
        description="Enter your 6-digit transaction passcode to save this payout method."
        submitting={saveMutation.isPending}
        onConfirm={async (code) => {
          await saveMutation.mutateAsync(code);
          setAskPasscode(false);
        }}
      />
    </section>
  );
}

function MethodCard({
  method,
  onDelete,
  deleting,
}: {
  method: PayoutMethod;
  onDelete: () => void;
  deleting: boolean;
}) {
  const isBank = method.kind === "bank";
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
          {isBank ? <Banknote className="h-4 w-4 text-primary" /> : <Wallet className="h-4 w-4 text-primary" />}
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            {method.label}
            {method.is_default && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                <Star className="h-2.5 w-2.5" /> default
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {isBank ? (
              <>
                {method.bank_name} · {maskTail(method.account_number)}
                {method.account_name ? ` · ${method.account_name}` : ""}
              </>
            ) : (
              <>
                {method.network} · {maskMiddle(method.address)}
                {method.memo ? ` · memo ${method.memo}` : ""}
              </>
            )}
          </div>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onDelete}
        disabled={deleting}
        className="text-destructive hover:text-destructive"
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function FieldRow({
  label, value, onChange, placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function maskTail(s: string | null): string {
  if (!s) return "";
  if (s.length <= 4) return s;
  return `••••${s.slice(-4)}`;
}
function maskMiddle(s: string | null): string {
  if (!s) return "";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}