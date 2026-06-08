import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Loader2, Search, Snowflake, ChevronRight } from "lucide-react";

import { adminListFarmers } from "@/lib/admin.functions";
import { FarmerDetail } from "@/components/admin/FarmerDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/farmers")({
  head: () => ({ meta: [{ title: "Farmers · Admin" }] }),
  component: AdminFarmers,
});

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function AdminFarmers() {
  const listFn = useServerFn(adminListFarmers);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-farmers", search],
    queryFn: () => listFn({ data: { search: search || undefined } }),
  });

  const rows = q.data ?? [];

  if (selectedId) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8">
        <FarmerDetail userId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Farmers</h1>
          <p className="text-sm text-muted-foreground">Search farmers, adjust balances, and freeze accounts.</p>
        </div>
      </header>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(input.trim());
        }}
      >
        <Input
          placeholder="Search by username, name, or referral code"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      <div className="glass mt-4 rounded-3xl p-2 sm:p-4">
        {q.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No farmers found.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:opacity-80"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {(f.display_name ?? f.username ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 truncate text-sm font-medium">
                        {f.display_name ?? f.username ?? "Farmer"}
                        {f.frozen && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                            <Snowflake className="h-3 w-3" /> Frozen
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {f.username ? `@${f.username}` : f.id.slice(0, 8)} · {f.country ?? "—"} · KYC {f.kyc_status}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <div className="font-mono tabular-nums">{fmt(f.primary_balance)} <span className="text-muted-foreground">Seed (primary)</span></div>
                      <div className="font-mono tabular-nums text-muted-foreground">{fmt(f.farming_balance)} farming</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
