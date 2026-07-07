import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { getStreaks } from "@/lib/affiliate.functions";
import { getPremiumStatus } from "@/lib/premium.functions";
import { listMyTransfers } from "@/lib/p2p.functions";
import { listMyEscrows } from "@/lib/escrow.functions";
import { listMyRedemptions } from "@/lib/coupons.functions";
import {
  getAchievementRewards,
  claimAchievementReward,
  type AchievementRewardWithClaim,
} from "@/lib/achievement-rewards.functions";

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
  currentProgress?: number;
  unit?: string;
  reward?: string;           // kept for display fallback
  rewardConfig?: AchievementRewardWithClaim; // live DB config
  hidden?: boolean;
};

type Category = "welcome" | "farming" | "deposits" | "earnings" | "network" | "trading" | "loyalty" | "engagement" | "legendary" | "streaks";

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
  streaks:    { label: "Streaks",    icon: Flame,            color: "text-orange-400"     },
  engagement: { label: "Engagement", icon: Sparkles,         color: "text-fuchsia-400"    },
  legendary:  { label: "Legendary",  icon: Trophy,           color: "text-yellow-300"     },
};

function tierPoints(t: Tier): number {
  return { bronze: 10, silver: 25, gold: 50, platinum: 100, diamond: 200 }[t];
}

// ── buildAchievements — pure function, no hooks ────────────────────────────
// Separating the list from the component keeps AchievementsPage readable and
// makes it easy to unit-test the achievement logic in isolation.

type BuildParams = {
  startedCount: number; reapedCount: number;
  totalDeposited: number; totalWithdrawn: number; totalSeedEarned: number;
  primaryUsdt: number; farmingSeed: number; totalPv: number;
  gen1: number; totalReferrals: number; totalEarnedUsdt: number;
  isPremium: boolean; p2pSentCount: number; p2pTotalCount: number;
  escrowDone: number; couponCount: number; boosterCount: number;
  accountAgeDays: number; premiumDays: number;
  bestGen1Window: number; bestNetworkWindow: number;
  farmingStreak: number; referralStreak: number;
  curFarmStreak: number; curRefStreak: number;
  midnightCount: number; earlyBirdCount: number;
  isProfileComplete: boolean;
  rewardMap: Map<string, { pv_reward: number; usdt_reward: number; claimed: boolean; enabled: boolean }>;
};

function buildAchievements(p: BuildParams): Achievement[] {
  const enrich = (id: string, base: Omit<Achievement, "rewardConfig">): Achievement => ({
    ...base,
    rewardConfig: p.rewardMap.get(id),
  });

  return [
    // ── 1. Welcome ──────────────────────────────────────────────────────
    enrich("acc-created",    { id:"acc-created",    title:"First Seed",             description:"Create your VFarmers account.",                                           icon:Sprout,         category:"welcome",   tier:"bronze",  target:1,     progress:1,                              reward:"Welcome badge" }),
    enrich("profile-setup",  { id:"profile-setup",  title:"First Farmer",           description:"Complete your profile: display name, username, avatar, and country.",     icon:CheckCircle2,   category:"welcome",   tier:"silver",  target:1,     progress:p.isProfileComplete ? 1 : 0    }),
    enrich("prem-upgrade",   { id:"prem-upgrade",   title:"Premium Farmer",         description:"Upgrade to a Premium membership tier.",                                    icon:Crown,          category:"welcome",   tier:"platinum",target:1,     progress:p.isPremium ? 1 : 0,            reward:"Premium badge" }),
    // ── 2. Farming ──────────────────────────────────────────────────────
    enrich("first-harvest",  { id:"first-harvest",  title:"First Harvest",          description:"Complete your first farming cycle.",                                       icon:Sprout,         category:"farming",   tier:"bronze",  target:1,     progress:p.reapedCount                  }),
    enrich("consistent",     { id:"consistent",     title:"Consistent Farmer",      description:"Reap 10 farming cycles.",                                                  icon:Sprout,         category:"farming",   tier:"silver",  target:10,    progress:p.reapedCount                  }),
    enrich("master-farmer",  { id:"master-farmer",  title:"Master Farmer",          description:"Reap 50 farming cycles.",                                                  icon:Sprout,         category:"farming",   tier:"gold",    target:50,    progress:p.reapedCount                  }),
    enrich("farm-lord",      { id:"farm-lord",      title:"Farm Lord",              description:"Reap 100 farming cycles.",                                                 icon:Trophy,         category:"farming",   tier:"platinum",target:100,   progress:p.reapedCount                  }),
    enrich("farm-legend",    { id:"farm-legend",    title:"Legendary Farmer",       description:"Reap 500 farming cycles — legendary status.",                              icon:Trophy,         category:"farming",   tier:"diamond", target:500,   progress:p.reapedCount                  }),
    // ── 3. Deposits ─────────────────────────────────────────────────────
    enrich("first-deposit",  { id:"first-deposit",  title:"First Deposit",          description:"Make your first deposit of any amount.",                                   icon:ArrowDownToLine,category:"deposits",  tier:"bronze",  target:1,     progress:p.totalDeposited>0?1:0         }),
    enrich("growing-inv",    { id:"growing-inv",    title:"Growing Investor",       description:"Reach 100 USDT in total deposits.",                                        icon:ArrowDownToLine,category:"deposits",  tier:"silver",  target:100,   progress:p.totalDeposited,               unit:"USDT" }),
    enrich("estab-farmer",   { id:"estab-farmer",   title:"Established Farmer",     description:"Reach 500 USDT in total deposits.",                                        icon:ArrowDownToLine,category:"deposits",  tier:"gold",    target:500,   progress:p.totalDeposited,               unit:"USDT" }),
    enrich("farm-owner",     { id:"farm-owner",     title:"Farm Owner",             description:"Reach 1,000 USDT in total deposits.",                                      icon:Wallet,         category:"deposits",  tier:"platinum",target:1000,  progress:p.totalDeposited,               unit:"USDT" }),
    enrich("agr-tycoon",     { id:"agr-tycoon",     title:"Agricultural Tycoon",    description:"Reach 10,000 USDT in total deposits.",                                     icon:Crown,          category:"deposits",  tier:"diamond", target:10000, progress:p.totalDeposited,               unit:"USDT" }),
    // ── 4. Withdrawals ──────────────────────────────────────────────────
    enrich("first-withdraw", { id:"first-withdraw", title:"First Withdrawal",       description:"Complete your first withdrawal.",                                          icon:ArrowUpFromLine,category:"deposits",  tier:"bronze",  target:1,     progress:p.totalWithdrawn>0?1:0         }),
    enrich("fin-freedom",    { id:"fin-freedom",    title:"Financial Freedom",      description:"Withdraw a total of 500 USDT.",                                            icon:ArrowUpFromLine,category:"deposits",  tier:"gold",    target:500,   progress:p.totalWithdrawn,               unit:"USDT" }),
    enrich("cash-flow",      { id:"cash-flow",      title:"Cash Flow Master",       description:"Withdraw a total of 5,000 USDT.",                                          icon:ArrowUpFromLine,category:"deposits",  tier:"diamond", target:5000,  progress:p.totalWithdrawn,               unit:"USDT" }),
    // ── 5. Earnings ─────────────────────────────────────────────────────
    enrich("first-profit",   { id:"first-profit",   title:"First Profit",           description:"Earn 1 Seed in farming rewards.",                                          icon:Star,           category:"earnings",  tier:"bronze",  target:1,     progress:p.totalSeedEarned,              unit:"Seed" }),
    enrich("seed-collector", { id:"seed-collector", title:"Seed Collector",         description:"Earn 100 Seeds in farming rewards.",                                       icon:Star,           category:"earnings",  tier:"silver",  target:100,   progress:p.totalSeedEarned,              unit:"Seed" }),
    enrich("seed-millionaire",{id:"seed-millionaire",title:"Seed Millionaire",      description:"Earn 1,000 Seeds in farming rewards.",                                     icon:Star,           category:"earnings",  tier:"gold",    target:1000,  progress:p.totalSeedEarned,              unit:"Seed" }),
    enrich("seed-legend",    { id:"seed-legend",    title:"Seed Legend",            description:"Earn 10,000 Seeds in farming rewards.",                                    icon:Trophy,         category:"earnings",  tier:"diamond", target:10000, progress:p.totalSeedEarned,              unit:"Seed" }),
    enrich("ref-income",     { id:"ref-income",     title:"First Referral Income",  description:"Earn your first referral commission.",                                     icon:Users,          category:"earnings",  tier:"bronze",  target:1,     progress:p.totalEarnedUsdt>0?1:0        }),
    enrich("ref-expert",     { id:"ref-expert",     title:"Referral Expert",        description:"Earn 100 USDT from referral commissions.",                                 icon:Users,          category:"earnings",  tier:"gold",    target:100,   progress:p.totalEarnedUsdt,              unit:"USDT" }),
    enrich("ref-master",     { id:"ref-master",     title:"Referral Master",        description:"Earn 1,000 USDT from referral commissions.",                               icon:Crown,          category:"earnings",  tier:"diamond", target:1000,  progress:p.totalEarnedUsdt,              unit:"USDT" }),
    // ── 6. Network ──────────────────────────────────────────────────────
    enrich("first-referral", { id:"first-referral", title:"First Referral",         description:"Invite your first farmer.",                                                icon:Users,          category:"network",   tier:"bronze",  target:1,     progress:p.gen1                         }),
    enrich("comm-builder",   { id:"comm-builder",   title:"Community Builder",      description:"Refer 5 farmers.",                                                         icon:Users,          category:"network",   tier:"silver",  target:5,     progress:p.gen1                         }),
    enrich("team-leader",    { id:"team-leader",    title:"Team Leader",            description:"Grow your Gen 1 downline to 20 farmers.",                                  icon:Users,          category:"network",   tier:"gold",    target:20,    progress:p.gen1                         }),
    enrich("net-champ",      { id:"net-champ",      title:"Network Champion",       description:"Refer 100 farmers.",                                                       icon:Trophy,         category:"network",   tier:"platinum",target:100,   progress:p.gen1                         }),
    enrich("ref-king",       { id:"ref-king",       title:"Referral King",          description:"Refer 500 farmers.",                                                       icon:Crown,          category:"network",   tier:"diamond", target:500,   progress:p.gen1                         }),
    enrich("prod-sponsor",   { id:"prod-sponsor",   title:"Productive Sponsor",     description:"Have 3 active Gen 1 referrals.",                                           icon:Sprout,         category:"network",   tier:"bronze",  target:3,     progress:p.gen1                         }),
    enrich("team-builder",   { id:"team-builder",   title:"Team Builder",           description:"Have 10 active referrals.",                                                icon:Users,          category:"network",   tier:"silver",  target:10,    progress:p.gen1                         }),
    enrich("empire-builder", { id:"empire-builder", title:"Empire Builder",         description:"Build a network of 100+ across 3 generations.",                            icon:Crown,          category:"network",   tier:"gold",    target:100,   progress:p.totalReferrals               }),
    enrich("kingdom",        { id:"kingdom",        title:"Kingdom",                description:"250+ farmers in your downline network.",                                   icon:Crown,          category:"network",   tier:"diamond", target:250,   progress:p.totalReferrals               }),
    enrich("prem-gen1-50",   { id:"prem-gen1-50",   title:"Premium Recruiter",      description:"Refer 50 Premium farmers within any 90-day period.",                       icon:Crown,          category:"network",   tier:"platinum",target:50,    progress:p.bestGen1Window,               unit:"premium Gen 1" }),
    enrich("prem-gen1-100",  { id:"prem-gen1-100",  title:"Premium Commander",      description:"Refer 100 Premium farmers within any 90-day period.",                      icon:Trophy,         category:"network",   tier:"diamond", target:100,   progress:p.bestGen1Window,               unit:"premium Gen 1" }),
    enrich("prem-net-500",   { id:"prem-net-500",   title:"Premium Empire",         description:"500 Premium members in your network within any 90-day period.",            icon:Crown,          category:"network",   tier:"diamond", target:500,   progress:p.bestNetworkWindow,            unit:"premium members" }),
    enrich("prem-net-1000",  { id:"prem-net-1000",  title:"Premium Dynasty",        description:"1,000 Premium members in your network within any 90-day period.",          icon:Trophy,         category:"network",   tier:"diamond", target:1000,  progress:p.bestNetworkWindow,            unit:"premium members" }),
    // ── 7. Trading ──────────────────────────────────────────────────────
    enrich("first-transfer", { id:"first-transfer", title:"First Transfer",         description:"Send your first P2P transfer.",                                            icon:ArrowRightLeft, category:"trading",   tier:"bronze",  target:1,     progress:p.p2pSentCount                 }),
    enrich("comm-helper",    { id:"comm-helper",    title:"Community Helper",       description:"Complete 10 P2P transfers.",                                               icon:ArrowRightLeft, category:"trading",   tier:"silver",  target:10,    progress:p.p2pTotalCount                }),
    enrich("merch-farmer",   { id:"merch-farmer",   title:"Merchant Farmer",        description:"Complete 100 P2P transfers.",                                              icon:ArrowRightLeft, category:"trading",   tier:"gold",    target:100,   progress:p.p2pTotalCount                }),
    enrich("first-escrow",   { id:"first-escrow",   title:"First Secure Trade",     description:"Complete one escrow transaction.",                                         icon:ShieldCheck,    category:"trading",   tier:"bronze",  target:1,     progress:p.escrowDone                   }),
    enrich("trusted-trader", { id:"trusted-trader", title:"Trusted Trader",         description:"Complete 25 escrow trades.",                                               icon:ShieldCheck,    category:"trading",   tier:"gold",    target:25,    progress:p.escrowDone                   }),
    enrich("mkt-veteran",    { id:"mkt-veteran",    title:"Marketplace Veteran",    description:"Complete 100 escrow trades.",                                              icon:Trophy,         category:"trading",   tier:"platinum",target:100,   progress:p.escrowDone                   }),
    enrich("coupon-user",    { id:"coupon-user",    title:"Coupon User",            description:"Redeem your first coupon.",                                                icon:Ticket,         category:"trading",   tier:"bronze",  target:1,     progress:p.couponCount                  }),
    enrich("coupon-coll",    { id:"coupon-coll",    title:"Coupon Collector",       description:"Redeem 10 coupons.",                                                       icon:Ticket,         category:"trading",   tier:"silver",  target:10,    progress:p.couponCount                  }),
    enrich("coupon-champ",   { id:"coupon-champ",   title:"Coupon Champion",        description:"Redeem 50 coupons.",                                                       icon:Ticket,         category:"trading",   tier:"gold",    target:50,    progress:p.couponCount                  }),
    // ── 8. Streaks ──────────────────────────────────────────────────────
    enrich("farm-streak-3",  { id:"farm-streak-3",  title:"3-Day Streak",           description:"Farm on 3 consecutive days.",                                              icon:Flame,          category:"streaks",   tier:"bronze",  target:3,     progress:p.farmingStreak,  currentProgress:p.curFarmStreak, unit:"days" }),
    enrich("farm-streak-7",  { id:"farm-streak-7",  title:"7-Day Streak",           description:"Farm on 7 consecutive days without a break.",                              icon:Flame,          category:"streaks",   tier:"silver",  target:7,     progress:p.farmingStreak,  currentProgress:p.curFarmStreak, unit:"days" }),
    enrich("farm-streak-30", { id:"farm-streak-30", title:"30-Day Streak",          description:"Farm every day for a full month.",                                         icon:Flame,          category:"streaks",   tier:"gold",    target:30,    progress:p.farmingStreak,  currentProgress:p.curFarmStreak, unit:"days" }),
    enrich("farm-streak-100",{ id:"farm-streak-100",title:"100-Day Streak",         description:"Farm consistently for 100 days straight.",                                 icon:Flame,          category:"streaks",   tier:"platinum",target:100,   progress:p.farmingStreak,  currentProgress:p.curFarmStreak, unit:"days" }),
    enrich("farm-streak-365",{ id:"farm-streak-365",title:"Never Missed a Day",     description:"Farm every single day for 365 consecutive days.",                          icon:Flame,          category:"streaks",   tier:"diamond", target:365,   progress:p.farmingStreak,  currentProgress:p.curFarmStreak, unit:"days" }),
    enrich("ref-streak-3",   { id:"ref-streak-3",   title:"3-Day Network Streak",   description:"Earn a referral commission on 3 consecutive days.",                        icon:Users,          category:"streaks",   tier:"bronze",  target:3,     progress:p.referralStreak, currentProgress:p.curRefStreak,  unit:"days" }),
    enrich("ref-streak-7",   { id:"ref-streak-7",   title:"7-Day Network Streak",   description:"Earn a referral commission every day for 7 days.",                         icon:Users,          category:"streaks",   tier:"silver",  target:7,     progress:p.referralStreak, currentProgress:p.curRefStreak,  unit:"days" }),
    enrich("ref-streak-30",  { id:"ref-streak-30",  title:"30-Day Network Streak",  description:"Your team is active — commissions every day for 30 days.",                 icon:Users,          category:"streaks",   tier:"gold",    target:30,    progress:p.referralStreak, currentProgress:p.curRefStreak,  unit:"days" }),
    enrich("ref-streak-100", { id:"ref-streak-100", title:"Network Machine",        description:"100 consecutive days of referral commission income.",                      icon:Crown,          category:"streaks",   tier:"platinum",target:100,   progress:p.referralStreak, currentProgress:p.curRefStreak,  unit:"days" }),
    enrich("ref-streak-365", { id:"ref-streak-365", title:"Unstoppable Network",    description:"365 straight days of commission income — your team never sleeps.",         icon:Trophy,         category:"streaks",   tier:"diamond", target:365,   progress:p.referralStreak, currentProgress:p.curRefStreak,  unit:"days" }),
    // ── 9. Loyalty ──────────────────────────────────────────────────────
    enrich("loyalty-30",     { id:"loyalty-30",     title:"Bronze Farmer",          description:"Member for 30 days.",                                                     icon:Clock,          category:"loyalty",   tier:"bronze",  target:30,    progress:p.accountAgeDays,               unit:"days" }),
    enrich("loyalty-90",     { id:"loyalty-90",     title:"Silver Farmer",          description:"Member for 90 days.",                                                     icon:Clock,          category:"loyalty",   tier:"silver",  target:90,    progress:p.accountAgeDays,               unit:"days" }),
    enrich("loyalty-180",    { id:"loyalty-180",    title:"Gold Farmer",            description:"Member for 180 days.",                                                    icon:Clock,          category:"loyalty",   tier:"gold",    target:180,   progress:p.accountAgeDays,               unit:"days" }),
    enrich("loyalty-365",    { id:"loyalty-365",    title:"Diamond Farmer",         description:"Member for 365 days.",                                                    icon:Clock,          category:"loyalty",   tier:"platinum",target:365,   progress:p.accountAgeDays,               unit:"days" }),
    enrich("loyalty-1000",   { id:"loyalty-1000",   title:"Lifetime Farmer",        description:"Member for 1,000 days.",                                                  icon:Trophy,         category:"loyalty",   tier:"diamond", target:1000,  progress:p.accountAgeDays,               unit:"days" }),
    enrich("prem-90",        { id:"prem-90",        title:"Elite Farmer",           description:"Remain Premium for 90 consecutive days.",                                 icon:Star,           category:"loyalty",   tier:"gold",    target:90,    progress:p.premiumDays,                  unit:"days" }),
    enrich("prem-365",       { id:"prem-365",       title:"Veteran Premium Farmer", description:"Remain Premium for 365 consecutive days.",                                icon:Crown,          category:"loyalty",   tier:"diamond", target:365,   progress:p.premiumDays,                  unit:"days" }),
    // ── 10. Engagement ──────────────────────────────────────────────────
    enrich("first-booster",  { id:"first-booster",  title:"Powered Up",             description:"Use your first farming booster.",                                          icon:Zap,            category:"engagement",tier:"bronze",  target:1,     progress:p.boosterCount                 }),
    enrich("power-farmer",   { id:"power-farmer",   title:"Power Farmer",           description:"Use 10 farming boosters.",                                                 icon:Zap,            category:"engagement",tier:"silver",  target:10,    progress:p.boosterCount                 }),
    enrich("supercharged",   { id:"supercharged",   title:"Supercharged Farmer",    description:"Use 100 farming boosters.",                                                icon:Zap,            category:"engagement",tier:"gold",    target:100,   progress:p.boosterCount                 }),
    enrich("pv-collector",   { id:"pv-collector",   title:"PV Collector",           description:"Earn 100 Personal Volume points.",                                         icon:Star,           category:"engagement",tier:"bronze",  target:100,   progress:p.totalPv,                      unit:"PV" }),
    enrich("pv-champion",    { id:"pv-champion",    title:"PV Champion",            description:"Earn 1,000 Personal Volume points.",                                       icon:Flame,          category:"engagement",tier:"gold",    target:1000,  progress:p.totalPv,                      unit:"PV" }),
    enrich("acct-value-s",   { id:"acct-value-s",   title:"Small Farm",             description:"Hold 200 Seeds in your farming wallet.",                                   icon:Sprout,         category:"engagement",tier:"bronze",  target:200,   progress:p.farmingSeed,                  unit:"Seed" }),
    enrich("acct-value-l",   { id:"acct-value-l",   title:"Large Farm",             description:"Hold 1,000 Seeds in your farming wallet.",                                 icon:Sprout,         category:"engagement",tier:"silver",  target:1000,  progress:p.farmingSeed,                  unit:"Seed" }),
    enrich("acct-value-m",   { id:"acct-value-m",   title:"Mega Farm",              description:"Hold 5,000 Seeds in your farming wallet.",                                 icon:Sprout,         category:"engagement",tier:"gold",    target:5000,  progress:p.farmingSeed,                  unit:"Seed" }),
    enrich("acct-value-k",   { id:"acct-value-k",   title:"Kingdom Farm",           description:"Hold 20,000 Seeds in your farming wallet.",                                icon:Crown,          category:"engagement",tier:"diamond", target:20000, progress:p.farmingSeed,                  unit:"Seed" }),
    // ── 11. Hidden / Legendary ──────────────────────────────────────────
    enrich("midnight",       { id:"midnight",       title:"Midnight Farmer",        description:"Farm after midnight 10 times.",                                            icon:EyeOff,         category:"legendary", tier:"gold",    target:10,    progress:p.midnightCount,  hidden:true    }),
    enrich("early-bird",     { id:"early-bird",     title:"Early Bird",             description:"Farm before 6 AM on 20 occasions.",                                        icon:EyeOff,         category:"legendary", tier:"gold",    target:20,    progress:p.earlyBirdCount, hidden:true    }),
    enrich("vfarm-legend",   { id:"vfarm-legend",   title:"VFarm Legend",           description:"Member for 5 years — a true VFarmers pioneer.",                            icon:Trophy,         category:"legendary", tier:"diamond", target:1825,  progress:p.accountAgeDays,               unit:"days" }),
  ];
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
  const fnStreaks   = useServerFn(getStreaks);
  const fnRewards   = useServerFn(getAchievementRewards);
  const fnClaim     = useServerFn(claimAchievementReward);
  const qc          = useQueryClient();

  const cyclesQ  = useQuery({ queryKey: ["ach-cycles"],  queryFn: () => fnCycles() });
  const pvQ      = useQuery({ queryKey: ["my-pv"],       queryFn: () => fnPv() });
  const affQ     = useQuery({ queryKey: ["ach-aff"],     queryFn: () => fnAff() });
  const premiumQ = useQuery({ queryKey: ["premium-status"], queryFn: () => fnPremium() });
  const p2pQ     = useQuery({ queryKey: ["ach-p2p"],     queryFn: () => fnP2P() });
  const escrowQ  = useQuery({ queryKey: ["ach-escrow"],  queryFn: () => fnEscrow() });
  const couponsQ = useQuery({ queryKey: ["ach-coupons"], queryFn: () => fnCoupons() });
  const premDlQ  = useQuery({ queryKey: ["ach-prem-dl"], queryFn: () => fnPremiumDl() });
  const streaksQ = useQuery({ queryKey: ["ach-streaks"],  queryFn: () => fnStreaks() });
  const rewardsQ = useQuery({ queryKey: ["ach-rewards"],  queryFn: () => fnRewards() });

  const claimMutation = useMutation({
    mutationFn: (achievementId: string) => fnClaim({ data: { achievementId } }),
    onSuccess: (_data, achievementId) => {
      toast.success("Reward claimed! Check your wallet and PV balance.");
      qc.invalidateQueries({ queryKey: ["ach-rewards"] });
      qc.invalidateQueries({ queryKey: ["my-pv"] });
      // Clear this card's claiming state
      setClaimingId(null);
    },
    onError: (err, achievementId) => {
      const msg = err instanceof Error ? err.message : "Failed to claim reward";
      toast.error(msg);
      setClaimingId(null);
    },
  });

  // Track which specific achievement is being claimed so only that button shows a spinner
  const [claimingId, setClaimingId] = useState<string | null>(null);

  function handleClaim(id: string) {
    setClaimingId(id);
    claimMutation.mutate(id);
  }

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

  // Streak counts
  const farmingStreak  = streaksQ.data?.farming.longest ?? 0;
  const referralStreak = streaksQ.data?.referral.longest ?? 0;
  const curFarmStreak  = streaksQ.data?.farming.current ?? 0;
  const curRefStreak   = streaksQ.data?.referral.current ?? 0;

  // Determine if midnight farmer / early bird from cycle start times
  const midnightCount = cycles.filter((c) => {
    const h = new Date(c.created_at as string).getHours();
    return h >= 0 && h < 4;
  }).length;
  const earlyBirdCount = cycles.filter((c) => {
    const h = new Date(c.created_at as string).getHours();
    return h >= 4 && h < 6;
  }).length;

  // Map achievement_id → reward config from DB
  const rewardMap = new Map(
    (rewardsQ.data ?? []).map((r) => [r.achievement_id, r])
  );

  // Enrich each achievement with its live reward config
  const achievements: Achievement[] = buildAchievements({
    startedCount, reapedCount, totalDeposited, totalWithdrawn, totalSeedEarned,
    primaryUsdt, farmingSeed, totalPv, gen1, totalReferrals, totalEarnedUsdt,
    isPremium, p2pSentCount, p2pTotalCount, escrowDone, couponCount,
    boosterCount, accountAgeDays, premiumDays, bestGen1Window, bestNetworkWindow,
    farmingStreak, referralStreak, curFarmStreak, curRefStreak,
    midnightCount, earlyBirdCount, isProfileComplete, rewardMap,
  });
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

  const [filter, setFilter] = useState<"all" | "unlocked" | Category>("all");
  const [visibleCount, setVisibleCount] = useState(12);

  // Reset pagination when filter changes
  const setFilterAndReset = (f: typeof filter) => {
    setFilter(f);
    setVisibleCount(12);
  };

  // Hidden achievements: only show in the "legendary" filter or once unlocked
  const filtered = achievements.filter((a) => {
    if (a.hidden && a.progress < a.target) return filter === "legendary";
    if (filter === "unlocked") return a.progress >= a.target;
    return filter === "all" || a.category === filter;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

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
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilterAndReset("all")}
          icon={Target}
          label={`All (${achievements.filter((a) => !a.hidden || a.progress >= a.target).length})`}
        />
        <FilterChip
          active={filter === "unlocked"}
          onClick={() => setFilterAndReset("unlocked")}
          icon={CheckCircle2}
          label={`Unlocked (${unlocked})`}
          highlight
        />
        {(Object.keys(CATEGORY_META) as Category[]).map((k) => {
          const meta = CATEGORY_META[k];
          const count = achievements.filter((a) => a.category === k && (!a.hidden || a.progress >= a.target)).length;
          if (count === 0) return null;
          return (
            <FilterChip
              key={k}
              active={filter === k}
              onClick={() => setFilterAndReset(k)}
              icon={meta.icon}
              label={`${meta.label} (${count})`}
            />
          );
        })}
      </div>

      {/* Results count */}
      <p className="mt-3 text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{Math.min(visibleCount, filtered.length)}</span> of{" "}
        <span className="font-medium text-foreground">{filtered.length}</span> achievements
      </p>

      {/* Grid */}
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((a) => (
          <AchievementCard
            key={a.id}
            a={a}
            onClaim={handleClaim}
            claiming={claimingId === a.id}
          />
        ))}
      </div>

      {/* Show more */}
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + 12)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-card"
          >
            Show more ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}

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

function FilterChip({ active, onClick, icon: Icon, label, highlight }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>; label: string;
  highlight?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? highlight
            ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-400"
            : "border-primary/50 bg-primary/15 text-primary"
          : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
      }`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function AchievementCard({ a, onClaim, claiming }: {
  a: Achievement;
  onClaim: (id: string) => void;
  claiming: boolean;
}) {
  const done = a.progress >= a.target;
  const pct = Math.min(100, Math.round((a.progress / a.target) * 100));
  const style = TIER_STYLES[a.tier];
  const Icon = a.icon;
  const catMeta = CATEGORY_META[a.category];
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const rc = a.rewardConfig;

  // Derive the reward label from DB config (fall back to static string)
  const rewardLabel = rc
    ? [
        rc.pv_reward > 0 ? `+${rc.pv_reward} PV` : "",
        rc.usdt_reward > 0 ? `+${rc.usdt_reward} USDT` : "",
      ].filter(Boolean).join(" · ") || "Badge"
    : (a.reward ?? "");

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
        {/* Current active streak — only shown for streak achievements */}
        {a.currentProgress !== undefined && !done && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-400">
            <Flame className="h-3 w-3" />
            Current streak: <span className="font-semibold">{a.currentProgress} {a.unit ?? ""}</span>
            {a.currentProgress > 0 && (
              <span className="text-muted-foreground ml-1">· Best: {fmt(a.progress)}</span>
            )}
          </div>
        )}
        {/* Reward display */}
        {rewardLabel && (
          <div className="mt-2 flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Reward: <span className="text-foreground/80">{rewardLabel}</span>
            </div>
            {/* Claim button — only when done, not yet claimed, reward exists */}
            {done && rc && !rc.claimed && rc.enabled && (rc.pv_reward > 0 || rc.usdt_reward > 0) && (
              <button
                type="button"
                onClick={() => onClaim(a.id)}
                disabled={claiming}
                className="shrink-0 rounded-lg bg-gradient-to-r from-primary to-accent px-2.5 py-1 text-[10px] font-semibold text-primary-foreground transition-transform hover:scale-[1.04] disabled:opacity-60"
              >
                {claiming ? "…" : "Claim"}
              </button>
            )}
            {done && rc?.claimed && (
              <span className="flex items-center gap-0.5 text-[10px] text-primary">
                <CheckCircle2 className="h-3 w-3" /> Claimed
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
