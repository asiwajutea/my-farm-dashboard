import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Loader2, Save, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  adminGetAchievementRewards,
  adminUpdateAchievementReward,
  type AchievementReward,
} from "@/lib/achievement-rewards.functions";

export const Route = createFileRoute("/_authenticated/admin/achievements")({
  head: () => ({ meta: [{ title: "Achievement Rewards · Admin" }] }),
  component: AdminAchievementsPage,
});

type Draft = {
  pv_reward: string;
  usdt_reward: string;
  enabled: boolean;
};

const CATEGORY_ORDER = [
  "welcome", "farming", "deposits", "earnings", "network",
  "trading", "streaks", "loyalty", "engagement", "legendary",
];

function AdminAchievementsPage() {
  const getFn  = useServerFn(adminGetAchievementRewards);
  const saveFn = useServerFn(adminUpdateAchievementReward);
  const qc = useQueryClient();

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["admin-achievement-rewards"],
    queryFn: () => getFn(),
  });

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!rewards) return;
    const next: Record<string, Draft> = {};
    for (const r of rewards) {
      next[r.achievement_id] = {
        pv_reward:   String(r.pv_reward),
        usdt_reward: String(r.usdt_reward),
        enabled:     r.enabled,
      };
    }
    setDrafts(next);
  }, [rewards]);

  const save = useMutation({
    mutationFn: (r: AchievementReward) =>
      saveFn({
        data: {
          achievement_id: r.achievement_id,
          pv_reward:   Number(drafts[r.achievement_id]?.pv_reward)   ?? 0,
          usdt_reward: Number(drafts[r.achievement_id]?.usdt_reward) ?? 0,
          enabled:     drafts[r.achievement_id]?.enabled ?? true,
        },
      }),
    onSuccess: (_, r) => {
      toast.success(`Saved: ${r.title}`);
      setSaved((prev) => new Set([...prev, r.achievement_id]));
      setTimeout(() => setSaved((prev) => { const n = new Set(prev); n.delete(r.achievement_id); return n; }), 2000);
      qc.invalidateQueries({ queryKey: ["admin-achievement-rewards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const setDraft = (id: string, key: keyof Draft, value: string | boolean) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  // Group by category in display order
  const grouped = CATEGORY_ORDER.reduce<Record<string, AchievementReward[]>>(
    (acc, cat) => {
      acc[cat] = (rewards ?? []).filter((r) => r.category === cat);
      return acc;
    }, {},
  );

  const totalPending = rewards?.filter((r) => {
    const d = drafts[r.achievement_id];
    if (!d) return false;
    return (
      Number(d.pv_reward) !== r.pv_reward ||
      Number(d.usdt_reward) !== r.usdt_reward ||
      d.enabled !== r.enabled
    );
  }).length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Achievement Rewards</h1>
            <p className="text-sm text-muted-foreground">
              Configure PV and USDT rewards per achievement. Changes take effect on next unlock.
            </p>
          </div>
        </div>
        {totalPending > 0 && (
          <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            {totalPending} unsaved change{totalPending > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4 rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-xs text-muted-foreground">
        <span><strong className="text-foreground">PV</strong> — Personal Volume points credited to the user's PV ledger</span>
        <span><strong className="text-foreground">USDT</strong> — Amount credited directly to the user's Primary Wallet</span>
        <span><strong className="text-foreground">Enabled</strong> — Only enabled achievements can be claimed; disabled ones still display on the achievements page</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading achievement rewards…
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat] ?? [];
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {cat}
                </h2>
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3 min-w-[220px]">Achievement</th>
                        <th className="p-3 w-28 text-center">PV Reward</th>
                        <th className="p-3 w-32 text-center">USDT Reward</th>
                        <th className="p-3 w-20 text-center">Enabled</th>
                        <th className="p-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => {
                        const d = drafts[r.achievement_id];
                        if (!d) return null;
                        const isDirty =
                          Number(d.pv_reward) !== r.pv_reward ||
                          Number(d.usdt_reward) !== r.usdt_reward ||
                          d.enabled !== r.enabled;
                        const isSaved = saved.has(r.achievement_id);
                        return (
                          <tr key={r.achievement_id} className={`border-t border-border/60 ${isDirty ? "bg-amber-500/5" : ""}`}>
                            <td className="p-3">
                              <div className="flex items-start gap-1.5">
                                <div className="min-w-0">
                                  <div className="font-medium">{r.title}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{r.achievement_id}</div>
                                </div>
                                {r.description && (
                                  <span
                                    title={r.description}
                                    className="mt-0.5 shrink-0 cursor-help text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={`Description: ${r.description}`}
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                              {r.description && (
                                <p className="mt-1 text-[11px] text-muted-foreground/70 leading-relaxed max-w-xs">
                                  {r.description}
                                </p>
                              )}
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                className="w-24 text-center mx-auto"
                                value={d.pv_reward}
                                onChange={(e) => setDraft(r.achievement_id, "pv_reward", e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <div className="relative mx-auto w-28">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="w-full pr-12 text-right"
                                  value={d.usdt_reward}
                                  onChange={(e) => setDraft(r.achievement_id, "usdt_reward", e.target.value)}
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  USDT
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={d.enabled}
                                onCheckedChange={(v) => setDraft(r.achievement_id, "enabled", v)}
                              />
                            </td>
                            <td className="p-3 text-right">
                              {isSaved ? (
                                <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />
                              ) : (
                                <Button
                                  size="sm"
                                  variant={isDirty ? "default" : "outline"}
                                  onClick={() => save.mutate(r)}
                                  disabled={save.isPending}
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
