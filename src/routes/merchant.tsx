import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  HandshakeIcon,
  Leaf,
  Lock,
  ShieldCheck,
  Star,
  Store,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import logo from "@/assets/vfarm-logo.png";

export const Route = createFileRoute("/merchant")({
  head: () => ({
    meta: [
      { title: "Merchants Call · VFarmers" },
      { name: "description", content: "Join the VFarmers Merchant Network. Buy Seed at lower rates, resell for profit, and grow your business with a trusted platform." },
    ],
  }),
  component: MerchantLanding,
});

function MerchantLanding() {
  return (
    <div className="min-h-screen bg-hero text-foreground">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="/" className="flex items-center gap-2.5">
            <img src={logo} alt="VFarmers" className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">
              V<span className="text-primary">Farmers</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#benefits" className="transition-colors hover:text-foreground">Benefits</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#perfect-for" className="transition-colors hover:text-foreground">Who it's for</a>
          </nav>
          <a
            href="https://merchant.vfarmers.app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            Become a Merchant
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute left-1/3 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute right-10 top-32 h-64 w-64 rounded-full bg-gold/15 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="grid items-center gap-10 md:grid-cols-2">
            {/* Left copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Leaf className="h-3.5 w-3.5" />
                VFarmers Merchant Programme
              </div>

              <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
                <span className="text-gradient-primary">MERCHANTS</span>
                <br />
                <span className="text-foreground">CALL!</span>
                <span className="ml-2 inline-block text-primary">🌱</span>
              </h1>

              <p className="mt-3 text-lg font-semibold text-muted-foreground md:text-xl">
                Partner. <span className="text-primary">Profit.</span>{" "}
                <span className="text-gold">Prosper.</span>
              </p>

              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                Join the VFarmers Merchant Network and unlock{" "}
                <strong className="text-foreground">bigger opportunities</strong>. Buy Seed at
                exclusive rates, set your own resale price, and build a thriving business on a
                trusted platform.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="https://merchant.vfarmers.app"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3 font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
                >
                  Become a Merchant Today
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a
                  href="#benefits"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/40 px-6 py-3 font-semibold backdrop-blur transition-colors hover:bg-card"
                >
                  See the benefits
                </a>
              </div>

              <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {["Trusted Platform", "Secure Transactions", "Growing Community"].map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — hero card */}
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-gold/10 blur-2xl" />
              <div className="glass relative overflow-hidden rounded-3xl p-7 shadow-elegant">
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/20 blur-2xl" />

                <div className="relative">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Store className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold">Merchant Dashboard</div>
                      <div className="text-xs text-muted-foreground">VFarmers Partner</div>
                    </div>
                    <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Active</span>
                  </div>

                  {/* Merchant stats */}
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {[
                      { label: "Seed purchased", value: "50,000", unit: "Seed", color: "text-primary" },
                      { label: "Profit margin", value: "+18%", unit: "avg", color: "text-gold" },
                      { label: "Customers served", value: "1,240", unit: "this month", color: "text-primary" },
                      { label: "Total earnings", value: "9,200", unit: "USDT", color: "text-gold" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-border bg-background/50 p-3">
                        <div className="text-[11px] text-muted-foreground">{s.label}</div>
                        <div className={`mt-1 text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
                        <div className="text-[11px] text-muted-foreground">{s.unit}</div>
                      </div>
                    ))}
                  </div>

                  {/* Promo tag */}
                  <div className="mt-5 flex items-center justify-between rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3">
                    <div>
                      <div className="text-xs font-medium text-gold uppercase tracking-wider">Merchant pricing</div>
                      <div className="text-lg font-bold text-foreground">Lower Cost. Higher Margin.</div>
                    </div>
                    <TrendingUp className="h-8 w-8 text-gold" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key message strip ── */}
      <div className="border-y border-border/40 bg-primary/5 py-4">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-5 text-sm font-semibold text-foreground">
          {["Lower Cost", "Higher Margin", "Greater Success"].map((t, i) => (
            <div key={t} className="flex items-center gap-2">
              {i > 0 && <span className="hidden text-primary/40 md:block">·</span>}
              <span className={i === 2 ? "text-gold" : "text-foreground"}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Benefits ── */}
      <section id="benefits" className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Star className="h-3.5 w-3.5" />
            As a Merchant, You Get
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to <span className="text-gradient-primary">grow</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            The VFarmers Merchant Network gives you exclusive access to tools, pricing, and support
            that regular users don't have.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: BadgeDollarSign,
              title: "Buy Seed at Lower Rate",
              desc: "Enjoy exclusive merchant pricing — buy Seeds at a discount and sell at your own preferred rate.",
              color: "text-primary bg-primary/10 border-primary/20",
            },
            {
              icon: BarChart3,
              title: "Resell & Make More Profit",
              desc: "Set your own resale price and maximize earnings. The margin is yours to keep.",
              color: "text-gold bg-gold/10 border-gold/20",
            },
            {
              icon: HandshakeIcon,
              title: "Reliable Supply & Support",
              desc: "Consistent supply backed by dedicated merchant support. We're here when you need us.",
              color: "text-primary bg-primary/10 border-primary/20",
            },
            {
              icon: TrendingUp,
              title: "Grow Your Business",
              desc: "Increase customer trust and retention by partnering with a recognized, trusted platform.",
              color: "text-gold bg-gold/10 border-gold/20",
            },
          ].map((b) => (
            <div
              key={b.title}
              className="glass flex flex-col gap-4 rounded-2xl border border-border p-6 transition-all hover:-translate-y-1 hover:shadow-elegant"
            >
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${b.color}`}>
                <b.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="border-y border-border/40 bg-card/20 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-gold">How it works</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Partner today. <span className="text-gold">Profit tomorrow.</span>
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Store,
                title: "Apply as a Merchant",
                desc: "Visit merchant.vfarmers.app and complete a simple merchant application. Approval is fast.",
              },
              {
                step: "02",
                icon: Zap,
                title: "Buy Seed at Merchant Rate",
                desc: "Once approved, purchase Seeds at exclusive merchant pricing — lower than standard rates.",
              },
              {
                step: "03",
                icon: BadgeDollarSign,
                title: "Resell & Earn",
                desc: "Set your own price, serve your customers, and pocket the difference. Rinse and repeat.",
              },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                      {s.step}
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/60 text-muted-foreground">
                      <s.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Perfect for ── */}
      <section id="perfect-for" className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Perfect for</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Is this <span className="text-gradient-primary">right for you?</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              The VFarmers Merchant Network is designed for anyone who wants to generate income by
              providing Seeds to their community.
            </p>

            <div className="mt-8 space-y-3">
              {[
                { label: "Business Owners", desc: "Add a new revenue stream to your existing business." },
                { label: "Top-Up Centers", desc: "Expand your portfolio with VFarmers Seed top-ups." },
                { label: "Community Leaders", desc: "Serve your network and earn while helping them grow." },
                { label: "Entrepreneurs", desc: "Start a Seed reselling business with zero stock risk." },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            {[
              { icon: ShieldCheck, label: "Trusted Platform", desc: "Thousands of verified farmers trust VFarmers daily." },
              { icon: Lock, label: "Secure Transactions", desc: "End-to-end secure payments and wallet operations." },
              { icon: Users, label: "Growing Community", desc: "Join a rapidly expanding merchant and farmer network." },
            ].map((t) => (
              <div key={t.label} className="glass flex flex-col items-center gap-3 rounded-2xl p-5 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <t.icon className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-10 text-center shadow-glow md:p-14">
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute left-10 top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-48 w-48 rounded-full bg-gold/30 blur-3xl" />
          </div>
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
              <Store className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-3xl font-black tracking-tight text-white md:text-4xl">
              Become a VFarmers Merchant Today!
            </h3>
            <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">
              Partner today. Profit tomorrow. Join the network that puts more money in your pocket.
            </p>

            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm text-white/80">
              🌐 <span className="font-mono font-semibold text-white">merchant.vfarmers.app</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://merchant.vfarmers.app"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 font-bold text-primary shadow-elegant transition-transform hover:scale-[1.02]"
              >
                Apply Now — It's Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            <p className="mt-4 text-xs text-primary-foreground/60">
              Together we grow. Together we prosper. 🌱
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-6 w-6" />
            <span>© {new Date().getFullYear()} VFarmers · Grow Together. Earn Together.</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <a href="/terms" className="hover:text-foreground">Terms</a>
            <a href="/privacy" className="hover:text-foreground">Privacy</a>
            <a href="/" className="hover:text-foreground">Farmers Landing</a>
          </div>
        </div>
        <div className="mt-4 border-t border-border/20 pt-4 text-center text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground/50">
          Together We Grow · Together We Prosper
        </div>
      </footer>
    </div>
  );
}
