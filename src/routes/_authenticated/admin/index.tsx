import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Users, Inbox, Sprout, Handshake, Settings, Ticket, FileText } from "lucide-react";

const links = [
  { to: "/admin/farmers", label: "Farmers", desc: "Search, freeze, adjust balances", icon: Users },
  { to: "/admin/requests", label: "Requests", desc: "Approve deposits & withdrawals", icon: Inbox },
  { to: "/admin/cycles", label: "Cycles", desc: "Force-mature, cancel", icon: Sprout },
  { to: "/admin/escrow", label: "Escrow", desc: "Resolve disputes", icon: Handshake },
  { to: "/admin/settings", label: "Settings", desc: "Rates, fees, boosters", icon: Settings },
  { to: "/admin/coupons", label: "Coupons", desc: "Create & disable", icon: Ticket },
  { to: "/admin/audit", label: "Audit Log", desc: "All admin actions", icon: FileText },
] as const;

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin · VFarmers" }] }),
  component: AdminHome,
});

function AdminHome() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
        <Shield className="h-3.5 w-3.5" />
        Admin Console
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Operations</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Full admin tooling lands in Phase 7. The structure and access gate are wired today.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="glass rounded-2xl p-5 transition-colors hover:border-primary/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <l.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{l.label}</div>
                <div className="text-xs text-muted-foreground">{l.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
