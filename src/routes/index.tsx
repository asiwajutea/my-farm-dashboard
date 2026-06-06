import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sprout, Wallet, Coins, Shield, ArrowLeftRight, Ticket,
  Zap, Bell, TrendingUp, Users, ArrowRight, CheckCircle2,
} from "lucide-react";
import logo from "@/assets/vfarm-logo.png";
import { Ticker } from "@/components/Ticker";
import { StatCard } from "@/components/StatCard";
import { FeatureCard } from "@/components/FeatureCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VFarm — Grow Seeds, Reap Rewards" },
      { name: "description", content: "VFarm is a community-driven farming ecosystem where members grow Seeds, earn rewards, and trade peer-to-peer with full transparency." },
      { property: "og:title", content: "VFarm — Grow Seeds, Reap Rewards" },
      { property: "og:description", content: "Join thousands of Farmers cultivating value in a transparent, community-powered ecosystem." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-hero">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="VFarm logo" className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">
              V<span className="text-primary">Farm</span>
            </span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#stats" className="transition-colors hover:text-foreground">Ecosystem</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block">
              Sign in
            </Link>
            <Link to="/auth" className="rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]">
              Become a Farmer
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-10 top-40 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-12 md:pt-24 md:pb-20">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                <Sprout className="h-3.5 w-3.5" />
                Community Farming Ecosystem
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
                Grow <span className="text-gradient-primary">Seeds</span>,
                <br />
                reap <span className="text-gradient-gold">rewards</span>.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
                VFarm is a transparent, community-driven ecosystem where every member is a Farmer.
                Cultivate Seeds, harvest cycles, and trade peer-to-peer — all in one place.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth" className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]">
                  Start farming
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a href="#how" className="rounded-xl border border-border bg-card/40 px-5 py-3 font-medium backdrop-blur transition-colors hover:bg-card">
                  Watch a cycle
                </a>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {["Transparent rewards", "Non-custodial wallets", "No hidden fees"].map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Hero card */}
            <div className="relative">
              <div className="absolute inset-0 -z-10 animate-glow rounded-3xl" />
              <div className="glass relative rounded-3xl p-6 shadow-elegant animate-float">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={logo} alt="" className="h-8 w-8" />
                    <span className="text-sm font-medium">Farming Wallet</span>
                  </div>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Active</span>
                </div>
                <div className="mt-6">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Balance</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tracking-tight">1,240.00</span>
                    <span className="text-sm text-muted-foreground">Seed</span>
                  </div>
                  <div className="text-sm text-muted-foreground">≈ $1,240.00 USDT</div>
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-background/40 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active cycle</span>
                    <span className="text-gold">+8.4% projected</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-gold" />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Maturity in 7h 42m</span>
                    <span>500 Seed locked</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { l: "Reap", i: Coins },
                    { l: "Transfer", i: ArrowLeftRight },
                    { l: "Boost", i: Zap },
                  ].map(({ l, i: I }) => (
                    <button key={l} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/50 py-3 text-xs transition-colors hover:border-primary/50 hover:text-primary">
                      <I className="h-4 w-4" />
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Ticker />
      </section>

      {/* Stats */}
      <section id="stats" className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Total Farmers" value="12,847" hint="+342 this week" />
          <StatCard icon={Sprout} label="Seed Rate" value="1.00" hint="USDT per Seed" accent="gold" />
          <StatCard icon={TrendingUp} label="Profits Generated" value="$1.2M" hint="All-time payouts" />
          <StatCard icon={Coins} label="Seeds in Circulation" value="2.18M" hint="Across all wallets" accent="gold" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-primary">Ecosystem</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Everything a Farmer needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            Two wallets, one Seed economy. Powerful tools, transparent rules.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={Wallet} title="Dual Wallets" description="Keep deposits and farming activity separate with a Primary and Farming wallet. Move Seeds between them instantly, fee-free." />
          <FeatureCard icon={Sprout} title="Farming Cycles" description="Lock Seeds, harvest after maturity, and reap principal plus rewards. Default 24h cycle, configurable durations." />
          <FeatureCard icon={Zap} title="Boosters" description="Unlock 3, 5, or 7-day cycles with Power Boosters. Stack performance to grow faster." />
          <FeatureCard icon={ArrowLeftRight} title="P2P Transfers" description="Send Seeds to other Farmers with low, transparent fees set by the community admin." />
          <FeatureCard icon={Shield} title="Built-in Escrow" description="Trade safely with held funds and dispute resolution. Release only when both sides agree." />
          <FeatureCard icon={Ticket} title="Seed Coupons" description="Purchase or redeem coupons for instant balance top-ups. Perfect for gifting and promotions." />
        </div>
      </section>

      {/* How */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gold">How it works</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              From deposit to harvest in three steps
            </h2>
            <div className="mt-8 space-y-5">
              {[
                { n: "01", t: "Deposit to Primary", d: "Fund your Primary Wallet with supported methods. Seeds convert at the live rate." },
                { n: "02", t: "Move to Farming", d: "Transfer Seeds to your Farming Wallet — instant, zero fees — and start a cycle." },
                { n: "03", t: "Reap rewards", d: "When the cycle matures, reap to receive your principal plus community rewards." },
              ].map((s) => (
                <div key={s.n} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                    {s.n}
                  </div>
                  <div>
                    <div className="font-medium">{s.t}</div>
                    <div className="text-sm text-muted-foreground">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass relative overflow-hidden rounded-3xl p-8 shadow-elegant">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/15 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bell className="h-4 w-4 text-gold" />
                Notifications
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { t: "Cycle complete · +42 Seed reaped", c: "primary" },
                  { t: "Deposit confirmed · 500 USDT", c: "muted" },
                  { t: "Booster activated · 7-day cycle", c: "gold" },
                  { t: "P2P received · 80 Seed from @sage", c: "muted" },
                ].map((n, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3 text-sm">
                    <span>{n.t}</span>
                    <span className={`h-2 w-2 rounded-full ${n.c === "primary" ? "bg-primary" : n.c === "gold" ? "bg-gold" : "bg-muted-foreground/40"}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="glass relative overflow-hidden rounded-3xl p-10 text-center md:p-14">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-gold/15" />
          <div className="relative">
            <img src={logo} alt="" className="mx-auto h-14 w-14" />
            <h3 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
              Ready to plant your first Seed?
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Join the VFarm community and start cultivating value today. Your one-time access code is generated at sign-up.
            </p>
            <Link to="/auth" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-primary px-6 py-3 font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02]">
              Create my Farmer account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-6 w-6" />
            <span>© {new Date().getFullYear()} VFarm. Cultivated by the community.</span>
          </div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Risk Disclosure</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
