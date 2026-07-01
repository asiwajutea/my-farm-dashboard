import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sprout, Store } from "lucide-react";
import logo from "@/assets/vfarm-logo.png";

export const Route = createFileRoute("/select-dashboard")({
  head: () => ({ meta: [{ title: "Choose Dashboard · VFarmers" }] }),
  component: SelectDashboardPage,
});

function SelectDashboardPage() {
  return (
    <div className="min-h-screen bg-hero flex items-center justify-center px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <img src={logo} alt="VFarmers" className="h-12 w-12" />
          <span className="text-xl font-semibold tracking-tight">V<span className="text-primary">Farmers</span></span>
          <p className="text-sm text-muted-foreground">Your account has multiple roles. Where would you like to go?</p>
        </div>

        <div className="grid gap-4">
          <Link
            to="/dashboard"
            className="glass group flex items-center gap-4 rounded-2xl p-5 border border-border hover:border-primary/40 transition-all hover:-translate-y-0.5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sprout className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Farmer Dashboard</div>
              <div className="text-sm text-muted-foreground">Manage your Seeds, farming cycles, and wallet.</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <Link
            to="/merchant/dashboard"
            className="glass group flex items-center gap-4 rounded-2xl p-5 border border-border hover:border-amber-400/40 transition-all hover:-translate-y-0.5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
              <Store className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Merchant Dashboard</div>
              <div className="text-sm text-muted-foreground">Manage your merchant wallet and fund farmers.</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-400 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
