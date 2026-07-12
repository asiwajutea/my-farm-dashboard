import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Search, Plus, Trash2, Loader2, CheckCircle2, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  adminListPrivileges,
  adminGrantPrivilege,
  adminRevokePrivilege,
  adminFindUserForPrivilege,
  ALL_PRIVILEGES,
  PRIVILEGE_LABELS,
} from "@/lib/privileges.functions";

export const Route = createFileRoute("/_authenticated/admin/privileges")({
  head: () => ({ meta: [{ title: "User Privileges · Admin" }] }),
  component: AdminPrivilegesPage,
});

function AdminPrivilegesPage() {
  const listFn   = useServerFn(adminListPrivileges);
  const grantFn  = useServerFn(adminGrantPrivilege);
  const revokeFn = useServerFn(adminRevokePrivilege);
  const findFn   = useServerFn(adminFindUserForPrivilege);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-privileges"],
    queryFn: () => listFn(),
  });

  // ── Find user ─────────────────────────────────────────────────────────────
  const [search, setSearch]   = useState("");
  const [finding, setFinding] = useState(false);
  const [foundUser, setFoundUser] = useState<{
    id: string;
    display_name: string | null;
    username: string | null;
    email: string | null;
    current_privileges: string[];
  } | null>(null);
  const [note, setNote] = useState("");

  async function handleFind(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setFinding(true);
    setFoundUser(null);
    try {
      const result = await findFn({ data: { handle: search.trim() } });
      if (!result) toast.error("User not found. Try email, username, or referral code.");
      else setFoundUser(result);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Search failed"); }
    finally { setFinding(false); }
  }

  // ── Grant ─────────────────────────────────────────────────────────────────
  const grant = useMutation({
    mutationFn: (privilege: string) =>
      grantFn({ data: { user_id: foundUser!.id, privilege, note: note || undefined } }),
    onSuccess: (_, privilege) => {
      toast.success(`Granted: ${PRIVILEGE_LABELS[privilege as keyof typeof PRIVILEGE_LABELS]?.label ?? privilege}`);
      setFoundUser((prev) =>
        prev ? { ...prev, current_privileges: [...new Set([...prev.current_privileges, privilege])] } : prev
      );
      qc.invalidateQueries({ queryKey: ["admin-privileges"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Grant failed"),
  });

  // ── Revoke ────────────────────────────────────────────────────────────────
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Privilege revoked.");
      qc.invalidateQueries({ queryKey: ["admin-privileges"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Revoke failed"),
  });

  // Group rows by user
  const byUser = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const key = r.user_id;
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Privileges</h1>
          <p className="text-sm text-muted-foreground">
            Grant specific capabilities to users without making them full admins.
          </p>
        </div>
      </div>

      {/* Grant new privilege */}
      <section className="glass rounded-2xl p-6 space-y-5">
        <h2 className="font-semibold">Grant a privilege</h2>

        {/* Find user */}
        <form onSubmit={handleFind} className="flex gap-2">
          <Input
            placeholder="Search by email, @username, or referral code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={finding || !search.trim()}>
            {finding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Find
          </Button>
        </form>

        {/* Found user + privilege grid */}
        {foundUser && (
          <div className="rounded-xl border border-border bg-card/40 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{foundUser.display_name ?? foundUser.username ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{foundUser.email}</p>
                </div>
              </div>
              <button type="button" onClick={() => { setFoundUser(null); setSearch(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Note (optional — explain why)</label>
              <Input
                placeholder="e.g. Trusted team member handling deposits"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_PRIVILEGES.map((priv) => {
                const meta = PRIVILEGE_LABELS[priv];
                const has = foundUser.current_privileges.includes(priv);
                return (
                  <div
                    key={priv}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                      has ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card/20"
                    }`}
                  >
                    <Switch
                      checked={has}
                      onCheckedChange={(on) => {
                        if (on) grant.mutate(priv);
                        else {
                          const row = rows.find((r) => r.user_id === foundUser.id && r.privilege === priv);
                          if (row) revoke.mutate(row.id);
                          else {
                            setFoundUser((prev) =>
                              prev ? { ...prev, current_privileges: prev.current_privileges.filter((p) => p !== priv) } : prev
                            );
                          }
                        }
                      }}
                      disabled={grant.isPending || revoke.isPending}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{meta.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Existing privileges table */}
      <section>
        <h2 className="mb-3 font-semibold">All granted privileges</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : Object.keys(byUser).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No privileges granted yet.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byUser).map(([userId, userRows]) => {
              const sample = userRows[0];
              const name = sample.user_display_name ?? sample.user_username ?? sample.user_email ?? userId.slice(0, 8);
              return (
                <div key={userId} className="glass rounded-2xl p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{name}</span>
                    {sample.user_email && (
                      <span className="text-xs text-muted-foreground">· {sample.user_email}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {userRows.map((row) => {
                      const label = PRIVILEGE_LABELS[row.privilege as keyof typeof PRIVILEGE_LABELS]?.label ?? row.privilege;
                      return (
                        <div
                          key={row.id}
                          className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 pl-3 pr-1.5 py-1 text-xs text-primary"
                        >
                          {label}
                          <button
                            type="button"
                            onClick={() => revoke.mutate(row.id)}
                            disabled={revoke.isPending}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                            title="Revoke"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {sample.note && (
                    <p className="mt-2 text-[11px] text-muted-foreground">Note: {sample.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
