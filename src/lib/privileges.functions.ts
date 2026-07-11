/**
 * User Privilege System
 *
 * Privileges are fine-grained capabilities a super admin can grant to any
 * user without making them a full admin.
 *
 * Defined privilege codes:
 *   bypass_maintenance      — skip the maintenance gate on all member pages
 *   admin_farmers           — access /admin/farmers
 *   admin_requests          — access /admin/requests (approve deposits/withdrawals)
 *   admin_kyc               — access /admin/kyc
 *   admin_cycles            — access /admin/cycles
 *   admin_escrow            — access /admin/escrow
 *   admin_coupons           — access /admin/coupons
 *   admin_pv                — access /admin/pv
 *   admin_audit             — access /admin/audit (read-only)
 *   admin_deposit_channels  — access /admin/deposit-channels
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── All defined privileges ────────────────────────────────────────────────

export const ALL_PRIVILEGES = [
  { code: "bypass_maintenance",     label: "Bypass Maintenance Gate",    group: "member"  },
  { code: "admin_farmers",          label: "View & Manage Farmers",       group: "admin"   },
  { code: "admin_requests",         label: "Approve Deposits & Withdrawals", group: "admin" },
  { code: "admin_kyc",              label: "Review KYC",                  group: "admin"   },
  { code: "admin_cycles",           label: "Manage Farming Cycles",       group: "admin"   },
  { code: "admin_escrow",           label: "Resolve Escrow Disputes",     group: "admin"   },
  { code: "admin_coupons",          label: "Manage Coupons",              group: "admin"   },
  { code: "admin_pv",               label: "Configure PV Activities",     group: "admin"   },
  { code: "admin_audit",            label: "View Audit Log",              group: "admin"   },
  { code: "admin_deposit_channels", label: "Manage Deposit Channels",     group: "admin"   },
] as const;

export type PrivilegeCode = typeof ALL_PRIVILEGES[number]["code"];

export type PrivilegeRow = {
  id:         string;
  user_id:    string;
  privilege:  string;
  granted_by: string;
  note:       string | null;
  granted_at: string;
  // Joined
  user_display_name?: string | null;
  user_email?:        string | null;
};

// ── Current user: get own privileges ─────────────────────────────────────

export const getMyPrivileges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data } = await context.supabase
      .from("user_privileges")
      .select("privilege")
      .eq("user_id", context.userId);
    return (data ?? []).map((r) => r.privilege);
  });

// ── Admin: list all granted privileges ───────────────────────────────────

export const adminListPrivileges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrivilegeRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch all privileges with profiles join for display names
    const { data: rows } = await supabaseAdmin
      .from("user_privileges")
      .select("id, user_id, privilege, granted_by, note, granted_at")
      .order("granted_at", { ascending: false });

    if (!rows?.length) return [];

    // Enrich with display names from profiles
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    // Get emails from auth.users via admin API
    const emailMap = new Map<string, string>();
    for (const uid of userIds) {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (user?.email) emailMap.set(uid, user.email);
      } catch { /* non-fatal */ }
    }

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return rows.map((r) => ({
      id:         r.id,
      user_id:    r.user_id,
      privilege:  r.privilege,
      granted_by: r.granted_by,
      note:       r.note ?? null,
      granted_at: r.granted_at,
      user_display_name: profileMap.get(r.user_id)?.display_name ?? null,
      user_email:        emailMap.get(r.user_id) ?? null,
    }));
  });

// ── Admin: grant a privilege ──────────────────────────────────────────────

export const adminGrantPrivilege = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      userId:    z.string().uuid(),
      privilege: z.string().min(1).max(80),
      note:      z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_privileges").upsert(
      {
        user_id:    data.userId,
        privilege:  data.privilege,
        granted_by: context.userId,
        note:       data.note ?? null,
      },
      { onConflict: "user_id,privilege" },
    );
    if (error) throw new Error(error.message);

    // Audit log
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id:    context.userId,
      action:      "grant_privilege",
      target_type: "user",
      target_id:   data.userId,
      detail:      { privilege: data.privilege, note: data.note },
    });

    return { ok: true };
  });

// ── Admin: revoke a privilege ─────────────────────────────────────────────

export const adminRevokePrivilege = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load the row first for the audit log
    const { data: row } = await supabaseAdmin
      .from("user_privileges")
      .select("user_id, privilege")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("user_privileges")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (row) {
      await supabaseAdmin.from("admin_audit_log").insert({
        actor_id:    context.userId,
        action:      "revoke_privilege",
        target_type: "user",
        target_id:   row.user_id,
        detail:      { privilege: row.privilege },
      });
    }

    return { ok: true };
  });
