import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRightLeft, LayoutDashboard, LogOut, Store, UserCircle, Wallet } from "lucide-react";
import logo from "@/assets/vfarm-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const NAV = [
  { title: "Dashboard", url: "/merchant/dashboard", icon: LayoutDashboard },
  { title: "Wallet", url: "/merchant/wallet", icon: Wallet },
  { title: "Fund Farmer", url: "/merchant/transfer", icon: ArrowRightLeft },
  { title: "Profile", url: "/merchant/profile", icon: UserCircle },
];

export function MerchantSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border/40 bg-background/60 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3.5">
        <img src={logo} alt="VFarmers" className="h-7 w-7 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">V<span className="text-primary">Farmers</span></div>
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <Store className="h-3 w-3" /> Merchant
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map((item) => (
          <Link
            key={item.url}
            to={item.url as "/merchant/dashboard"}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive(item.url)
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.title}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/40 p-3 space-y-1">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
        >
          <LayoutDashboard className="h-3.5 w-3.5" /> Farmer Dashboard
        </Link>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
