import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sprout,
  Send,
  Ticket,
  Handshake,
  Bell,
  ShieldCheck,
  UserCircle,
  Shield,
  Users,
  Inbox,
  FileText,
  Settings,
  ChevronDown,
} from "lucide-react";

import logo from "@/assets/vfarm-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsAdmin } from "@/hooks/use-admin";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const wallet: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Wallet", url: "/wallet", icon: Wallet },
  { title: "Deposit", url: "/deposit", icon: ArrowDownToLine },
  { title: "Withdraw", url: "/withdraw", icon: ArrowUpFromLine },
];

const earn: Item[] = [
  { title: "Farm", url: "/farm", icon: Sprout },
  { title: "Affiliate", url: "/affiliate", icon: Users },
];

const transfer: Item[] = [
  { title: "Send", url: "/send", icon: Send },
  { title: "Coupons", url: "/coupons", icon: Ticket },
  { title: "Escrow", url: "/escrow", icon: Handshake },
];

const account: Item[] = [
  { title: "Profile", url: "/profile", icon: UserCircle },
  { title: "Verify", url: "/verify", icon: ShieldCheck },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: adminData } = useIsAdmin();
  const isAdmin = adminData?.isAdmin === true;

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  // On mobile the sidebar is an overlay sheet; close it after navigating so the
  // selected page is visible.
  const handleNavigate = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // The nav scroll container hides its scrollbar, so we surface a "more below"
  // affordance (bottom fade + chevron) whenever the menu overflows and the user
  // hasn't reached the end yet.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setShowMore(false);
      return;
    }
    setShowMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    window.addEventListener("resize", updateScrollState);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, isAdmin, collapsed]);

  const scrollDown = () => {
    scrollRef.current?.scrollBy({ top: 240, behavior: "smooth" });
  };

  const renderGroup = (label: string, items: Item[]) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url} className="flex items-center gap-2" onClick={handleNavigate}>
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/40">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1.5" onClick={handleNavigate}>
          <img src={logo} alt="VFarmers" className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight">
              V<span className="text-primary">Farmers</span>
            </span>
          )}
        </Link>
      </SidebarHeader>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <SidebarContent ref={scrollRef} onScroll={updateScrollState}>
          {renderGroup("Wallet", wallet)}
          {renderGroup("Earn", earn)}
          {renderGroup("Transfer", transfer)}
          {renderGroup("Account", account)}
          {isAdmin && renderGroup("Admin", [
            { title: "Admin Console", url: "/admin", icon: Shield },
            { title: "Requests", url: "/admin/requests", icon: Inbox },
            { title: "Farmers", url: "/admin/farmers", icon: Users },
            { title: "Cycles", url: "/admin/cycles", icon: Sprout },
            { title: "Escrow", url: "/admin/escrow", icon: Handshake },
            { title: "Coupons", url: "/admin/coupons", icon: Ticket },
            { title: "Affiliates", url: "/admin/affiliates", icon: Users },
            { title: "Settings", url: "/admin/settings", icon: Settings },
            { title: "Audit Log", url: "/admin/audit", icon: FileText },
          ])}
        </SidebarContent>

        {!collapsed && showMore && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 items-end justify-center bg-gradient-to-t from-sidebar via-sidebar/80 to-transparent">
            <button
              type="button"
              aria-label="Scroll down for more"
              onClick={scrollDown}
              className="pointer-events-auto mb-1.5 flex h-6 w-6 animate-bounce items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground/80 shadow-md transition-colors hover:text-sidebar-accent-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
