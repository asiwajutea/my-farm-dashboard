import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Plus, Trash2, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListPrivileges,
  adminGrantPrivilege,
  adminRevokePrivilege,
  ALL_PRIVILEGES,
  type PrivilegeRow,
} from "@/lib/privileges.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/privileges")({
  head: () => ({ meta: [{ title: "Privileges · Admin" }] }),
  component: AdminPrivilegesPage,
});

function AdminPrivilegesPage() {
  const listFn   = useServerFn(adminListPrivileges);
  const grantFn  = useServerFn(adminGrantPrivilege);
  const revokeFn = useServerFn(adminRevokePrivilege);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-privileges"],
    queryFn: () => listFn(),
  });

  // ── Grant form ────────────────────────────────────────────────────────────
  const [handle, setHandle]       = useState("");
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolving, setResolving]   = useState(false);
  const [selectedPrivs, setSelectedPrivs] = useState<Set<string>>(new Set());
  const [note, setNote]             = useState("");

  async function resolveUser() {
    if (!handle.trim()) return;
    setResolving(true);
    setResolvedId(null);
    setResolvedName(null);
    try {
      // Try username match first, then referral code
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .or(`username.ilike.${handle.trim()},referral_code.ilike.${handle.trim()}`)
        .limit(1)
        .maybeSingle();
      if (data) {
        setResolvedId(data.id);
        setResolvedName(data.display_name ?? data.username ?? data.id);
      } else {
        toast.error("User not found. Try their username or referral code.");
      }
    } catch {
      toast.error("Lookup failed");
    } finally {
      setResolving(false);
    }
  }

  const togglePriv = (code: string) =>
    setSelectedPrivs((prev) => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });

  const grant = useMutation({
    mutationFn: async () => {
      if (!resolvedId || selectedPrivs.size === 0) throw new Error("Select a user and at least one privilege");
      for (const privilege of selectedPrivs) {
        await grantFn({ data: { user_id: resolvedId, privilege, note: note || undefined } });
      }
    },
    onSuccess: () => {
      toast.success("Privileges granted.");
      setHandle(""); setResolvedId(null); setResolvedName(null);
      setSelectedPrivs(new Set()); setNote("");
      qc.invalidateQueries({ queryKey: ["admin-privileges"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Grant failed"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Privilege revoked.");
      qc.invalidateQueries({ queryKey: ["admin-privileges"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Revoke failed"),
  });

  // Group active grants by user
  const byUser = rows.reduce<Record<string, PrivilegeRow[]>>((acc, r) => {
    (acc[r.user_id] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Privileges</h1>
          <p className="text-sm text-muted-foreground">
            Grant specific capabilities to users without making them full admins.
          </p>
        </div>
      </div>

      {/* ── Grant form ── */}
      <section className="glass rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-semibold">Grant privileges</h2>

        {/* User lookup */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Username or referral code</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. sage_farmer or 7A86CF00"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resolveUser()}
            />
            <Button variant="outline" onClick={resolveUser} disabled={resolving || !handle.trim()}>
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {resolvedName && (
            <p className="mt-1.5 text-xs text-primary flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Found: <span className="font-semibold">{resolvedName}</span>
              <button type="button" onClick={() => { setResolvedId(null); setResolvedName(null); setHandle(""); }}>
                <X className="h-3.5 w-3.5 text-muted-foreground ml-1 hover:text-foreground" />
              </button>
            </p>
          )}
        </div>

        {/* Privilege checkboxes */}
        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Select privileges</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_PRIVILEGES.map((p) => (
              <label key={p.code} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selectedPrivs.has(p.code) ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card/30 hover:border-border"}`}>
                <Switch
                  checked={selectedPrivs.has(p.code)}
                  onCheckedChange={() => togglePriv(p.code)}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Note (optional — internal reference)</label>
          <Input
            placeholder="e.g. Temporary access for audit review"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <Button
          className="gap-2"
          onClick={() => grant.mutate()}
          disabled={grant.isPending || !resolvedId || selectedPrivs.size === 0}
        >
          {grant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Grant {selectedPrivs.size > 0 ? `${selectedPrivs.size} privilege${selectedPrivs.size > 1 ? "s" : ""}` : "privileges"}
        </Button>
      </section>

      {/* ── Active grants ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Active grants</h2>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : Object.keys(byUser).length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
            No privileges granted yet.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byUser).map(([userId, userRows]) => {
              const name  = userRows[0].grantee_name  ?? userRows[0].grantee_email ?? userId;
              const email = userRows[0].grantee_email ?? "";
              return (
                <div key={userId} className="glass rounded-2xl p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <div>
                      <span className="text-sm font-semibold">{name}</span>
                      {email && <span className="ml-2 text-xs text-muted-foreground">{email}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {userRows.map((r) => {
                      const meta = ALL_PRIVILEGES.find((p) => p.code === r.privilege);
                      return (
                        <div key={r.id} className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5 text-xs">
                          <span className="font-medium">{meta?.label ?? r.privilege}</span>
                          {r.note && <span className="text-muted-foreground">· {r.note}</span>}
                          <button
                            type="button"
                            onClick={() => revoke.mutate(r.id)}
                            disabled={revoke.isPending}
                            className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label={`Revoke ${r.privilege}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
