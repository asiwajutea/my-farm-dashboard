/**
 * User Privilege System — server functions.
 *
 * Privileges are granular capability grants stored in user_privileges.
 * Super admin can grant/revoke without promoting users to full admin.
 *
 * Available privileges:
 *   bypass_maintenance     — bypass the maintenance gate on all pages
 *   admin_farmers          — access /admin/farmers
 *   admin_requests         — approve deposits & withdrawals
 *   admin_kyc              — review KYC submissions
 *   admin_cycles           — manage farming cycles
 *   admin_escrow           — resolve escrow disputes
 *   admin_coupons          — create & manage coupons
 *   admin_pv               — configure PV activities
 *   admin_audit            — view audit log (read-only)
 *   admin_deposit_channels — lock/unlock deposit channels
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── All valid privilege codes ──────────────────────────────────────────────

export const ALL_PRIVILEGES = [
  "bypass_maintenance",
  "admin_farmers",
  "admin_requests",
  "admin_kyc",
  "admin_cycles",
  "admin_escrow",
  "admin_coupons",
  "admin_pv",
  "admin_audit",
  "admin_deposit_channels",
] as const;

export type Privilege = typeof ALL_PRIVILEGES[number];

export const PRIVILEGE_LABELS: Record<Privilege, { label: string; description: string }> = {
  bypass_maintenance:     { label: "Bypass Maintenance",     description: "Access pages and the site even when maintenance mode is active" },
  admin_farmers:          { label: "Manage Farmers",         description: "View and manage farmer accounts, freeze/unfreeze, adjust balances" },
  admin_requests:         { label: "Approve Deposits & Withdrawals", description: "Review and approve or reject deposit and withdrawal requests" },
  admin_kyc:              { label: "Review KYC",             description: "Review and approve or reject identity verification submissions" },
  admin_cycles:           { label: "Manage Cycles",          description: "Force-mature or cancel farming cycles" },
  admin_escrow:           { label: "Resolve Escrow",         description: "Resolve escrow disputes between farmers" },
  admin_coupons:          { label: "Manage Coupons",         description: "Create, disable, and manage platform coupons" },
  admin_pv:               { label: "Configure Points (PV)",  description: "Configure activity rewards and PV settings" },
  admin_audit:            { label: "View Audit Log",         description: "Read-only access to the admin audit trail" },
  admin_deposit_channels: { label: "Deposit Channels",       description: "Lock or unlock IvoryPay and manual deposit channels" },
};

// ── Types ──────────────────────────────────────────────────────────────────

export type UserPrivilegeRow = {
  id: string;
  user_id: string;
  privilege: string;
  granted_by: string;
  note: string | null;
  granted_at: string;
  // Enriched by admin query
  user_display_name?: string | null;
  user_email?: string | null;
  user_username?: string | null;
};

// ── Current user: load own privileges ────────────────────────────────────

export const getMyPrivileges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ privileges: string[] }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_privileges")
      .select("privilege")
      .eq("user_id", userId);
    return { privileges: (data ?? []).map((r) => r.privilege) };
  });

// ── Admin: list all granted privileges ───────────────────────────────────

export const adminListPrivileges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserPrivilegeRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load all privilege rows
    const { data: rows, error } = await supabaseAdmin
      .from("user_privileges")
      .select("id, user_id, privilege, granted_by, note, granted_at")
      .order("granted_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rows?.length) return [];

    // Enrich with profile data
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username")
      .in("id", userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Enrich with auth email via admin.listUsers (batched)
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map(users.map((u) => [u.id, u.email ?? null]));

    return rows.map((r) => ({
      ...r,
      note: r.note ?? null,
      user_display_name: profileMap.get(r.user_id)?.display_name ?? null,
      user_username:     profileMap.get(r.user_id)?.username ?? null,
      user_email:        emailMap.get(r.user_id) ?? null,
    }));
  });

// ── Admin: grant a privilege to a user ────────────────────────────────────

export const adminGrantPrivilege = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id:   z.string().uuid(),
      privilege: z.string().min(1),
      note:      z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("user_privileges")
      .upsert(
        {
          user_id:    data.user_id,
          privilege:  data.privilege,
          granted_by: context.userId,
          note:       data.note ?? null,
        },
        { onConflict: "user_id,privilege" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Admin: revoke a privilege ─────────────────────────────────────────────

export const adminRevokePrivilege = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),  // user_privileges.id
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_privileges")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Admin: look up a user to grant privileges to ──────────────────────────

export const adminFindUserForPrivilege = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ handle: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{
    id: string;
    display_name: string | null;
    username: string | null;
    email: string | null;
    current_privileges: string[];
  } | null> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const handle = data.handle.trim().toLowerCase().replace(/^@/, "");

    // Search by username or email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username")
      .or(`username.ilike.${handle},referral_code.ilike.${handle.toUpperCase()}`)
      .maybeSingle();

    let userId: string | null = profile?.id ?? null;
    let email: string | null = null;

    if (!userId) {
      // Try by email
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = users.find((u) => u.email?.toLowerCase() === handle);
      if (found) {
        userId = found.id;
        email = found.email ?? null;
      }
    }

    if (!userId) return null;

    // Get email if not already found
    if (!email) {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
      email = user?.email ?? null;
    }

    // Get current privileges
    const { data: privRows } = await supabaseAdmin
      .from("user_privileges")
      .select("privilege")
      .eq("user_id", userId);

    return {
      id:                 userId,
      display_name:       profile?.display_name ?? null,
      username:           profile?.username ?? null,
      email,
      current_privileges: (privRows ?? []).map((r) => r.privilege),
    };
  });
