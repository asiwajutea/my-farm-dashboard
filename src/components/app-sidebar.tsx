import { Link, useRouterState } from "@tanstack/react-router";
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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: adminData } = useIsAdmin();
  const isAdmin = adminData?.isAdmin === true;

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  const renderGroup = (label: string, items: Item[]) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url} className="flex items-center gap-2">
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
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1.5">
          <img src={logo} alt="VFarmers" className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight">
              V<span className="text-primary">Farmers</span>
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Wallet", wallet)}
        {renderGroup("Earn", earn)}
        {renderGroup("Transfer", transfer)}
        {renderGroup("Account", account)}
        {isAdmin && renderGroup("Admin", [
          { title: "Admin Console", url: "/admin", icon: Shield },
          { title: "Affiliates", url: "/admin/affiliates", icon: Users },
        ])}
      </SidebarContent>
    </Sidebar>
  );
}
