import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wrench, Power, FileWarning } from "lucide-react";

import {
  getPublicSiteState,
  adminSetMaintenance,
} from "@/lib/maintenance.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance · Admin" }] }),
  component: AdminMaintenancePage,
});

// Keep this in sync with PATH_TO_KEY in src/components/MaintenanceGate.tsx
const PAGE_KEYS: { key: string; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "wallet", label: "Wallet" },
  { key: "deposit", label: "Deposit" },
  { key: "withdraw", label: "Withdraw" },
  { key: "send", label: "Send (P2P)" },
  { key: "farm", label: "Farm" },
  { key: "affiliate", label: "Affiliate" },
  { key: "escrow", label: "Escrow" },
  { key: "coupons", label: "Coupons" },
  { key: "notifications", label: "Notifications" },
  { key: "profile", label: "Profile" },
  { key: "verify", label: "KYC / Verify" },
];

function AdminMaintenancePage() {
  const getFn = useServerFn(getPublicSiteState);
  const saveFn = useServerFn(adminSetMaintenance);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["site-state"],
    queryFn: () => getFn(),
  });

  const [global, setGlobal] = useState(false);
  const [message, setMessage] = useState("");
  const [pages, setPages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (data) {
      setGlobal(data.global);
      setMessage(data.message);
      setPages(data.pages ?? {});
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { global, message, pages } }),
    onSuccess: () => {
      toast.success("Maintenance settings saved");
      qc.invalidateQueries({ queryKey: ["site-state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5">
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5" />
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance Mode</h1>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        Block farmer access to all or specific pages. Admins always bypass. Registration
        (/auth) and the landing page remain reachable.
      </p>

      {/* Global toggle */}
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <Power className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Whole site</h2>
              <p className="text-xs text-muted-foreground">
                Blocks every farmer-facing page at once.
              </p>
            </div>
          </div>
          <Toggle on={global} onChange={setGlobal} />
        </div>
      </section>

      {/* Message */}
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Message shown to farmers</h2>
        </div>
        <textarea
          rows={3}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="We'll be back shortly."
          className="mt-3 w-full resize-none rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">{message.length}/500</p>
      </section>

      {/* Per-page toggles */}
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Per page</h2>
        <p className="text-xs text-muted-foreground">
          Toggle individual pages. Has no effect while the whole site is off.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {PAGE_KEYS.map((p) => (
            <label
              key={p.key}
              className={`flex items-center justify-between rounded-lg border bg-background/40 px-3 py-2 ${
                global ? "opacity-50" : "border-border"
              }`}
            >
              <span className="text-sm">{p.label}</span>
              <Toggle
                on={!!pages[p.key]}
                onChange={(v) => setPages({ ...pages, [p.key]: v })}
                disabled={global}
              />
            </label>
          ))}
        </div>
      </section>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {save.isPending ? "Saving…" : "Save maintenance settings"}
      </button>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  disabled = false,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-primary" : "bg-muted"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
