import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "gold";
}

export const StatCard = ({ icon: Icon, label, value, hint, accent = "primary" }: StatCardProps) => {
  return (
    <div className="glass group relative overflow-hidden rounded-2xl p-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-glow">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            accent === "gold" ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
};
