import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  ChevronDown,
  Crown,
  Trophy,
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
import { useIsAdmin, useMyPrivileges } from "@/hooks/use-admin";
import { useSiteState } from "@/hooks/use-site-state";
import { getPremiumStatus } from "@/lib/premium.functions";

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
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Verify", url: "/verify", icon: ShieldCheck },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: adminData } = useIsAdmin();
  const isAdmin = adminData?.isAdmin === true;
  const { data: privilegeData } = useMyPrivileges();
  const myPrivileges = privilegeData?.privileges ?? [];
  const { data: siteState } = useSiteState();

  // Show admin section if full admin OR has any admin capability privilege
  const ADMIN_PRIVILEGES = [
    "admin_farmers", "admin_requests", "admin_kyc", "admin_cycles",
    "admin_escrow", "admin_coupons", "admin_pv", "admin_audit",
    "admin_deposit_channels",
  ];
  const hasAnyAdminPrivilege = myPrivileges.some((p) => ADMIN_PRIVILEGES.includes(p));
  const showAdminSection = isAdmin || hasAnyAdminPrivilege;

  // Premium status — no longer needed for link visibility (link is always shown)
  // Keep the query so the cache is warm for the Membership page
  const premiumStatusFn = useServerFn(getPremiumStatus);
  useQuery({
    queryKey: ["premium-status"],
    queryFn: () => premiumStatusFn(),
    staleTime: 60_000,
  });

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
  }, [updateScrollState, showAdminSection, collapsed]);

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
          {/* Earn group: always show "Membership" link — Req 10.1–10.5 */}
          {renderGroup("Earn", [
            ...earn,
            { title: "Membership", url: "/upgrade", icon: Crown } as const,
          ])}
          {renderGroup("Transfer", transfer)}
          {renderGroup("Account", account)}
          {showAdminSection && renderGroup("Admin", [
            { title: "Admin Console", url: "/admin", icon: Shield },
            ...(isAdmin || myPrivileges.includes("admin_farmers")
              ? [{ title: "Farmers", url: "/admin/farmers", icon: Users } as const] : []),
            ...(isAdmin || myPrivileges.includes("admin_requests")
              ? [{ title: "Requests", url: "/admin/requests", icon: Shield } as const] : []),
            ...(isAdmin || myPrivileges.includes("admin_kyc")
              ? [{ title: "KYC", url: "/admin/kyc", icon: ShieldCheck } as const] : []),
            ...(isAdmin || myPrivileges.includes("admin_deposit_channels")
              ? [{ title: "Deposit Channels", url: "/admin/deposit-channels", icon: ArrowDownToLine } as const] : []),
            ...(isAdmin
              ? [
                  { title: "Maintenance", url: "/admin/maintenance", icon: ShieldCheck } as const,
                  { title: "Privileges", url: "/admin/privileges", icon: Shield } as const,
                ]
              : []),
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

      {/* Telegram community links — shown only when URLs are configured */}
      {!collapsed && (siteState?.telegram_group_url || siteState?.telegram_channel_url) && (
        <div className="shrink-0 border-t border-border/40 px-3 py-2.5">
          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-sidebar-foreground/40">Community</p>
          <div className="flex flex-col gap-1">
            {siteState?.telegram_group_url && (
              <a
                href={siteState.telegram_group_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                {/* Telegram SVG icon */}
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-[#2CA5E0]" aria-hidden="true">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617 5.36 12.69c-.65-.204-.664-.65.136-.961l11.25-4.337c.538-.194 1.01.131.838.829h.31z"/>
                </svg>
                Join Group
              </a>
            )}
            {siteState?.telegram_channel_url && (
              <a
                href={siteState.telegram_channel_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-[#2CA5E0]" aria-hidden="true">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617 5.36 12.69c-.65-.204-.664-.65.136-.961l11.25-4.337c.538-.194 1.01.131.838.829h.31z"/>
                </svg>
                Follow Channel
              </a>
            )}
          </div>
        </div>
      )}

      {/* Collapsed: show icon-only Telegram buttons */}
      {collapsed && (siteState?.telegram_group_url || siteState?.telegram_channel_url) && (
        <div className="shrink-0 border-t border-border/40 flex flex-col items-center gap-1 py-2">
          {siteState?.telegram_group_url && (
            <a
              href={siteState.telegram_group_url}
              target="_blank"
              rel="noreferrer"
              title="Join Telegram Group"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#2CA5E0]" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617 5.36 12.69c-.65-.204-.664-.65.136-.961l11.25-4.337c.538-.194 1.01.131.838.829h.31z"/>
              </svg>
            </a>
          )}
          {siteState?.telegram_channel_url && (
            <a
              href={siteState.telegram_channel_url}
              target="_blank"
              rel="noreferrer"
              title="Follow Telegram Channel"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#2CA5E0]" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617 5.36 12.69c-.65-.204-.664-.65.136-.961l11.25-4.337c.538-.194 1.01.131.838.829h.31z"/>
              </svg>
            </a>
          )}
        </div>
      )}
    </Sidebar>
  );
}
