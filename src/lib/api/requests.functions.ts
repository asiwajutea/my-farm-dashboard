import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  DEPOSIT_AMOUNT_MIN,
  WITHDRAWAL_AMOUNT_MIN,
  isDepositMethod,
  isWithdrawalMethod,
  listInput,
  parseAmount,
  validateProof,
  type HistoryPage,
  type RequestErrorCode,
  type RequestRow,
  type RequestStatus,
  type RequestType,
} from "@/lib/requests.shared";
import {
  findRecentDuplicateDeposit,
  uploadProof,
} from "@/lib/requests.server";
import {
  DEFAULT_PAYOUT_ANCHOR,
  DEFAULT_PAYOUT_TIMEZONE,
  getPayoutLockState,
} from "@/lib/payout";

// ---------------------------------------------------------------------------
// Typed error — the message carries the discriminated code so it survives
// serialization across the server-fn boundary. Handlers never leak SQL/stack.
// ---------------------------------------------------------------------------

export class RequestError extends Error {
  code: RequestErrorCode;
  constructor(code: RequestErrorCode) {
    super(code);
    this.name = "RequestError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Pure, testable helpers: projection, cursor encode/decode, merge/sort/paginate
// ---------------------------------------------------------------------------

type DbRequestRow = Database["public"]["Tables"]["deposit_requests"]["Row"];
type DbWithdrawalRow = Database["public"]["Tables"]["withdrawal_requests"]["Row"];

export type Cursor = { created_at: string; id: string };

/** Project a DB request row into the app-facing RequestRow shape. */
export function projectRow(row: DbRequestRow | DbWithdrawalRow, type: RequestType): RequestRow {
  // Withdrawal rows carry the USDT payout + rate frozen at request time;
  // deposit (and legacy withdrawal) rows omit them.
  const amountUsdt =
    "amount_usdt" in row && row.amount_usdt != null ? Number(row.amount_usdt).toFixed(2) : null;
  const lockedRate =
    "locked_rate" in row && row.locked_rate != null ? Number(row.locked_rate).toFixed(8) : null;
  return {
    id: row.id,
    type,
    amount: Number(row.amount).toFixed(2),
    method: row.method,
    status: row.status as RequestStatus,
    proof_url: row.proof_url,
    created_at: row.created_at,
    amount_usdt: amountUsdt,
    locked_rate: lockedRate,
  };
}

export function encodeCursor(cursor: Cursor): string {
  return btoa(JSON.stringify(cursor));
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(atob(raw)) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Cursor).created_at === "string" &&
      typeof (parsed as Cursor).id === "string"
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

/** Descending order by (created_at, id): newest first, id as deterministic tiebreak. */
export function compareDesc(a: RequestRow, b: RequestRow): number {
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? 1 : -1;
  }
  if (a.id !== b.id) {
    return a.id < b.id ? 1 : -1;
  }
  return 0;
}

export function mergeAndSort(rows: RequestRow[]): RequestRow[] {
  return [...rows].sort(compareDesc);
}

/** Keep only rows strictly older than the cursor boundary in (created_at, id) DESC order. */
export function applyCursor(sorted: RequestRow[], cursor: Cursor | null): RequestRow[] {
  if (!cursor) return sorted;
  return sorted.filter((r) => {
    if (r.created_at !== cursor.created_at) {
      return r.created_at < cursor.created_at;
    }
    return r.id < cursor.id;
  });
}

/**
 * Produce one page (<= limit) from a fully-sorted list, plus a nextCursor when
 * more rows remain. Pure so pagination traversal can be property-tested.
 */
export function pageFrom(
  allSorted: RequestRow[],
  cursor: Cursor | null,
  limit: number,
): HistoryPage {
  const rest = applyCursor(allSorted, cursor);
  const items = rest.slice(0, limit);
  const hasMore = rest.length > limit;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ created_at: last.created_at, id: last.id }) : null;
  return { items, nextCursor };
}

// ---------------------------------------------------------------------------
// 1) Submit deposit (Req 5)
// ---------------------------------------------------------------------------

export const submitDepositRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((fd: FormData) => fd)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SupabaseClient<Database>;
    const userId = context.userId as string;

    // a. amount (Req 5.2/5.3)
    const parsed = parseAmount(data.get("amount"), DEPOSIT_AMOUNT_MIN);
    if (!parsed.ok) throw new RequestError("invalid_amount");

    // b. method (Req 5.6)
    const method = data.get("method");
    if (!isDepositMethod(method)) throw new RequestError("invalid_method");

    // c. optional proof (Req 5.4/5.7)
    const rawFile = data.get("proof");
    const proofFile = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
    if (proofFile) {
      const check = validateProof({ mimeType: proofFile.type, byteSize: proofFile.size });
      if (!check.ok) throw new RequestError("invalid_proof");
    }

    // d. 60s dedupe (Req 5.8) — return the existing pending row, no new row
    const dup = await findRecentDuplicateDeposit(supabase, {
      userId,
      amount: parsed.value,
      method,
    });
    if (dup) {
      return { request: projectRow(dup, "deposit"), deduped: true };
    }

    // e. upload proof if present; fail closed (Req 5.4)
    let proofUrl: string | null = null;
    if (proofFile) {
      proofUrl = await uploadProof(supabase, userId, "deposits", proofFile);
      if (!proofUrl) throw new RequestError("internal");
    }

    // f. insert via RLS-enforced user client (Req 5.1, 4.4)
    const { data: inserted, error } = await supabase
      .from("deposit_requests")
      .insert({
        user_id: userId,
        amount: Number(parsed.value),
        method,
        proof_url: proofUrl,
      })
      .select("*")
      .single();

    if (error || !inserted) throw new RequestError("internal");
    return { request: projectRow(inserted, "deposit") };
  });

// ---------------------------------------------------------------------------
// 2) Submit withdrawal (Req 6) — adds the available-balance guard
// ---------------------------------------------------------------------------

export const submitWithdrawalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((fd: FormData) => fd)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SupabaseClient<Database>;
    const userId = context.userId as string;

    // a. amount (Req 6.2/6.3)
    const parsed = parseAmount(data.get("amount"), WITHDRAWAL_AMOUNT_MIN);
    if (!parsed.ok) throw new RequestError("invalid_amount");

    // b. method (Req 6.6)
    const method = data.get("method");
    if (!isWithdrawalMethod(method)) throw new RequestError("invalid_method");

    // b2. payout lock + conversion rate — read the settings singleton once.
    // The lock is enforced server-side so it can't be bypassed by calling the
    // API directly while the UI is gated.
    const { data: settings, error: settingsErr } = await supabase
      .from("app_settings")
      .select("seed_to_usdt, payout_anchor, payout_lock_enabled, payout_timezone")
      .eq("id", true)
      .maybeSingle();
    if (settingsErr) throw new RequestError("internal");

    const lock = getPayoutLockState(new Date(), {
      anchor: settings?.payout_anchor ?? DEFAULT_PAYOUT_ANCHOR,
      lockEnabled: settings?.payout_lock_enabled ?? true,
      timeZone: settings?.payout_timezone ?? DEFAULT_PAYOUT_TIMEZONE,
    });
    if (lock.locked) throw new RequestError("withdrawals_locked");

    // Freeze the conversion rate + USDT payout at request time so a later rate
    // change never alters this request.
    const rate = Number(settings?.seed_to_usdt ?? 0) > 0 ? Number(settings!.seed_to_usdt) : 1;
    const seedAmount = Number(parsed.value);
    const amountUsdt = Math.round(seedAmount * rate * 100) / 100;

    // c. optional proof (Req 6.4)
    const rawFile = data.get("proof");
    const proofFile = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
    if (proofFile) {
      const check = validateProof({ mimeType: proofFile.type, byteSize: proofFile.size });
      if (!check.ok) throw new RequestError("invalid_proof");
    }

    // d. available-balance guard (Req 6.7, 9.4) — never moves money
    const { data: wallet, error: walletErr } = await supabase
      .from("wallets")
      .select("balance, locked")
      .eq("user_id", userId)
      .eq("kind", "primary")
      .maybeSingle();
    if (walletErr) throw new RequestError("internal");

    const available =
      Number(wallet?.balance ?? 0) - Number(wallet?.locked ?? 0);
    if (Number(parsed.value) > available) {
      throw new RequestError("insufficient_balance");
    }

    // e. upload proof if present; fail closed
    let proofUrl: string | null = null;
    if (proofFile) {
      proofUrl = await uploadProof(supabase, userId, "withdrawals", proofFile);
      if (!proofUrl) throw new RequestError("internal");
    }

    // f. insert withdrawal row (Req 6.1)
    const { data: inserted, error } = await supabase
      .from("withdrawal_requests")
      .insert({
        user_id: userId,
        amount: seedAmount,
        method,
        proof_url: proofUrl,
        locked_rate: rate,
        amount_usdt: amountUsdt,
      })
      .select("*")
      .single();

    if (error || !inserted) throw new RequestError("internal");
    return { request: projectRow(inserted, "withdrawal") };
  });

// ---------------------------------------------------------------------------
// 3) List my requests (Req 7) — merge + sort + keyset pagination
// ---------------------------------------------------------------------------

export const listMyRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(listInput)
  .handler(async ({ data, context }): Promise<HistoryPage> => {
    const supabase = context.supabase as SupabaseClient<Database>;

    const limit = data.limit ?? 20;
    const cursor = data.cursor ? decodeCursor(data.cursor) : null;

    // Build a per-table keyset query: rows strictly older than the cursor in
    // (created_at, id) DESC order. Over-fetch `limit` from each table so the
    // merged first page is correct (any next-page row is within its table's
    // top `limit` after the cursor).
    const buildQuery = (table: "deposit_requests" | "withdrawal_requests") => {
      let q = supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      if (cursor) {
        q = q.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
        );
      }
      return q;
    };

    const [deposits, withdrawals] = await Promise.all([
      buildQuery("deposit_requests"),
      buildQuery("withdrawal_requests"),
    ]);

    if (deposits.error || withdrawals.error) {
      throw new RequestError("internal");
    }

    const rows: RequestRow[] = [
      ...(deposits.data ?? []).map((r) => projectRow(r, "deposit")),
      ...(withdrawals.data ?? []).map((r) => projectRow(r, "withdrawal")),
    ];

    return pageFrom(mergeAndSort(rows), cursor, limit);
  });
