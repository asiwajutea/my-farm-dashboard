/**
 * OnboardingFlow — slim 2-step welcome modal for brand-new users.
 *
 * Step 1: Welcome greeting
 * Step 2: Encourage profile setup (username + avatar)
 *
 * Shown once. Tracked in localStorage "vf_welcome_done".
 * Per-page contextual hints are handled separately by PageHint.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, UserCircle, ArrowRight, X } from "lucide-react";

const STORAGE_KEY = "vf_welcome_done";

export function hasSeenOnboarding(): boolean {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
}

export function markOnboardingDone() {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

interface Props {
  name: string;
  onDone: () => void;
}

type Step = 0 | 1;

export function OnboardingFlow({ name, onDone }: Props) {
  const [step, setStep] = useState<Step>(0);

  function finish() {
    markOnboardingDone();
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass relative w-full max-w-sm rounded-3xl p-7 shadow-elegant text-center">
        {/* Dismiss */}
        <button
          type="button"
          onClick={finish}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="mb-6 flex justify-center gap-2">
          {([0, 1] as Step[]).map((i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 0 ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight">
              Welcome, {name}! 🌱
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Your VFarmers account is ready. Deposit Seeds, start farming cycles, and grow your earnings every day.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-400">
              <UserCircle className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight">
              Complete your profile
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Set your username and avatar so other Farmers can find you for P2P transfers. It only takes a minute.
            </p>
            <Link
              to="/profile"
              onClick={finish}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              Set up profile
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={finish}
              className="mt-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              I'll do it later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
