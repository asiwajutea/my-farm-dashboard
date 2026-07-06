import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Trophy, Lock, CheckCircle2, Sprout, Users, Wallet, Star, Crown, Flame,
  Sparkles, Target, ArrowRightLeft, ShieldCheck, Ticket, ArrowDownToLine,
  ArrowUpFromLine, Zap, Clock, EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyCycles } from "@/lib/farm.functions";
import { getMyPvSummary } from "@/lib/pv.functions";
import { getMyAffiliateSummary } from "@/lib/affiliate.functions";
import { getPremiumDownlineWindow } from "@/lib/affiliate.functions";
import { getPremiumStatus } from "@/lib/premium.functions";
import { listMyTransfers } from "@/lib/p2p.functions";
import { listMyEscrows } from "@/lib/escrow.functions";
import { listMyRedemptions } from "@/lib/coupons.functions";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements · VFarmers" },
      { name: "description", content: "Unlock badges as you grow your farm, build your team, and earn rewards." },
    ],
  }),
  component: AchievementsPage,
});

type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: Category;
  tier: Tier;
  target: number;
  progress: number;
  unit?: string;
  reward?: string;
  hidden?: boolean;   // hidden achievements — not revealed until unlocked
};

type Category = "welcome" | "farming" | "deposits" | "earnings" | "network" | "trading" | "loyalty" | "engagement" | "legendary";

const TIER_STYLES: Record<Tier, { ring: string; bg: string; text: string; glow: string; label: string }> = {
  bronze:   { ring: "ring-amber-700/40",  bg: "bg-amber-700/10",  text: "text-amber-500",    glow: "shadow-[0_0_30px_-8px_rgba(180,83,9,0.4)]",      label: "Bronze"   },
  silver:   { ring: "ring-slate-300/40",  bg: "bg-slate-300/10",  text: "text-slate-200",    glow: "shadow-[0_0_30px_-8px_rgba(203,213,225,0.4)]",    label: "Silver"   },
  gold:     { ring: "ring-yellow-400/50", bg: "bg-yellow-400/10", text: "text-yellow-300",   glow: "shadow-[0_0_40px_-8px_rgba(250,204,21,0.55)]",    label: "Gold"     },
  platinum: { ring: "ring-cyan-300/50",   bg: "bg-cyan-300/10",   text: "text-cyan-200",     glow: "shadow-[0_0_40px_-8px_rgba(103,232,249,0.55)]",   label: "Platinum" },
  diamond:  { ring: "ring-fuchsia-400/50",bg: "bg-fuchsia-400/10",text: "text-fuchsia-200",  glow: "shadow-[0_0_50px_-8px_rgba(232,121,249,0.6)]",    label: "Diamond"  },
};

const CATEGORY_META: Record<Category, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  welcome:    { label: "Welcome",    icon: Sprout,           color: "text-primary"        },
  farming:    { label: "Farming",    icon: Sprout,           color: "text-primary"        },
  deposits:   { label: "Deposits",   icon: ArrowDownToLine,  color: "text-emerald-400"    },
  earnings:   { label: "Earnings",   icon: Star,             color: "text-gold"           },
  network:    { label: "Network",    icon: Users,            color: "text-cyan-400"       },
  trading:    { label: "Trading",    icon: ArrowRightLeft,   color: "text-violet-400"     },
  loyalty:    { label: "Loyalty",    icon: Clock,            color: "text-amber-400"      },
  engagement: { label: "Engagement", icon: Sparkles,         color: "text-fuchsia-400"    },
  legendary:  { label: "Legendary",  icon: Trophy,           color: "text-yellow-300"     },
};

function tierPoints(t: Tier): number {
  return { bronze: 10, silver: 25, gold: 50, platinum: 100, diamond: 200 }[t];
}

function AchievementsPage() {
  const fnCycles   = useServerFn(listMyCycles);
  const fnPv       = useServerFn(getMyPvSummary);
  const fnAff      = useServerFn(getMyAffiliateSummary);
  const fnPremium  = useServerFn(getPremiumStatus);
  const fnP2P      = useServerFn(listMyTransfers);
  const fnEscrow   = useServerFn(listMyEscrows);
  const fnCoupons  = useServerFn(listMyRedemptions);
  const fnPremiumDl = useServerFn(getPremiumDownlineWindow);

  const cyclesQ  = useQuery({ queryKey: ["ach-cycles"],  queryFn: () => fnCycles() });
  const pvQ      = useQuery({ queryKey: ["my-pv"],       queryFn: () => fnPv() });
  const affQ     = useQuery({ queryKey: ["ach-aff"],     queryFn: () => fnAff() });
  const premiumQ = useQuery({ queryKey: ["premium-status"], queryFn: () => fnPremium() });
  const p2pQ     = useQuery({ queryKey: ["ach-p2p"],     queryFn: () => fnP2P() });
  const escrowQ  = useQuery({ queryKey: ["ach-escrow"],  queryFn: () => fnEscrow() });
  const couponsQ = useQuery({ queryKey: ["ach-coupons"], queryFn: () => fnCoupons() });
  const premDlQ  = useQuery({ queryKey: ["ach-prem-dl"], queryFn: () => fnPremiumDl() });

  const [primaryUsdt, setPrimaryUsdt] = useState(0);
  const [farmingSeed, setFarmingSeed] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [totalSeedEarned, setTotalSeedEarned] = useState(0);
  const [boosterCount, setBoosterCount] = useState(0);
  const [accountAgeDays, setAccountAgeDays] = useState(0);
  const [displayName, setDisplayName] = useState("Farmer");
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [premiumDays, setPremiumDays] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const accountAge = Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000);
      setAccountAgeDays(accountAge);

      const [{ data: prof }, { data: ws }, { data: ledger }] = await Promise.all([
        supabase.from("profiles").select("display_name, username, country, phone, bio, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("wallets").select("kind, balance").eq("user_id", user.id),
        supabase.from("ledger_entries").select("kind, amount").eq("user_id", user.id),
      ]);

      const primary = (ws ?? []).find((w) => w.kind === "primary");
      const farming = (ws ?? []).find((w) => w.kind === "farming");
      if (primary) setPrimaryUsdt(Number(primary.balance ?? 0));
      if (farming)  setFarmingSeed(Number(farming.balance ?? 0));

      const entries = ledger ?? [];
      const deposited = entries.filter((e) => e.kind === "deposit").reduce((s, e) => s + Math.abs(Number(e.amount)), 0);
      const withdrawn = entries.filter((e) => e.kind === "withdrawal").reduce((s, e) => s + Math.abs(Number(e.amount)), 0);
      const seedEarned = entries.filter((e) => e.kind === "cycle_reap_reward").reduce((s, e) => s + Math.abs(Number(e.amount)), 0);
      const boosters = entries.filter((e) => e.kind === "booster_apply").length;
      setTotalDeposited(deposited);
      setTotalWithdrawn(withdrawn);
      setTotalSeedEarned(seedEarned);
      setBoosterCount(boosters);

      const raw = prof?.display_name || (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "Farmer";
      setDisplayName(raw.split(/\s+/)[0] || raw);

      const profileDone = !!(prof?.display_name && prof?.username && prof?.avatar_url && prof?.country);
      setIsProfileComplete(profileDone);
    })();
  }, []);

  useEffect(() => {
    if (!premiumQ.data) return;
    const status = premiumQ.data;
    if (status.tier !== "standard" && status.expires_at) {
      const activated = status.expires_at
        ? new Date(status.expires_at).getTime() - (status.days_left ?? 0) * 86400000
        : Date.now();
      const days = Math.floor((Date.now() - activated) / 86400000);
      setPremiumDays(Math.max(0, days));
    }
  }, [premiumQ.data]);

  const cycles        = cyclesQ.data ?? [];
  const reapedCount   = cycles.filter((c) => c.status === "reaped").length;
  const startedCount  = cycles.length;
  const totalPv       = pvQ.data?.total ?? 0;
  const gen1          = affQ.data?.gen1Count ?? 0;
  const totalReferrals= gen1 + (affQ.data?.gen2Count ?? 0) + (affQ.data?.gen3Count ?? 0);
  const totalEarnedUsdt = affQ.data?.totalEarned ?? 0;
  const isPremium     = (premiumQ.data?.tier ?? "standard") !== "standard" && (premiumQ.data?.days_left ?? 0) > 0;

  const p2pAll        = p2pQ.data ?? [];
  const p2pSentCount  = p2pAll.filter((t) => t.direction === "out").length;
  const p2pTotalCount = p2pAll.length;

  const escrowAll     = escrowQ.data ?? [];
  const escrowDone    = escrowAll.filter((e) => e.status === "released" || e.status === "refunded").length;

  const couponCount   = (couponsQ.data ?? []).length;

  // Premium downline window counts (rolling 90-day bracket)
  const bestGen1Window     = premDlQ.data?.bestGen1Window ?? 0;
  const bestNetworkWindow  = premDlQ.data?.bestNetworkWindow ?? 0;

  // Determine if midnight farmer / early bird from cycle start times
  const midnightCount = cycles.filter((c) => {
    const h = new Date(c.created_at as string).getHours();
    return h >= 0 && h < 4;
  }).length;
  const earlyBirdCount = cycles.filter((c) => {
    const h = new Date(c.created_at as string).getHours();
    return h >= 4 && h < 6;
  }).length;

  const achievements: Achievement[] = [
    // ── 1. Welcome ────────────────────────────────────────────────────────
    { id: "acc-created",    title: "First Seed",        description: "Create your VFarmers account.",                           icon: Sprout,          category: "welcome",    tier: "bronze",   target: 1,      progress: 1,                  reward: "Welcome badge"       },
    { id: "profile-setup",  title: "First Farmer",      description: "Complete your profile: display name, username, avatar, and country.", icon: CheckCircle2, category: "welcome", tier: "silver", target: 1, progress: isProfileComplete ? 1 : 0 },
    { id: "prem-upgrade",   title: "Premium Farmer",    description: "Upgrade to a Premium membership tier.",                   icon: Crown,           category: "welcome",    tier: "platinum", target: 1,      progress: isPremium ? 1 : 0,  reward: "Premium badge"       },

    // ── 2. Farming ────────────────────────────────────────────────────────
    { id: "first-harvest",  title: "First Harvest",     description: "Complete your first farming cycle.",                      icon: Sprout,          category: "farming",    tier: "bronze",   target: 1,      progress: reapedCount,        reward: "+5 PV"               },
    { id: "consistent",     title: "Consistent Farmer", description: "Reap 10 farming cycles.",                                 icon: Sprout,          category: "farming",    tier: "silver",   target: 10,     progress: reapedCount,        reward: "+25 PV"              },
    { id: "master-farmer",  title: "Master Farmer",     description: "Reap 50 farming cycles.",                                 icon: Sprout,          category: "farming",    tier: "gold",     target: 50,     progress: reapedCount,        reward: "+100 PV"             },
    { id: "farm-lord",      title: "Farm Lord",         description: "Reap 100 farming cycles.",                                icon: Trophy,          category: "farming",    tier: "platinum", target: 100,    progress: reapedCount,        reward: "Exclusive badge"     },
    { id: "farm-legend",    title: "Legendary Farmer",  description: "Reap 500 farming cycles — legendary status.",             icon: Trophy,          category: "farming",    tier: "diamond",  target: 500,    progress: reapedCount,        reward: "Titan badge + perks" },

    // ── 3. Deposits ───────────────────────────────────────────────────────
    { id: "first-deposit",  title: "First Deposit",     description: "Make your first deposit of any amount.",                  icon: ArrowDownToLine, category: "deposits",   tier: "bronze",   target: 1,      progress: totalDeposited > 0 ? 1 : 0, unit: "" },
    { id: "growing-inv",    title: "Growing Investor",  description: "Reach 100 USDT in total deposits.",                       icon: ArrowDownToLine, category: "deposits",   tier: "silver",   target: 100,    progress: totalDeposited,     unit: "USDT"                  },
    { id: "estab-farmer",   title: "Established Farmer",description: "Reach 500 USDT in total deposits.",                      icon: ArrowDownToLine, category: "deposits",   tier: "gold",     target: 500,    progress: totalDeposited,     unit: "USDT"                  },
    { id: "farm-owner",     title: "Farm Owner",        description: "Reach 1,000 USDT in total deposits.",                     icon: Wallet,          category: "deposits",   tier: "platinum", target: 1000,   progress: totalDeposited,     unit: "USDT"                  },
    { id: "agr-tycoon",     title: "Agricultural Tycoon",description: "Reach 10,000 USDT in total deposits.",                  icon: Crown,           category: "deposits",   tier: "diamond",  target: 10000,  progress: totalDeposited,     unit: "USDT"                  },

    // ── 4. Withdrawals ────────────────────────────────────────────────────
    { id: "first-withdraw", title: "First Withdrawal",  description: "Complete your first withdrawal.",                         icon: ArrowUpFromLine, category: "deposits",   tier: "bronze",   target: 1,      progress: totalWithdrawn > 0 ? 1 : 0 },
    { id: "fin-freedom",    title: "Financial Freedom", description: "Withdraw a total of 500 USDT.",                           icon: ArrowUpFromLine, category: "deposits",   tier: "gold",     target: 500,    progress: totalWithdrawn,     unit: "USDT"                  },
    { id: "cash-flow",      title: "Cash Flow Master",  description: "Withdraw a total of 5,000 USDT.",                         icon: ArrowUpFromLine, category: "deposits",   tier: "diamond",  target: 5000,   progress: totalWithdrawn,     unit: "USDT"                  },

    // ── 5. Earnings (Seeds) ───────────────────────────────────────────────
    { id: "first-profit",   title: "First Profit",      description: "Earn 1 Seed in farming rewards.",                         icon: Star,            category: "earnings",   tier: "bronze",   target: 1,      progress: totalSeedEarned,    unit: "Seed"                  },
    { id: "seed-collector", title: "Seed Collector",    description: "Earn 100 Seeds in farming rewards.",                      icon: Star,            category: "earnings",   tier: "silver",   target: 100,    progress: totalSeedEarned,    unit: "Seed"                  },
    { id: "seed-millionaire",title: "Seed Millionaire", description: "Earn 1,000 Seeds in farming rewards.",                    icon: Star,            category: "earnings",   tier: "gold",     target: 1000,   progress: totalSeedEarned,    unit: "Seed"                  },
    { id: "seed-legend",    title: "Seed Legend",       description: "Earn 10,000 Seeds in farming rewards.",                   icon: Trophy,          category: "earnings",   tier: "diamond",  target: 10000,  progress: totalSeedEarned,    unit: "Seed"                  },
    { id: "ref-income",     title: "First Referral Income", description: "Earn your first referral commission.",                icon: Users,           category: "earnings",   tier: "bronze",   target: 1,      progress: totalEarnedUsdt > 0 ? 1 : 0 },
    { id: "ref-expert",     title: "Referral Expert",   description: "Earn 100 USDT from referral commissions.",                icon: Users,           category: "earnings",   tier: "gold",     target: 100,    progress: totalEarnedUsdt,    unit: "USDT"                  },
    { id: "ref-master",     title: "Referral Master",   description: "Earn 1,000 USDT from referral commissions.",              icon: Crown,           category: "earnings",   tier: "diamond",  target: 1000,   progress: totalEarnedUsdt,    unit: "USDT"                  },

    // ── 6. Network ────────────────────────────────────────────────────────
    { id: "first-referral", title: "First Referral",    description: "Invite your first farmer.",                               icon: Users,           category: "network",    tier: "bronze",   target: 1,      progress: gen1                                              },
    { id: "comm-builder",   title: "Community Builder", description: "Refer 5 farmers.",                                        icon: Users,           category: "network",    tier: "silver",   target: 5,      progress: gen1                                              },
    { id: "team-leader",    title: "Team Leader",       description: "Grow your Gen 1 downline to 20 farmers.",                 icon: Users,           category: "network",    tier: "gold",     target: 20,     progress: gen1                                              },
    { id: "net-champ",      title: "Network Champion",  description: "Refer 100 farmers.",                                      icon: Trophy,          category: "network",    tier: "platinum", target: 100,    progress: gen1                                              },
    { id: "ref-king",       title: "Referral King",     description: "Refer 500 farmers.",                                      icon: Crown,           category: "network",    tier: "diamond",  target: 500,    progress: gen1                                              },
    { id: "prod-sponsor",   title: "Productive Sponsor",description: "Have 3 active Gen 1 referrals.",                          icon: Sprout,          category: "network",    tier: "bronze",   target: 3,      progress: gen1                                              },
    { id: "team-builder",   title: "Team Builder",      description: "Have 10 active referrals.",                               icon: Users,           category: "network",    tier: "silver",   target: 10,     progress: gen1                                              },
    { id: "empire-builder", title: "Empire Builder",    description: "Build a network of 100+ across 3 generations.",           icon: Crown,           category: "network",    tier: "gold",     target: 100,    progress: totalReferrals                                    },
    { id: "kingdom",        title: "Kingdom",            description: "250+ farmers in your downline network.",                  icon: Crown,           category: "network",    tier: "diamond",  target: 250,    progress: totalReferrals                                    },

    // Time-windowed premium referral achievements (rolling 90-day bracket)
    // Progress = best count achieved in any single 90-day window.
    // Once the best window count hits the target, the badge unlocks permanently.
    { id: "prem-gen1-50",   title: "Premium Recruiter",  description: "Refer 50 Premium farmers within any 90-day period.",      icon: Crown,           category: "network",    tier: "platinum", target: 50,     progress: bestGen1Window,     unit: "premium Gen 1", reward: "Exclusive badge" },
    { id: "prem-gen1-100",  title: "Premium Commander",  description: "Refer 100 Premium farmers within any 90-day period.",     icon: Trophy,          category: "network",    tier: "diamond",  target: 100,    progress: bestGen1Window,     unit: "premium Gen 1", reward: "Commander badge" },
    { id: "prem-net-500",   title: "Premium Empire",     description: "Build a team of 500 Premium members across 3 generations within any 90-day period.", icon: Crown, category: "network", tier: "diamond", target: 500, progress: bestNetworkWindow, unit: "premium members", reward: "Empire badge" },
    { id: "prem-net-1000",  title: "Premium Dynasty",    description: "Build a team of 1,000 Premium members across 3 generations within any 90-day period.", icon: Trophy, category: "network", tier: "diamond", target: 1000, progress: bestNetworkWindow, unit: "premium members", reward: "Dynasty badge" },

    // ── 7. Trading (P2P, Escrow, Coupons) ────────────────────────────────
    { id: "first-transfer", title: "First Transfer",    description: "Send your first P2P transfer.",                           icon: ArrowRightLeft,  category: "trading",    tier: "bronze",   target: 1,      progress: p2pSentCount                                      },
    { id: "comm-helper",    title: "Community Helper",  description: "Complete 10 P2P transfers.",                              icon: ArrowRightLeft,  category: "trading",    tier: "silver",   target: 10,     progress: p2pTotalCount                                     },
    { id: "merch-farmer",   title: "Merchant Farmer",   description: "Complete 100 P2P transfers.",                             icon: ArrowRightLeft,  category: "trading",    tier: "gold",     target: 100,    progress: p2pTotalCount                                     },
    { id: "first-escrow",   title: "First Secure Trade",description: "Complete one escrow transaction.",                        icon: ShieldCheck,     category: "trading",    tier: "bronze",   target: 1,      progress: escrowDone                                        },
    { id: "trusted-trader", title: "Trusted Trader",    description: "Complete 25 escrow trades.",                              icon: ShieldCheck,     category: "trading",    tier: "gold",     target: 25,     progress: escrowDone                                        },
    { id: "mkt-veteran",    title: "Marketplace Veteran",description: "Complete 100 escrow trades.",                           icon: Trophy,          category: "trading",    tier: "platinum", target: 100,    progress: escrowDone                                        },
    { id: "coupon-user",    title: "Coupon User",       description: "Redeem your first coupon.",                               icon: Ticket,          category: "trading",    tier: "bronze",   target: 1,      progress: couponCount                                       },
    { id: "coupon-coll",    title: "Coupon Collector",  description: "Redeem 10 coupons.",                                      icon: Ticket,          category: "trading",    tier: "silver",   target: 10,     progress: couponCount                                       },
    { id: "coupon-champ",   title: "Coupon Champion",   description: "Redeem 50 coupons.",                                      icon: Ticket,          category: "trading",    tier: "gold",     target: 50,     progress: couponCount                                       },

    // ── 8. Loyalty ────────────────────────────────────────────────────────
    { id: "loyalty-30",     title: "Bronze Farmer",     description: "Member for 30 days.",                                     icon: Clock,           category: "loyalty",    tier: "bronze",   target: 30,     progress: accountAgeDays,     unit: "days"                  },
    { id: "loyalty-90",     title: "Silver Farmer",     description: "Member for 90 days.",                                     icon: Clock,           category: "loyalty",    tier: "silver",   target: 90,     progress: accountAgeDays,     unit: "days"                  },
    { id: "loyalty-180",    title: "Gold Farmer",       description: "Member for 180 days.",                                    icon: Clock,           category: "loyalty",    tier: "gold",     target: 180,    progress: accountAgeDays,     unit: "days"                  },
    { id: "loyalty-365",    title: "Diamond Farmer",    description: "Member for 365 days.",                                    icon: Clock,           category: "loyalty",    tier: "platinum", target: 365,    progress: accountAgeDays,     unit: "days"                  },
    { id: "loyalty-1000",   title: "Lifetime Farmer",   description: "Member for 1,000 days.",                                  icon: Trophy,          category: "loyalty",    tier: "diamond",  target: 1000,   progress: accountAgeDays,     unit: "days"                  },
    { id: "prem-90",        title: "Elite Farmer",      description: "Remain Premium for 90 consecutive days.",                 icon: Star,            category: "loyalty",    tier: "gold",     target: 90,     progress: premiumDays,        unit: "days"                  },
    { id: "prem-365",       title: "Veteran Premium Farmer", description: "Remain Premium for 365 consecutive days.",           icon: Crown,           category: "loyalty",    tier: "diamond",  target: 365,    progress: premiumDays,        unit: "days"                  },

    // ── 9. Engagement / Boosters ──────────────────────────────────────────
    { id: "first-booster",  title: "Powered Up",        description: "Use your first farming booster.",                         icon: Zap,             category: "engagement", tier: "bronze",   target: 1,      progress: boosterCount                                      },
    { id: "power-farmer",   title: "Power Farmer",      description: "Use 10 farming boosters.",                                icon: Zap,             category: "engagement", tier: "silver",   target: 10,     progress: boosterCount                                      },
    { id: "supercharged",   title: "Supercharged Farmer",description: "Use 100 farming boosters.",                              icon: Zap,             category: "engagement", tier: "gold",     target: 100,    progress: boosterCount                                      },
    { id: "pv-collector",   title: "PV Collector",      description: "Earn 100 Personal Volume points.",                        icon: Star,            category: "engagement", tier: "bronze",   target: 100,    progress: totalPv,            unit: "PV"                    },
    { id: "pv-champion",    title: "PV Champion",       description: "Earn 1,000 Personal Volume points.",                      icon: Flame,           category: "engagement", tier: "gold",     target: 1000,   progress: totalPv,            unit: "PV"                    },
    { id: "acct-value-s",   title: "Small Farm",        description: "Hold 200 Seeds in your farming wallet.",                  icon: Sprout,          category: "engagement", tier: "bronze",   target: 200,    progress: farmingSeed,        unit: "Seed"                  },
    { id: "acct-value-l",   title: "Large Farm",        description: "Hold 1,000 Seeds in your farming wallet.",                icon: Sprout,          category: "engagement", tier: "silver",   target: 1000,   progress: farmingSeed,        unit: "Seed"                  },
    { id: "acct-value-m",   title: "Mega Farm",         description: "Hold 5,000 Seeds in your farming wallet.",                icon: Sprout,          category: "engagement", tier: "gold",     target: 5000,   progress: farmingSeed,        unit: "Seed"                  },
    { id: "acct-value-k",   title: "Kingdom Farm",      description: "Hold 20,000 Seeds in your farming wallet.",               icon: Crown,           category: "engagement", tier: "diamond",  target: 20000,  progress: farmingSeed,        unit: "Seed"                  },

    // ── 10. Hidden Achievements ───────────────────────────────────────────
    { id: "midnight",       title: "Midnight Farmer",   description: "Farm after midnight 10 times.",                           icon: EyeOff,          category: "legendary",  tier: "gold",     target: 10,     progress: midnightCount,      hidden: true                  },
    { id: "early-bird",     title: "Early Bird",        description: "Farm before 6 AM on 20 occasions.",                       icon: EyeOff,          category: "legendary",  tier: "gold",     target: 20,     progress: earlyBirdCount,     hidden: true                  },

    // ── 11. Legendary ─────────────────────────────────────────────────────
    { id: "vfarm-legend",   title: "VFarm Legend",      description: "Member for 5 years — a true VFarmers pioneer.",           icon: Trophy,          category: "legendary",  tier: "diamond",  target: 1825,   progress: accountAgeDays,     unit: "days"                  },
  ];

  const unlocked = achievements.filter((a) => a.progress >= a.target).length;
  const totalPoints = achievements
    .filter((a) => a.progress >= a.target)
    .reduce((s, a) => s + tierPoints(a.tier), 0);
  const level = Math.max(1, Math.floor(totalPoints / 100) + 1);
  const nextLevelPoints = level * 100;
  const prevLevelPoints = (level - 1) * 100;
  const levelProgressPct = Math.min(100, Math.round(
    ((totalPoints - prevLevelPoints) / (nextLevelPoints - prevLevelPoints)) * 100
  ));

  const [filter, setFilter] = useState<"all" | Category>("all");

  // Hidden achievements: only show in the "legendary" filter or once unlocked
  const visible = achievements.filter((a) => {
    if (a.hidden && a.progress < a.target) return filter === "legendary";
    return filter === "all" || a.category === filter;
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Hero */}
      <div className="glass relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Trophy className="h-3.5 w-3.5" />
              Achievements
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Keep growing, <span className="text-gradient-primary">{displayName}</span>
            </h1>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Every cycle, referral, and milestone you hit unlocks a badge. Chase the next one and level up your profile.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full border border-border/60 bg-card/40 px-3 py-1">
                <span className="text-muted-foreground">Unlocked </span>
                <span className="font-semibold text-foreground">{unlocked}</span>
                <span className="text-muted-foreground"> / {achievements.filter((a) => !a.hidden || a.progress >= a.target).length}</span>
              </span>
              <span className="rounded-full border border-border/60 bg-card/40 px-3 py-1">
                <span className="text-muted-foreground">Points </span>
                <span className="font-semibold text-foreground">{totalPoints}</span>
              </span>
            </div>
          </div>
          {/* Level ring */}
          <div className="flex items-center gap-4">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                <circle cx="50" cy="50" r="44" strokeWidth="8" className="fill-none stroke-muted" />
                <circle cx="50" cy="50" r="44" strokeWidth="8" strokeLinecap="round"
                  className="fill-none stroke-primary transition-all duration-700"
                  strokeDasharray={`${(levelProgressPct / 100) * 276.46} 276.46`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Level</span>
                <span className="text-2xl font-bold">{level}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{nextLevelPoints - totalPoints} pts</div>
              <div>to Level {level + 1}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} icon={Target}
          label={`All (${achievements.filter((a) => !a.hidden || a.progress >= a.target).length})`} />
        {(Object.keys(CATEGORY_META) as Category[]).map((k) => {
          const meta = CATEGORY_META[k];
          const count = achievements.filter((a) => a.category === k && (!a.hidden || a.progress >= a.target)).length;
          if (count === 0) return null;
          return <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} icon={meta.icon} label={`${meta.label} (${count})`} />;
        })}
      </div>

      {/* Grid */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((a) => (
          <AchievementCard key={a.id} a={a} />
        ))}
      </div>

      {/* CTA footer */}
      <div className="mt-8 glass rounded-3xl p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-primary" />
        <h3 className="mt-2 text-lg font-semibold">Ready for the next badge?</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Start a fresh farming cycle or invite a friend to accelerate your progress.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link to="/farm" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]">
            <Sprout className="h-4 w-4" /> Start a cycle
          </Link>
          <Link to="/affiliate" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-card">
            <Users className="h-4 w-4" /> Invite a friend
          </Link>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>; label: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
      }`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function AchievementCard({ a }: { a: Achievement }) {
  const done = a.progress >= a.target;
  const pct = Math.min(100, Math.round((a.progress / a.target) * 100));
  const style = TIER_STYLES[a.tier];
  const Icon = a.icon;
  const catMeta = CATEGORY_META[a.category];
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  // Hidden and not unlocked: show mystery card
  if (a.hidden && !done) {
    return (
      <div className="glass relative overflow-hidden rounded-2xl p-5 opacity-60">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-2 ring-border bg-muted/20 text-muted-foreground">
            <EyeOff className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Hidden Achievement</h3>
            <p className="mt-0.5 text-xs text-muted-foreground/70">Unlock this by discovering it naturally…</p>
            <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <catMeta.icon className={`h-3 w-3 ${catMeta.color}`} />
              {catMeta.label}
            </div>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-0 bg-primary/30" />
        </div>
      </div>
    );
  }

  return (
    <div className={`glass group relative overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-0.5 ${done ? style.glow : ""}`}>
      {done && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
          <CheckCircle2 className="h-3 w-3" /> Unlocked
        </div>
      )}
      {a.hidden && done && (
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-fuchsia-400/15 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300">
          <Sparkles className="h-3 w-3" /> Secret
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-2 ${style.ring} ${style.bg} ${done ? style.text : "text-muted-foreground grayscale"}`}>
          <Icon className="h-6 w-6" />
          {!done && (
            <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-1 ring-1 ring-border">
              <Lock className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`truncate text-sm font-semibold ${done ? "" : "text-foreground/90"}`}>{a.title}</h3>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${style.bg} ${style.text}`}>
              {style.label}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <catMeta.icon className={`h-3 w-3 ${catMeta.color}`} />
            {catMeta.label}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{fmt(Math.min(a.progress, a.target))} / {fmt(a.target)} {a.unit ?? ""}</span>
          <span className={done ? style.text : ""}>{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full transition-all duration-700 ${done ? "bg-gradient-to-r from-primary to-accent" : "bg-primary/50"}`}
            style={{ width: `${pct}%` }} />
        </div>
        {a.reward && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Reward: <span className="text-foreground/80">{a.reward}</span>
          </div>
        )}
      </div>
    </div>
  );
}
