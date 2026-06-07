import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sprout, Wallet, Coins, ArrowLeftRight, Zap, TrendingUp, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · VFarmers" }] }),
  component: Dashboard,
});

type WalletKind = "primary" | "farming";
interface WalletRow {
  kind: WalletKind;
  balance: number;
  locked: number;
}

function Dashboard() {
  const [name, setName] = useState("Farmer");
  const [wallets, setWallets] = useState<Partial<Record<WalletKind, WalletRow>>>({});
  const [rate, setRate] = useState<number>(1);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { data: ws }, { data: settings }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase.from("wallets").select("kind, balance, locked").eq("user_id", user.id),
        supabase.from("app_settings").select("seed_to_usdt").maybeSingle(),
      ]);
      setName(prof?.display_name || user.email?.split("@")[0] || "Farmer");
      if (ws) {
        const map: Partial<Record<WalletKind, WalletRow>> = {};
        for (const w of ws as WalletRow[]) map[w.kind] = w;
        setWallets(map);
      }
      if (settings?.seed_to_usdt) setRate(Number(settings.seed_to_usdt));
    })();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sprout className="h-3.5 w-3.5" />
            Farmer dashboard
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome back, <span className="text-gradient-primary">{name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your wallets and farming cycles, all in one place.
          </p>
        </div>
        <Link
          to="/farm"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          Start a cycle
        </Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <WalletCard title="Primary Wallet" balance={Number(wallets.primary?.balance ?? 0)} rate={rate} sub="Deposits and withdrawals" accent="gold" icon={Wallet} />
        <WalletCard title="Farming Wallet" balance={Number(wallets.farming?.balance ?? 0)} rate={rate} sub="Active farming activity" accent="primary" icon={Sprout} />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction to="/deposit" label="Deposit" icon={Plus} />
        <QuickAction to="/send" label="Transfer" icon={ArrowLeftRight} />
        <QuickAction to="/farm" label="Reap" icon={Coins} />
        <QuickAction to="/farm" label="Boost" icon={Zap} />
      </section>

      <section className="glass mt-8 rounded-3xl p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">No active farming cycles</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Move Seeds to your Farming Wallet and start a cycle to begin harvesting rewards.
        </p>
        <Link
          to="/farm"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-card"
        >
          <Sprout className="h-4 w-4 text-primary" />
          Go to Farm
        </Link>
      </section>
    </div>
  );
}

function QuickAction({
  to, label, icon: Icon,
}: { to: "/deposit" | "/send" | "/farm"; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link to={to} className="glass flex flex-col items-center gap-1.5 rounded-2xl py-4 text-xs transition-colors hover:border-primary/50 hover:text-primary">
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

function WalletCard({
  title, balance, rate, sub, accent, icon: Icon,
}: {
  title: string;
  balance: number;
  rate: number;
  sub: string;
  accent: "primary" | "gold";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const seed = balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const usdt = (balance * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-6">
      <div className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${accent === "gold" ? "bg-gold/15" : "bg-primary/15"}`} />
      <div className="relative flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent === "gold" ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="relative mt-5">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight">{seed}</span>
          <span className="text-sm text-muted-foreground">Seed</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">≈ ${usdt} USDT · {sub}</div>
      </div>
    </div>
  );
}
