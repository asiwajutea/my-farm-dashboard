import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Zap, Plus, Pencil, Trash2, Power } from "lucide-react";

import {
  adminListBoosters,
  adminCreateBooster,
  adminUpdateBooster,
  adminSetBoosterActive,
  adminDeleteBooster,
  type BoosterRow,
} from "@/lib/settings.functions";
import { seedToUsdt, usdtToSeed, fmtAmount } from "@/lib/currency";
import { Loadable } from "@/components/ui/loadable";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Draft = {
  code: string;
  label: string;
  duration_hours: number;
  reward_pct: number; // edited as %, stored as bps
  cost_usdt: number; // edited as USDT, stored as Seed
  active: boolean;
};

const EMPTY: Draft = {
  code: "",
  label: "",
  duration_hours: 24,
  reward_pct: 5,
  cost_usdt: 0,
  active: true,
};

/**
 * Admin booster CRUD. Cost is presented and edited in USDT (with the Seed
 * equivalent shown) and converted to Seed for storage; reward is edited as a
 * percentage and stored as basis points.
 */
export function BoosterManager({ rate }: { rate: number }) {
  const listFn = useServerFn(adminListBoosters);
  const createFn = useServerFn(adminCreateBooster);
  const updateFn = useServerFn(adminUpdateBooster);
  const toggleFn = useServerFn(adminSetBoosterActive);
  const deleteFn = useServerFn(adminDeleteBooster);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["admin-boosters"], queryFn: () => listFn() });

  const [editing, setEditing] = useState<BoosterRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<BoosterRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-boosters"] });

  const save = useMutation({
    mutationFn: () => {
      const cost_seed = usdtToSeed(draft.cost_usdt, rate);
      const reward_bps = Math.round(draft.reward_pct * 100);
      if (editing) {
        return updateFn({
          data: {
            id: editing.id,
            label: draft.label,
            duration_hours: draft.duration_hours,
            reward_bps,
            cost_seed,
            active: draft.active,
          },
        });
      }
      return createFn({
        data: {
          code: draft.code,
          label: draft.label,
          duration_hours: draft.duration_hours,
          reward_bps,
          cost_seed,
          active: draft.active,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Booster updated" : "Booster created");
      closeForm();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (b: BoosterRow) => toggleFn({ data: { id: b.id, active: !b.active } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Booster deleted");
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY);
    setCreating(true);
  };

  const openEdit = (b: BoosterRow) => {
    setCreating(false);
    setEditing(b);
    setDraft({
      code: b.code,
      label: b.label,
      duration_hours: b.duration_hours,
      reward_pct: b.reward_bps / 100,
      cost_usdt: seedToUsdt(b.cost_seed, rate),
      active: b.active,
    });
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
    setDraft(EMPTY);
  };

  const formOpen = creating || !!editing;
  const valid =
    draft.label.trim().length > 0 &&
    (editing || draft.code.trim().length > 0) &&
    draft.duration_hours >= 1 &&
    draft.reward_pct >= 0 &&
    draft.cost_usdt >= 0;

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Farming boosters</h2>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> New booster
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Cost is set in USDT (stored as the Seed equivalent). Reward is the % added at maturity.
      </p>

      <div className="mt-3">
        <Loadable
          loading={q.isLoading}
          skeleton={
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          }
        >
          {(q.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No boosters configured.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Booster</th>
                    <th className="px-3 py-2 text-right font-medium">Reward</th>
                    <th className="px-3 py-2 text-right font-medium">Duration</th>
                    <th className="px-3 py-2 text-right font-medium">Cost (USDT)</th>
                    <th className="px-3 py-2 text-right font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(q.data ?? []).map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{b.label}</div>
                        <div className="text-xs text-muted-foreground">{b.code}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {(b.reward_bps / 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.duration_hours}h</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtAmount(seedToUsdt(b.cost_seed, rate))}
                        <div className="text-[11px] text-muted-foreground">
                          ≈ {fmtAmount(b.cost_seed)} Seed
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            b.active
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground"
                          }`}
                        >
                          {b.active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Edit"
                            onClick={() => openEdit(b)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title={b.active ? "Disable" : "Enable"}
                            disabled={toggle.isPending}
                            onClick={() => toggle.mutate(b)}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={() => setConfirmDelete(b)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Loadable>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit booster" : "New booster"}</DialogTitle>
            <DialogDescription>
              Cost is entered in USDT and stored as the Seed equivalent at the current rate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="b-code">Code</Label>
                <Input
                  id="b-code"
                  placeholder="e.g. starter"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="b-label">Label</Label>
              <Input
                id="b-label"
                placeholder="e.g. Starter Plan"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="b-duration">Duration (hours)</Label>
                <Input
                  id="b-duration"
                  type="number"
                  min="1"
                  step="1"
                  value={draft.duration_hours}
                  onChange={(e) =>
                    setDraft({ ...draft, duration_hours: Math.max(1, Math.round(Number(e.target.value) || 0)) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-reward">Reward %</Label>
                <Input
                  id="b-reward"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.reward_pct}
                  onChange={(e) => setDraft({ ...draft, reward_pct: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-cost">Cost (USDT)</Label>
              <Input
                id="b-cost"
                type="number"
                min="0"
                step="0.01"
                value={draft.cost_usdt}
                onChange={(e) => setDraft({ ...draft, cost_usdt: Number(e.target.value) || 0 })}
              />
              <p className="text-[11px] text-muted-foreground">
                ≈ {fmtAmount(usdtToSeed(draft.cost_usdt, rate))} Seed
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Active (visible to farmers)
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Create booster"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete booster?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.label} will be removed. Boosters that already have cycles can't be
              deleted — disable them instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
