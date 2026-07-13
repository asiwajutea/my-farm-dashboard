/**
 * GettingStartedChecklist — dashboard widget for new users.
 *
 * Shows a list of actionable setup tasks. Each item disappears as soon as
 * its condition is met (checked from real data). The entire card disappears
 * when every item is done OR the user manually dismisses it.
 *
 * Dismissed state is stored in localStorage "vf_checklist_dismissed".
 * Individual item completion is derived from real data — no localStorage needed.
 */

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2, Circle, ChevronRight, X, ListChecks,
  UserCircle, Wallet, ArrowDownToLine, Users, Share2,
  ShieldCheck, Sprout,
} from "lucide-react";

const DISMISSED_KEY = "vf_checklist_dismissed";

function isDismissed(): boolean {
  try { return !!localStorage.getItem(DISMISSED_KEY); } catch { return false; }
}
function setDismissed(): void {
  try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
}

export type ChecklistData = {
  hasUsername:       boolean;
  hasAvatar:         boolean;
  hasPayoutMethod:   boolean;
  hasDeposited:      boolean;
  hasStartedCycle:   boolean;
  hasReferral:       boolean;
  hasPasscode:       boolean;
  hasFlyerDownloaded: boolean;
};

interface ChecklistItem {
  id: keyof ChecklistData | "download_flyer";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  to: string;
  done: boolean;
}

interface Props {
  data: ChecklistData;
  referralCode: string | null;
}

export function GettingStartedChecklist({ data, referralCode }: Props) {
  const [dismissed, setDismissedState] = useState(isDismissed);

  if (dismissed) return null;

  const items: ChecklistItem[] = [
    {
      id: "hasUsername",
      icon: UserCircle,
      label: "Set your username",
      description: "Choose a @handle so other Farmers can find you for P2P transfers.",
      to: "/profile",
      done: data.hasUsername,
    },
    {
      id: "hasAvatar",
      icon: UserCircle,
      label: "Pick an avatar",
      description: "Personalise your profile with a Farmer avatar.",
      to: "/profile",
      done: data.hasAvatar,
    },
    {
      id: "hasPayoutMethod",
      icon: Wallet,
      label: "Add a payout method",
      description: "Add your bank account or crypto wallet for withdrawals.",
      to: "/withdraw",
      done: data.hasPayoutMethod,
    },
    {
      id: "hasDeposited",
      icon: ArrowDownToLine,
      label: "Fund your wallet",
      description: "Deposit USDT to start farming and earning rewards.",
      to: "/deposit",
      done: data.hasDeposited,
    },
    {
      id: "hasStartedCycle",
      icon: Sprout,
      label: "Start a farming cycle",
      description: "Lock Seeds into a cycle and let your money work for you.",
      to: "/farm",
      done: data.hasStartedCycle,
    },
    {
      id: "hasPasscode",
      icon: ShieldCheck,
      label: "Set a transaction passcode",
      description: "Protect withdrawals and transfers with a 6-digit PIN.",
      to: "/profile",
      done: data.hasPasscode,
    },
    {
      id: "download_flyer",
      icon: Share2,
      label: "Download & share your referral flyer",
      description: referralCode
        ? `Your code ${referralCode} is ready. Share your personalised flyer to earn commissions.`
        : "Share your personalised referral flyer to earn commissions from every cycle your downline runs.",
      to: "/affiliate",
      done: data.hasFlyerDownloaded,
    },
    {
      id: "hasReferral",
      icon: Users,
      label: "Invite your first farmer",
      description: "Refer someone using your link or code and start earning Gen 1 commissions.",
      to: "/affiliate",
      done: data.hasReferral,
    },
  ];

  const pending = items.filter((i) => !i.done);

  // All done — hide automatically
  if (pending.length === 0) return null;

  const completed = items.filter((i) => i.done).length;
  const pct = Math.round((completed / items.length) * 100);

  return (
    <div className="glass rounded-3xl p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Getting started</h3>
            <p className="text-xs text-muted-foreground">
              {completed} of {items.length} tasks complete
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setDismissed(); setDismissedState(true); }}
          aria-label="Dismiss checklist"
          className="shrink-0 rounded-full p-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Pending items only */}
      <ul className="space-y-1">
        {pending.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                to={item.to}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-card/60 group"
              >
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Completed items (collapsed at bottom) */}
      {completed > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary/60" />
          {completed} task{completed > 1 ? "s" : ""} completed
        </p>
      )}
    </div>
  );
}
