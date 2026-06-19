import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star, Plus } from "lucide-react";
import { toast } from "sonner";

import { listPvActivities, upsertPvActivity, type PvActivity } from "@/lib/pv.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/pv")({
  head: () => ({ meta: [{ title: "Points (PV) · Admin" }] }),
  component: AdminPvPage,
});

type Draft = {
  code: string;
  label: string;
  description: string;
  self: string;
  g1: string;
  g2: string;
  g3: string;
  active: boolean;
};

function toDraft(a: PvActivity): Draft {
  return {
    code: a.code,
    label: a.label,
    description: a.description ?? "",
    self: String(a.self_points),
    g1: String(a.g1_points),
    g2: String(a.g2_points),
    g3: String(a.g3_points),
    active: a.active,
  };
}

function AdminPvPage() {
  const listFn = useServerFn(listPvActivities);
  const saveFn = useServerFn(upsertPvActivity);
  const qc = useQueryClient();
  const { data: activities, isLoading } = useQuery({
    queryKey: ["pv-activities"],
    queryFn: () => listFn(),
  });

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  useEffect(() => {
    if (!activities) return;
    const next: Record<string, Draft> = {};
    for (const a of activities) next[a.code] = toDraft(a);
    setDrafts(next);
  }, [activities]);

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveFn({
        data: {
          code: d.code,
          label: d.label,
          description: d.description || undefined,
          self: Number(d.self) || 0,
          g1: Number(d.g1) || 0,
          g2: Number(d.g2) || 0,
          g3: Number(d.g3) || 0,
          active: d.active,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["pv-activities"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");

  function addActivity() {
    if (!newCode.trim() || !newLabel.trim()) {
      toast.error("Code and label are required");
      return;
    }
    save.mutate({
      code: newCode.trim().toLowerCase(),
      label: newLabel.trim(),
      description: "",
      self: "0", g1: "0", g2: "0", g3: "0",
      active: true,
    });
    setNewCode("");
    setNewLabel("");
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
          <Star className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Points (PV)</h1>
          <p className="text-sm text-muted-foreground">
            Set how many points each activity awards to the actor and their 3 uplines.
          </p>
        </div>
      </div>

      <Card className="mb-6 p-4">
        <div className="mb-2 text-sm font-medium">Add new activity</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs text-muted-foreground">Code (lowercase)</label>
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="custom_activity" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs text-muted-foreground">Label</label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Custom activity" />
          </div>
          <Button onClick={addActivity} disabled={save.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Activity</th>
                <th className="p-3 text-center">Self</th>
                <th className="p-3 text-center">Gen 1</th>
                <th className="p-3 text-center">Gen 2</th>
                <th className="p-3 text-center">Gen 3</th>
                <th className="p-3 text-center">Active</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {Object.values(drafts).map((d) => (
                <tr key={d.code} className="border-t border-border/60">
                  <td className="p-3">
                    <div className="font-medium">{d.label}</div>
                    <div className="text-xs text-muted-foreground">{d.code}</div>
                  </td>
                  {(["self", "g1", "g2", "g3"] as const).map((k) => (
                    <td key={k} className="p-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.0001"
                        className="w-20 text-center"
                        value={d[k]}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [d.code]: { ...prev[d.code], [k]: e.target.value } }))
                        }
                      />
                    </td>
                  ))}
                  <td className="p-3 text-center">
                    <Switch
                      checked={d.active}
                      onCheckedChange={(v) =>
                        setDrafts((prev) => ({ ...prev, [d.code]: { ...prev[d.code], active: v } }))
                      }
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" onClick={() => save.mutate(d)} disabled={save.isPending}>
                      Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}