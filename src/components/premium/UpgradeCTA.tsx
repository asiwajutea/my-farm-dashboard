import { Link } from "@tanstack/react-router";
import { Sprout, Users, TrendingUp, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface UpgradeCTAProps {
  /** Annual premium membership fee in USDT */
  premiumFeeUsdt: number;
  className?: string;
}

const BENEFITS = [
  { icon: TrendingUp, text: "Boosted farming returns" },
  { icon: Users,      text: "3-generation referral commissions" },
  { icon: Sprout,     text: "Lower withdrawal fee" },
];

/**
 * Call-to-action card encouraging Standard / expired-Premium users to upgrade.
 * Displays the annual fee prominently and links to /upgrade.
 *
 * Requirements: 9.2, 9.3
 */
export default function UpgradeCTA({ premiumFeeUsdt, className }: UpgradeCTAProps) {
  return (
    <Card className={cn("overflow-hidden border-primary/20 bg-card/60", className)}>
      {/* Decorative glow strip */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-accent/60" />

      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Upgrade to Premium</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Unlock exclusive benefits with an annual membership.
            </p>
          </div>
          {/* Fee badge */}
          <div className="shrink-0 rounded-xl bg-primary/10 px-3 py-2 text-center">
            <span className="block text-lg font-bold text-primary leading-none">
              {premiumFeeUsdt} USDT
            </span>
            <span className="text-[10px] text-muted-foreground tracking-wide uppercase">/ year</span>
          </div>
        </div>

        {/* Benefits list */}
        <ul className="mt-4 space-y-1.5" aria-label="Premium benefits">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>

        {/* CTA button */}
        <Button asChild className="mt-5 w-full gap-2" size="sm">
          <Link to="/upgrade">
            Get Premium
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
