/**
 * PremiumNagModal — "Did You Know?" marketing modal for standard members.
 *
 * Rules:
 * - Only shown to standard (non-premium) members.
 * - Auto-opens 1.8 s after mount unless dismissed within the last 8 hours.
 * - Dismissal timestamp is persisted in localStorage keyed by `storageKey`.
 * - Once the user upgrades (isStandard becomes false) it closes silently.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface NagBenefit {
  emoji: string;
  title: string;
  body: string;
}

export interface PremiumNagModalProps {
  /** Unique localStorage key — one per page, e.g. "nag-dashboard" */
  storageKey: string;
  /** Bold headline after the "Did You Know?" pill */
  headline: string;
  /** Softer sub-text below the headline */
  subheadline: string;
  /** 2–4 benefit bullets */
  benefits: NagBenefit[];
  /** CTA button label */
  ctaLabel?: string;
  /** Only render for standard members */
  isStandard: boolean;
}

// ── Cooldown helpers ───────────────────────────────────────────────────────

const COOLDOWN_MS = 8 * 60 * 60 * 1_000; // 8 hours

function shouldShow(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return true;
    return Date.now() - Number(raw) > COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markDismissed(key: string) {
  try { localStorage.setItem(key, String(Date.now())); } catch { /* ignore */ }
}

// ── Component ──────────────────────────────────────────────────────────────

export function PremiumNagModal({
  storageKey,
  headline,
  subheadline,
  benefits,
  ctaLabel = "Upgrade to Premium",
  isStandard,
}: PremiumNagModalProps) {
  const [open, setOpen] = useState(false);

  // Delay open so page renders first
  useEffect(() => {
    if (!isStandard) return;
    const t = setTimeout(() => {
      if (shouldShow(storageKey)) setOpen(true);
    }, 1_800);
    return () => clearTimeout(t);
  }, [isStandard, storageKey]);

  // Close silently when user upgrades mid-session
  useEffect(() => {
    if (!isStandard) setOpen(false);
  }, [isStandard]);

  function dismiss() {
    markDismissed(storageKey);
    setOpen(false);
  }

  if (!isStandard) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-2xl border border-border bg-background shadow-2xl",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {/* Top gradient accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 via-primary to-accent/60" />

          <div className="p-6">
            {/* Custom dismiss button */}
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* "Did You Know?" pill */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
              💡 Did You Know?
            </div>

            {/* Headline */}
            <h2 className="mt-3 text-xl font-bold leading-snug tracking-tight">
              {headline}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {subheadline}
            </p>

            {/* Benefits */}
            <ul className="mt-5 space-y-3">
              {benefits.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg select-none"
                    aria-hidden="true"
                  >
                    {b.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{b.title}</div>
                    <div className="text-xs text-muted-foreground">{b.body}</div>
                  </div>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button asChild className="gap-2 sm:w-auto" onClick={dismiss}>
                <Link to="/upgrade">
                  <Crown className="h-4 w-4" />
                  {ctaLabel}
                </Link>
              </Button>
              <button
                onClick={dismiss}
                className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Maybe later
              </button>
            </div>

            <p className="mt-3 text-center text-[10px] text-muted-foreground/50">
              This reminder won't appear again for 8 hours.
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
