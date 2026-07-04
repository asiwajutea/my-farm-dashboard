import { cn } from "@/lib/utils";

export interface PremiumBadgeProps {
  /** Badge display name, e.g. "Premium Farmer" from app_settings.premium_badge_name */
  name: string;
  /** Hex or CSS color, e.g. "#F5C518" from app_settings.premium_badge_color */
  color: string;
  /** When true renders a muted "Expired" variant */
  expired?: boolean;
  className?: string;
}

/**
 * Displays a premium membership badge.
 *
 * Active: dynamic background color from `color` prop.
 * Expired: muted/greyed styling with "Expired" label appended.
 *
 * Requirements: 9.7, 9.8, 16.2
 */
export default function PremiumBadge({ name, color, expired = false, className }: PremiumBadgeProps) {
  if (expired) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground",
          className,
        )}
      >
        {/* Small dot inherits the original badge color so it's still recognisable */}
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full opacity-40"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {name}
        <span className="rounded bg-muted-foreground/15 px-1 text-[10px] uppercase tracking-wide">
          Expired
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold shadow",
        className,
      )}
      style={{
        backgroundColor: color,
        // Derive a readable text color: use white for dark backgrounds, dark for light ones
        color: isColorDark(color) ? "#fff" : "#111",
        borderColor: `${color}33`,
      }}
    >
      {name}
    </span>
  );
}

/**
 * Very lightweight luminance check to pick a readable contrast color.
 * Handles hex shorthand (#FFF), full hex (#F5C518), and falls back to "dark"
 * for anything else.
 */
function isColorDark(hex: string): boolean {
  try {
    const clean = hex.replace("#", "");
    const full = clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    // Standard relative luminance threshold
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  } catch {
    return true;
  }
}
