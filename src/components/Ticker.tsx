import {
  TrendingUp,
  Users,
  Sprout,
  Coins,
  Wallet,
  Zap,
  Trophy,
  Star,
  Globe,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useSiteState } from "@/hooks/use-site-state";

export const TICKER_ICONS: Record<string, LucideIcon> = {
  TrendingUp,
  Users,
  Sprout,
  Coins,
  Wallet,
  Zap,
  Trophy,
  Star,
  Globe,
  Shield,
  Sparkles,
};

export const TICKER_ICON_NAMES = Object.keys(TICKER_ICONS);

const DEFAULT_ITEMS = [
  { icon: "Users", label: "12,847 Farmers" },
  { icon: "Sprout", label: "1 USDT = 1 Seed" },
  { icon: "TrendingUp", label: "+8.4% Avg. Cycle Yield" },
  { icon: "Coins", label: "2,184,920 Seeds in Circulation" },
  { icon: "TrendingUp", label: "$48,210 Reaped Today" },
  { icon: "Users", label: "342 New Farmers This Week" },
];

export const Ticker = () => {
  const { data } = useSiteState();
  if (data && data.ticker_enabled === false) return null;
  const items =
    data?.ticker_items && data.ticker_items.length > 0 ? data.ticker_items : DEFAULT_ITEMS;
  const loop = [...items, ...items];
  return (
    <div className="relative w-full overflow-hidden border-y border-border/60 bg-card/40 py-3 backdrop-blur">
      <div className="flex w-max animate-ticker gap-12 whitespace-nowrap">
        {loop.map((it, i) => {
          const Icon = TICKER_ICONS[it.icon] ?? Sparkles;
          return (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 text-primary" />
              <span>{it.label}</span>
              <span className="text-border">•</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
