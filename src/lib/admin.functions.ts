import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { RequestStatus } from "@/lib/requests.shared";
import type { EscrowStatus } from "@/lib/escrow.functions";

// Admin detection now lives in its own isolated module; re-exported here for
// backwards compatibility with any existing importers.
export { checkIsAdmin } from "@/lib/is-admin.functions";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type Db = SupabaseClient<Database>;

export type FarmerLite = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type AdminRequestRow = {
  id: string;
  type: "deposit" | "withdrawal";
  user_id: string;
  amount: number;
  method: string;
  status: RequestStatus;
  proof_url: string | null;
  admin_note: string | null;
  created_at: string;
  farmer: FarmerLite | null;
};

export type AdminFarmerRow = FarmerLite & {
  country: string | null;
  frozen: boolean;
  kyc_status: string;
  created_at: string;
  primary_balance: number;
  farming_balance: number;
};

export type AdminLedgerRow = {
  id: string;
  kind: string;
  amount: number;
  memo: string | null;
  created_at: string;
};

export type AdminFarmerDetail = {
  farmer: AdminFarmerRow & { referral_code: string | null; phone: string | null };
  isAdmin: boolean;
  recentLedger: AdminLedgerRow[];
};

export type AdminCycleRow = {
  id: string;
  user_id: string;
  amount: number;
  status: Database["public"]["Enums"]["cycle_status"];
  started_at: string;
  matures_at: string;
  reward_bps: number;
  farmer: FarmerLite | null;
};

export type AdminCouponRow = {
  id: string;
  code: string;
  amount: number;
  max_redemptions: number;
  used_redemptions: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export type AdminEscrowDispute = {
  id: string;
  amount: number;
  title: string | null;
  terms: string | null;
  dispute_reason: string | null;
  status: EscrowStatus;
  created_at: string;
  payer: FarmerLite | null;
  payee: FarmerLite | null;
};

export type AdminAuditRow = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: unknown;
  created_at: string;
  actor: FarmerLite | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// IMPORTANT: the service-role client is loaded lazily INSIDE handlers via this
// helper. It must never be imported at module scope here, because this module
// is also imported by client code (e.g. the `useIsAdmin` hook → `checkIsAdmin`).
// A static `import { supabaseAdmin } from ".../client.server"` would pull a
// server-only module into the client bundle and break admin detection.
async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function ensureAdmin(supabase: Db, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Admin only");
}

async function fetchFarmerMap(sb: Db, ids: string[]): Promise<Map<string, FarmerLite>> {
  const map = new Map<string, FarmerLite>();
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (!unique.length) return map;
  const { data } = await sb
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", unique);
  for (const p of data ?? []) map.set(p.id, p as FarmerLite);
  return map;
}

// ---------------------------------------------------------------------------
// Requests — list + approve/reject + proof URL
// ---------------------------------------------------------------------------

const listRequestsInput = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
});

export const adminListRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listRequestsInput.parse(d))
  .handler(async ({ data, context }): Promise<AdminRequestRow[]> => {
    await ensureAdmin(context.supabase as Db, context.userId);
    const sb = await adminDb();

    const select = "id, user_id, amount, method, status, proof_url, admin_note, created_at";
    const applyStatus = <T,>(q: T): T => {
      if (data.status === "all") return q;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (q as any).eq("status", data.status);
    };

    const [dep, wd] = await Promise.all([
      applyStatus(sb.from("deposit_requests").select(select))
        .order("created_at", { ascending: false })
        .limit(100),
      applyStatus(sb.from("withdrawal_requests").select(select))
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (dep.error) throw new Error(dep.error.message);
    if (wd.error) throw new Error(wd.error.message);

    const rows = [
      ...(dep.data ?? []).map((r) => ({ ...r, type: "deposit" as const })),
      ...(wd.data ?? []).map((r) => ({ ...r, type: "withdrawal" as const })),
    ];
    const farmers = await fetchFarmerMap(sb, rows.map((r) => r.user_id));

    return rows
      .map((r) => ({
        id: r.id,
        type: r.type,
        user_id: r.user_id,
        amount: Number(r.amount),
        method: r.method,
        status: r.status as RequestStatus,
        proof_url: r.proof_url,
        admin_note: r.admin_note,
        created_at: r.created_at,
        farmer: farmers.get(r.user_id) ?? null,
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  });

const reviewInput = z.object({
  type: z.enum(["deposit", "withdrawal"]),
  id: z.string().uuid(),
  approve: z.boolean(),
  note: z.string().max(1000).optional(),
});

export const adminReviewRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reviewInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("admin_review_request", {
      p_type: data.type,
      p_id: data.id,
      p_approve: data.approve,
      p_note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const proofInput = z.object({ path: z.string().min(1).max(2048) });

export const adminGetProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => proofInput.parse(d))
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    await ensureAdmin(context.supabase as Db, context.userId);
    const sb = await adminDb();
    const { data: signed, error } = await sb.storage
      .from("proofs")
      .createSignedUrl(data.path, 60 * 10);
    if (error || !signed?.signedUrl) return { url: null };
    return { url: signed.signedUrl };
  });

// ---------------------------------------------------------------------------
// Farmers — list/search, detail, balance adjust, freeze
// ---------------------------------------------------------------------------

const listFarmersInput = z.object({ search: z.string().max(120).optional() });

export const adminListFarmers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listFarmersInput.parse(d))
  .handler(async ({ data, context }): Promise<AdminFarmerRow[]> => {
    await ensureAdmin(context.supabase as Db, context.userId);
    const sb = await adminDb();

    let q = sb
      .from("profiles")
      .select("id, display_name, username, avatar_url, country, frozen, kyc_status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const term = data.search?.trim().replace(/[^a-zA-Z0-9_@.-]/g, "");
    if (term) {
      q = q.or(`username.ilike.%${term}%,display_name.ilike.%${term}%,referral_code.ilike.%${term}%`);
    }

    const { data: profiles, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p) => p.id);

    const balances = new Map<string, { primary: number; farming: number }>();
    if (ids.length) {
      const { data: wallets } = await sb
        .from("wallets")
        .select("user_id, kind, balance")
        .in("user_id", ids);
      for (const w of wallets ?? []) {
        const entry = balances.get(w.user_id) ?? { primary: 0, farming: 0 };
        if (w.kind === "primary") entry.primary = Number(w.balance);
        else if (w.kind === "farming") entry.farming = Number(w.balance);
        balances.set(w.user_id, entry);
      }
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      display_name: p.display_name,
      username: p.username,
      avatar_url: p.avatar_url,
      country: p.country,
      frozen: p.frozen,
      kyc_status: p.kyc_status as string,
      created_at: p.created_at,
      primary_balance: balances.get(p.id)?.primary ?? 0,
      farming_balance: balances.get(p.id)?.farming ?? 0,
    }));
  });

const farmerIdInput = z.object({ userId: z.string().uuid() });

export const adminGetFarmer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => farmerIdInput.parse(d))
  .handler(async ({ data, context }): Promise<AdminFarmerDetail | null> => {
    await ensureAdmin(context.supabase as Db, context.userId);
    const sb = await adminDb();

    const { data: p, error } = await sb
      .from("profiles")
      .select(
        "id, display_name, username, avatar_url, country, frozen, kyc_status, created_at, referral_code, phone",
      )
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return null;

    const [{ data: wallets }, { data: roles }, { data: ledger }] = await Promise.all([
      sb.from("wallets").select("kind, balance").eq("user_id", data.userId),
      sb.from("user_roles").select("role").eq("user_id", data.userId).eq("role", "admin"),
      sb
        .from("ledger_entries")
        .select("id, kind, amount, memo, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    let primary = 0;
    let farming = 0;
    for (const w of wallets ?? []) {
      if (w.kind === "primary") primary = Number(w.balance);
      else if (w.kind === "farming") farming = Number(w.balance);
    }

    return {
      farmer: {
        id: p.id,
        display_name: p.display_name,
        username: p.username,
        avatar_url: p.avatar_url,
        country: p.country,
        frozen: p.frozen,
        kyc_status: p.kyc_status as string,
        created_at: p.created_at,
        referral_code: p.referral_code,
        phone: p.phone,
        primary_balance: primary,
        farming_balance: farming,
      },
      isAdmin: (roles ?? []).length > 0,
      recentLedger: (ledger ?? []).map((e) => ({
        id: e.id,
        kind: e.kind as string,
        amount: Number(e.amount),
        memo: e.memo,
        created_at: e.created_at,
      })),
    };
  });

const adjustInput = z.object({
  userId: z.string().uuid(),
  amount: z.number().refine((n) => n !== 0, "Amount must be non-zero").gte(-1_000_000_000).lte(1_000_000_000),
  memo: z.string().max(200).optional(),
});

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adjustInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("admin_adjust_balance", {
      p_user: data.userId,
      p_amount: data.amount,
      p_memo: data.memo ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const freezeInput = z.object({ userId: z.string().uuid(), frozen: z.boolean() });

export const adminSetFrozen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => freezeInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("admin_set_frozen", {
      p_user: data.userId,
      p_frozen: data.frozen,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Cycles — list + force-mature + cancel
// ---------------------------------------------------------------------------

const listCyclesInput = z.object({
  status: z.enum(["active", "matured", "reaped", "cancelled", "all"]).default("active"),
});

export const adminListCycles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listCyclesInput.parse(d))
  .handler(async ({ data, context }): Promise<AdminCycleRow[]> => {
    await ensureAdmin(context.supabase as Db, context.userId);
    const sb = await adminDb();

    let q = sb
      .from("cycles")
      .select("id, user_id, amount, status, started_at, matures_at, reward_bps")
      .order("started_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") q = q.eq("status", data.status);

    const { data: cycles, error } = await q;
    if (error) throw new Error(error.message);
    const farmers = await fetchFarmerMap(sb, (cycles ?? []).map((c) => c.user_id));

    return (cycles ?? []).map((c) => ({
      id: c.id,
      user_id: c.user_id,
      amount: Number(c.amount),
      status: c.status,
      started_at: c.started_at,
      matures_at: c.matures_at,
      reward_bps: c.reward_bps,
      farmer: farmers.get(c.user_id) ?? null,
    }));
  });

const cycleIdInput = z.object({ id: z.string().uuid() });

export const adminCancelCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cycleIdInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("admin_cancel_cycle", { p_cycle_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminForceMatureCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cycleIdInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("admin_force_mature_cycle", { p_cycle_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Escrow disputes — list + resolve
// ---------------------------------------------------------------------------

export const adminListEscrowDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminEscrowDispute[]> => {
    await ensureAdmin(context.supabase as Db, context.userId);
    const sb = await adminDb();
    const { data: rows, error } = await sb
      .from("escrow_trades")
      .select("id, amount, title, terms, dispute_reason, status, created_at, payer_id, payee_id")
      .eq("status", "disputed")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const farmers = await fetchFarmerMap(
      sb,
      (rows ?? []).flatMap((r) => [r.payer_id, r.payee_id]),
    );
    return (rows ?? []).map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      title: r.title,
      terms: r.terms,
      dispute_reason: r.dispute_reason,
      status: r.status as EscrowStatus,
      created_at: r.created_at,
      payer: farmers.get(r.payer_id) ?? null,
      payee: farmers.get(r.payee_id) ?? null,
    }));
  });

const resolveInput = z.object({
  id: z.string().uuid(),
  release: z.boolean(),
  resolution: z.string().max(1000).optional(),
});

export const adminResolveEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resolveInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("escrow_resolve", {
      p_id: data.id,
      p_release: data.release,
      p_resolution: data.resolution ?? undefined,
    });
    if (error) throw new Error(error.message);
    // Audit (best-effort; escrow_resolve itself is the source of truth).
    const sb = await adminDb();
    await sb.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: data.release ? "escrow_released" : "escrow_refunded",
      target_type: "escrow",
      target_id: data.id,
      detail: { resolution: data.resolution ?? null },
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Coupons — list + create + enable/disable
// ---------------------------------------------------------------------------

export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCouponRow[]> => {
    await ensureAdmin(context.supabase as Db, context.userId);
    const sb = await adminDb();
    const { data: rows, error } = await sb
      .from("coupons")
      .select("id, code, amount, max_redemptions, used_redemptions, active, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((c) => ({
      id: c.id,
      code: c.code,
      amount: Number(c.amount),
      max_redemptions: c.max_redemptions,
      used_redemptions: c.used_redemptions,
      active: c.active,
      expires_at: c.expires_at,
      created_at: c.created_at,
    }));
  });

const createCouponInput = z.object({
  code: z.string().min(2).max(40),
  amount: z.number().positive().max(1_000_000_000),
  maxRedemptions: z.number().int().min(1).max(1_000_000),
  expiresAt: z.string().datetime().optional(),
});

export const adminCreateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createCouponInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("admin_create_coupon", {
      p_code: data.code,
      p_amount: data.amount,
      p_max: data.maxRedemptions,
      p_expires: data.expiresAt ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });

const couponActiveInput = z.object({ id: z.string().uuid(), active: z.boolean() });

export const adminSetCouponActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => couponActiveInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("admin_set_coupon_active", {
      p_id: data.id,
      p_active: data.active,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const adminListAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAuditRow[]> => {
    await ensureAdmin(context.supabase as Db, context.userId);
    const sb = await adminDb();
    const { data: rows, error } = await sb
      .from("admin_audit_log")
      .select("id, action, target_type, target_id, detail, created_at, actor_id")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const actors = await fetchFarmerMap(sb, (rows ?? []).map((r) => r.actor_id));
    return (rows ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      detail: r.detail,
      created_at: r.created_at,
      actor: actors.get(r.actor_id) ?? null,
    }));
  });
