import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sprout, Wallet, Coins, ArrowLeftRight, Zap, LogOut, Bell, TrendingUp, Plus,
  User as UserIcon, ShieldCheck,
} from "lucide-react";
import logo from "@/assets/vfarm-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatarUrl } from "@/lib/avatar";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · VFarmers" }] }),
  component: Dashboard,
});

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  kyc_status: "unverified" | "pending" | "verified" | "rejected" | null;
}

type WalletKind = "primary" | "farming";
interface WalletRow {
  kind: WalletKind;
  balance: number;
  locked: number;
}

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [wallets, setWallets] = useState<Partial<Record<WalletKind, WalletRow>>>({});
  const [rate, setRate] = useState<number>(1);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const [{ data: prof }, { data: ws }, { data: settings }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, avatar_url, username, kyc_status")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("wallets")
          .select("kind, balance, locked")
          .eq("user_id", user.id),
        supabase.from("app_settings").select("seed_to_usdt").maybeSingle(),
      ]);
      setProfile(prof ?? { display_name: null, avatar_url: null, username: null, kyc_status: "unverified" });
      setAvatarUrl(await resolveAvatarUrl(prof?.avatar_url ?? null));
      if (ws) {
        const map: Partial<Record<WalletKind, WalletRow>> = {};
        for (const w of ws as WalletRow[]) map[w.kind] = w;
        setWallets(map);
      }
      if (settings?.seed_to_usdt) setRate(Number(settings.seed_to_usdt));
    })();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const name = profile?.display_name || email.split("@")[0] || "Farmer";
  const verified = profile?.kyc_status === "verified";

  return (
    <div className="min-h-screen bg-hero">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="VFarmers" className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">
              V<span className="text-primary">Farmers</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
              <Bell className="h-4 w-4" />
            </button>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-2 py-1.5 transition-colors hover:bg-card"
              >
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    name.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="hidden text-sm sm:inline">{name}</span>
                {verified && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
              </button>
              {menuOpen && (
                <div className="glass absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl p-1.5 shadow-elegant">
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {profile?.username ? `@${profile.username}` : email}
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-card"
                  >
                    <UserIcon className="h-4 w-4" />
                    Profile
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {/* Greeting */}
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
          <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]">
            <Plus className="h-4 w-4" />
            Start a cycle
          </button>
        </div>

        {/* Wallets */}
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <WalletCard
            title="Primary Wallet"
            balance={Number(wallets.primary?.balance ?? 0)}
            rate={rate}
            sub="Deposits and withdrawals"
            accent="gold"
            icon={Wallet}
          />
          <WalletCard
            title="Farming Wallet"
            balance={Number(wallets.farming?.balance ?? 0)}
            rate={rate}
            sub="Active farming activity"
            accent="primary"
            icon={Sprout}
          />
        </section>

        {/* Quick actions */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Deposit", i: Plus },
            { l: "Transfer", i: ArrowLeftRight },
            { l: "Reap", i: Coins },
            { l: "Boost", i: Zap },
          ].map(({ l, i: I }) => (
            <button
              key={l}
              className="glass flex flex-col items-center gap-1.5 rounded-2xl py-4 text-xs transition-colors hover:border-primary/50 hover:text-primary"
            >
              <I className="h-5 w-5" />
              {l}
            </button>
          ))}
        </section>

        {/* Empty cycle state */}
        <section className="mt-8 glass rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TrendingUp className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No active farming cycles</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Move Seeds to your Farming Wallet and start a cycle to begin harvesting rewards.
          </p>
          <button className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-card">
            <Sprout className="h-4 w-4 text-primary" />
            Learn how cycles work
          </button>
        </section>
      </main>
    </div>
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
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${
          accent === "gold" ? "bg-gold/15" : "bg-primary/15"
        }`}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            accent === "gold" ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary"
          }`}
        >
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
