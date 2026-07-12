/**
 * PageHint — a one-time contextual tip shown on first visit to a page.
 *
 * Each page has a unique storageKey. Once dismissed, it never shows again.
 * Appears as a dismissible banner at the top of the page content.
 *
 * Usage:
 *   <PageHint storageKey="hint-deposit" title="Depositing funds" body="..." />
 */

import { useState, useEffect } from "react";
import { X, Lightbulb } from "lucide-react";

interface Props {
  storageKey: string;
  title: string;
  body: string;
  /** Optional accent color class, defaults to amber */
  accent?: "amber" | "primary" | "cyan";
}

const ACCENT_STYLES = {
  amber:   "border-amber-500/30 bg-amber-500/10 text-amber-400",
  primary: "border-primary/30 bg-primary/10 text-primary",
  cyan:    "border-cyan-400/30 bg-cyan-400/10 text-cyan-400",
};

function hasSeen(key: string): boolean {
  try { return !!localStorage.getItem(key); } catch { return false; }
}

function markSeen(key: string): void {
  try { localStorage.setItem(key, "1"); } catch {}
}

export function PageHint({ storageKey, title, body, accent = "amber" }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasSeen(storageKey)) setVisible(true);
  }, [storageKey]);

  if (!visible) return null;

  function dismiss() {
    markSeen(storageKey);
    setVisible(false);
  }

  const styles = ACCENT_STYLES[accent];

  return (
    <div className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 ${styles}`}>
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs opacity-80 leading-relaxed">{body}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Pre-defined hints for each major page ────────────────────────────────

export const PAGE_HINTS = {
  deposit: {
    storageKey: "hint-deposit",
    title: "Funding your wallet",
    body: "Use IvoryPay for instant USDT deposits — your wallet is credited automatically once confirmed on-chain. Manual transfer requires admin approval.",
    accent: "primary" as const,
  },
  farm: {
    storageKey: "hint-farm",
    title: "How farming works",
    body: "Lock Seeds into a cycle to earn daily rewards. Cycles mature automatically — hit Reap to collect your principal plus reward.",
    accent: "primary" as const,
  },
  affiliate: {
    storageKey: "hint-affiliate",
    title: "Earning from referrals",
    body: "Share your unique referral link. Every cycle your downline starts earns you a commission — automatically, with no action needed.",
    accent: "cyan" as const,
  },
  withdraw: {
    storageKey: "hint-withdraw",
    title: "Withdrawing funds",
    body: "Add a bank account or crypto wallet address first. Withdrawals are processed by the admin — typically within 24 hours.",
    accent: "amber" as const,
  },
  escrow: {
    storageKey: "hint-escrow",
    title: "Escrow trades",
    body: "Escrow lets you trade safely with other Farmers. Funds are held securely until both parties confirm — no trust required.",
    accent: "amber" as const,
  },
  upgrade: {
    storageKey: "hint-upgrade",
    title: "Premium membership",
    body: "Premium gives you higher farming returns, 3-generation referral income, and lower withdrawal fees for just 12 USDT/year.",
    accent: "primary" as const,
  },
} as const;
