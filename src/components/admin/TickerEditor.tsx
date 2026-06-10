import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

import { getPublicSiteState, adminSetTicker } from "@/lib/maintenance.functions";
import { TICKER_ICON_NAMES } from "@/components/Ticker";

export function TickerEditor() {
  const getFn = useServerFn(getPublicSiteState);
  const saveFn = useServerFn(adminSetTicker);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["site-state"], queryFn: () => getFn() });
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<{ icon: string; label: string }[]>([]);

  useEffect(() => {
    if (data) {
      setEnabled(data.ticker_enabled);
      setItems(data.ticker_items ?? []);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { enabled, items } }),
    onSuccess: () => {
      toast.success("Ticker saved");
      qc.invalidateQueries({ queryKey: ["site-state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (i: number, patch: Partial<{ icon: string; label: string }>) => {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  const add = () =>
    setItems([...items, { icon: TICKER_ICON_NAMES[0], label: "New ticker item" }]);

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Marquee ticker</h2>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Items shown in the public landing-page marquee. Leave empty to fall back to defaults.
      </p>

      <div className="mt-4 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2">
            <select
              value={it.icon}
              onChange={(e) => update(i, { icon: e.target.value })}
              className="rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none"
            >
              {TICKER_ICON_NAMES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <input
              value={it.label}
              maxLength={120}
              onChange={(e) => update(i, { label: e.target.value })}
              className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1.5 text-sm outline-none focus:border-primary/60"
            />
            <button onClick={() => move(i, -1)} className="rounded p-1.5 hover:bg-muted" aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => move(i, 1)} className="rounded p-1.5 hover:bg-muted" aria-label="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => remove(i)} className="rounded p-1.5 text-destructive hover:bg-destructive/10" aria-label="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">No custom items — using built-in defaults.</p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={add}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs hover:bg-card"
        >
          <Plus className="h-3.5 w-3.5" /> Add item
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save ticker"}
        </button>
      </div>
    </section>
  );
}
