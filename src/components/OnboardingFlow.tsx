/**
 * OnboardingFlow — a multi-step modal shown once to new users after signup.
 *
 * Shown when:
 *   - localStorage flag "vf_onboarding_done" is not set
 *   - The user has just landed on the dashboard
 *
 * Steps:
 *   1. Welcome
 *   2. Deposit (top up your wallet)
 *   3. Farm (start a cycle)
 *   4. Affiliate (share your referral link)
 *   5. Community (join Telegram)
 *   6. Done
 *
 * Skippable at any step. Completion sets the localStorage flag.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight, X, Wallet, Sprout, Users, MessageCircle,
  CheckCircle2, ArrowDownToLine, Sparkles,
} from "lucide-react";

const STORAGE_KEY = "vf_onboarding_done";

export function hasSeenOnboarding(): boolean {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
}

export function markOnboardingDone() {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

interface Props {
  name: string;
  referralCode: string | null;
  telegramGroupUrl: string | null;
  telegramChannelUrl: string | null;
  onDone: () => void;
}

type StepId = "welcome" | "deposit" | "farm" | "affiliate" | "community" | "done";

interface Step {
  id: StepId;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  body: string;
  cta?: { label: string; to: string };
  skip: string;
}

export function OnboardingFlow({
  name,
  referralCode,
  telegramGroupUrl,
  telegramChannelUrl,
  onDone,
}: Props) {
  const steps: Step[] = [
    {
      id: "welcome",
      icon: Sparkles,
      iconColor: "text-primary bg-primary/15",
      title: `Welcome to VFarmers, ${name}! 🌱`,
      body: "You're now part of a growing community of Farmers. This quick tour will show you the key features so you can start earning right away.",
      skip: "Let's go →",
    },
    {
      id: "deposit",
      icon: ArrowDownToLine,
      iconColor: "text-emerald-400 bg-emerald-400/15",
      title: "Top up your wallet",
      body: "Deposit USDT to your Primary Wallet. Use IvoryPay for instant deposits or submit a manual transfer. Your Seeds are ready to farm once funded.",
      cta: { label: "Go to Deposit", to: "/deposit" },
      skip: "Next",
    },
    {
      id: "farm",
      icon: Sprout,
      iconColor: "text-primary bg-primary/15",
      title: "Start farming",
      body: "Lock your Seeds into a farming cycle and earn daily rewards. The longer you farm, the more you earn. Reap when cycles mature.",
      cta: { label: "Go to Farm", to: "/farm" },
      skip: "Next",
    },
    {
      id: "affiliate",
      icon: Users,
      iconColor: "text-cyan-400 bg-cyan-400/15",
      title: "Invite friends & earn more",
      body: `Share your referral link and earn commissions from every cycle your downline runs. Your unique code is ${referralCode ?? "in your profile"}.`,
      cta: { label: "Go to Affiliate", to: "/affiliate" },
      skip: "Next",
    },
    ...(telegramGroupUrl || telegramChannelUrl ? [{
      id: "community" as StepId,
      icon: MessageCircle,
      iconColor: "text-[#2CA5E0] bg-blue-400/15",
      title: "Join our community",
      body: "Stay updated, get support, and connect with thousands of Farmers on Telegram. The community is where tips, updates, and announcements live.",
      skip: "Next",
    }] : []),
    {
      id: "done",
      icon: CheckCircle2,
      iconColor: "text-primary bg-primary/15",
      title: "You're all set! 🎉",
      body: "Your farm is ready. Start with a deposit, plant your first cycle, and watch your Seeds grow. We're glad you're here.",
      skip: "Go to Dashboard",
    },
  ];

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const Icon = step.icon;

  function advance() {
    if (isLast || step.id === "done") {
      markOnboardingDone();
      onDone();
    } else {
      setStepIdx((i) => i + 1);
    }
  }

  function dismiss() {
    markOnboardingDone();
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding tour"
    >
      <div className="glass relative w-full max-w-md rounded-3xl p-6 shadow-elegant">
        {/* Dismiss */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close tour"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step indicator */}
        <div className="mb-5 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= stepIdx ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${step.iconColor}`}>
          <Icon className="h-7 w-7" />
        </div>

        {/* Content */}
        <h2 className="mt-4 text-center text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">{step.body}</p>

        {/* Telegram buttons on community step */}
        {step.id === "community" && (
          <div className="mt-4 flex flex-col gap-2">
            {telegramGroupUrl && (
              <a
                href={telegramGroupUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#2CA5E0]/30 bg-[#2CA5E0]/10 px-4 py-2.5 text-sm font-semibold text-[#2CA5E0] transition-transform hover:scale-[1.02]"
              >
                <MessageCircle className="h-4 w-4" />
                Join Telegram Group
              </a>
            )}
            {telegramChannelUrl && (
              <a
                href={telegramChannelUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#2CA5E0]/30 bg-[#2CA5E0]/10 px-4 py-2.5 text-sm font-semibold text-[#2CA5E0] transition-transform hover:scale-[1.02]"
              >
                <MessageCircle className="h-4 w-4" />
                Follow Telegram Channel
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2">
          {/* Primary action: CTA (navigates) or Next/Done (advances in-place) */}
          {step.cta ? (
            <>
              <Link
                to={step.cta.to}
                onClick={advance}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
              >
                {step.cta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {/* Secondary: advance without navigating */}
              <button
                type="button"
                onClick={advance}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {step.skip}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={advance}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              {isLast ? "Go to Dashboard" : step.skip}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </button>
          )}

          {/* Skip entire tour — only on non-last steps */}
          {!isLast && (
            <button
              type="button"
              onClick={dismiss}
              className="text-center text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Skip tour
            </button>
          )}
        </div>

        {/* Step counter */}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Step {stepIdx + 1} of {steps.length}
        </p>
      </div>
    </div>
  );
}
