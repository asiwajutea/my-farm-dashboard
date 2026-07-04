import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

import { getRateHistory, type RatePoint } from "@/lib/rate.functions";
import { cn } from "@/lib/utils";

type Range = "24h" | "7d" | "30d" | "90d" | "all";

const RANGES: { id: Range; label: string }[] = [
  { id: "24h", label: "1D" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "all", label: "All" },
];

function fmtRate(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export function RateChart() {
  const [range, setRange] = useState<Range>("30d");
  const fn = useServerFn(getRateHistory);
  const q = useQuery({
    queryKey: ["rate-history", range],
    queryFn: () => fn({ data: { range } }),
    refetchInterval: 60_000,
  });

  const data: RatePoint[] = q.data ?? [];
  const { min, max, change, changePct, current, first } = useMemo(() => {
    if (data.length === 0) {
      return { min: 0, max: 0, change: 0, changePct: 0, current: 0, first: 0 };
    }
    const rates = data.map((d) => d.rate);
    const first = data[0].rate;
    const current = data[data.length - 1].rate;
    const change = current - first;
    const changePct = first > 0 ? (change / first) * 100 : 0;
    return {
      min: Math.min(...rates),
      max: Math.max(...rates),
      change,
      changePct,
      current,
      first,
    };
  }, [data]);

  const up = change >= 0;
  const yPad = Math.max((max - min) * 0.15, current * 0.001);
  const yDomain: [number, number] = [Math.max(0, min - yPad), max + yPad];

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Seed → USDT rate
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {fmtRate(current)}
            </span>
            <span className="text-sm text-muted-foreground">USDT</span>
          </div>
          <div
            className={cn(
              "mt-0.5 inline-flex items-center gap-1 text-xs",
              up ? "text-emerald-400" : "text-destructive",
            )}
          >
            {up ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span className="tabular-nums">
              {up ? "+" : ""}
              {change.toFixed(6)} ({changePct.toFixed(2)}%)
            </span>
            <span className="text-muted-foreground">vs {RANGES.find((r) => r.id === range)?.label} ago</span>
          </div>
        </div>
        <div className="flex rounded-lg border border-border bg-card/40 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                range === r.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64 w-full">
        {q.isLoading ? (
          <div className="skeleton h-full w-full rounded-xl" />
        ) : data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Not enough data yet — the chart fills in as the rate changes.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={up ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={up ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(v) => {
                  const d = new Date(v as string);
                  return range === "24h"
                    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : d.toLocaleDateString([], { month: "short", day: "numeric" });
                }}
                stroke="transparent"
                tick={{ fill: "oklch(0.85 0.01 140)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v) => Number(v).toFixed(4)}
                stroke="transparent"
                tick={{ fill: "oklch(0.85 0.01 140)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                  color: "oklch(0.97 0.01 120)",
                }}
                labelStyle={{ color: "oklch(0.85 0.01 140)", marginBottom: "2px" }}
                itemStyle={{ color: "oklch(0.97 0.01 120)" }}
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(value: number) => [fmtRate(value) + " USDT", "Rate"]}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke={up ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                strokeWidth={2}
                fill="url(#rateFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}