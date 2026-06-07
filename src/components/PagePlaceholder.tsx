import { Sprout } from "lucide-react";
import type { ReactNode } from "react";

interface PagePlaceholderProps {
  phase: number;
  title: string;
  description: string;
  icon?: ReactNode;
}

export function PagePlaceholder({ phase, title, description, icon }: PagePlaceholderProps) {
  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
        <Sprout className="h-3.5 w-3.5" />
        Phase {phase}
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>

      <div className="glass mt-8 rounded-3xl p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon ?? <Sprout className="h-6 w-6" />}
        </div>
        <h2 className="mt-4 text-lg font-semibold">Coming in Phase {phase}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          This page is part of the planned phased rollout. The route, navigation, and database schema are already in place — the feature UI ships next.
        </p>
      </div>
    </div>
  );
}
