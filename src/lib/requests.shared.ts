// Shared validation contract for deposit/withdrawal requests.
//
// This module is imported by BOTH client (wallet UI) and server (server fns)
// code. It MUST remain pure: constants, zod schemas, and pure validators only.
// It references NO `process.env` at module scope (Req 13.1) and performs no I/O.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEPOSIT_METHODS = [
  "bank_transfer",
  "usdt_trc20",
  "usdt_erc20",
  "card",
] as const;

export const WITHDRAWAL_METHODS = [
  "bank_transfer",
  "usdt_trc20",
  "usdt_erc20",
] as const;

export type DepositMethod = (typeof DEPOSIT_METHODS)[number];
export type WithdrawalMethod = (typeof WITHDRAWAL_METHODS)[number];

export const AMOUNT_MAX = 999_999_999.99; // Req 5.2 / 6.2 upper bound
export const DEPOSIT_AMOUNT_MIN = 0.01; // amount > 0, smallest 2-dp value (Req 5.2)
export const WITHDRAWAL_AMOUNT_MIN = 0.01; // Req 6.2
export const METHOD_MAX_LEN = 30; // Req 6.6 (withdrawal); deposit <= 50 at DB level
export const PROOF_MAX_BYTES = 10 * 1024 * 1024; // 10 MB (Req 5.4/5.7, 6.4)
export const PROOF_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
export const DEDUPE_WINDOW_MS = 60_000; // Req 5.8

export type ProofMime = (typeof PROOF_MIME)[number];

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type RequestType = "deposit" | "withdrawal";
export type RequestStatus = "pending" | "approved" | "rejected";

export type RequestRow = {
  id: string;
  type: RequestType;
  amount: string; // normalized 2-dp string
  method: string;
  status: RequestStatus;
  proof_url: string | null;
  created_at: string; // ISO timestamp
};

export type SubmitResult = { request: RequestRow; deduped?: boolean };
export type HistoryPage = { items: RequestRow[]; nextCursor: string | null };

export type RequestErrorCode =
  | "invalid_amount"
  | "invalid_method"
  | "invalid_proof"
  | "insufficient_balance"
  | "unauthorized"
  | "internal";

// ---------------------------------------------------------------------------
// Amount validation (Req 5.2/5.3, 6.2/6.3)
// ---------------------------------------------------------------------------

export type AmountErrorCode =
  | "not_numeric"
  | "too_small"
  | "too_large"
  | "too_many_decimals";

export type ParseAmountResult =
  | { ok: true; value: string }
  | { ok: false; code: AmountErrorCode };

const AMOUNT_PATTERN = /^[+-]?\d+(\.\d+)?$/;

/**
 * Validate a money amount expressed as a string (or number).
 *
 * Accepts iff the value is numeric, lies within [min, AMOUNT_MAX], and has at
 * most two decimal places. On success returns a normalized 2-decimal string
 * that round-trips to the same number. Validation is string-based to avoid
 * floating-point drift.
 */
export function parseAmount(input: unknown, min: number): ParseAmountResult {
  let raw: string;
  if (typeof input === "string") {
    raw = input.trim();
  } else if (typeof input === "number" && Number.isFinite(input)) {
    raw = String(input);
  } else {
    return { ok: false, code: "not_numeric" };
  }

  if (raw === "" || !AMOUNT_PATTERN.test(raw)) {
    return { ok: false, code: "not_numeric" };
  }

  // Decimal-place check before range so 3+ dp values report the right code.
  const [, fracPart = ""] = raw.replace(/^[+-]/, "").split(".");
  if (fracPart.length > 2) {
    return { ok: false, code: "too_many_decimals" };
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { ok: false, code: "not_numeric" };
  }
  if (value < min) {
    return { ok: false, code: "too_small" };
  }
  if (value > AMOUNT_MAX) {
    return { ok: false, code: "too_large" };
  }

  // String-based normalization to exactly 2 decimals (value is non-negative here).
  const unsigned = raw.replace(/^\+/, "");
  const [intRaw, fracRaw = ""] = unsigned.split(".");
  const intNorm = intRaw.replace(/^0+(?=\d)/, ""); // strip leading zeros, keep one
  const fracNorm = (fracRaw + "00").slice(0, 2);
  return { ok: true, value: `${intNorm}.${fracNorm}` };
}

// ---------------------------------------------------------------------------
// Method validation (Req 5.6, 6.6)
// ---------------------------------------------------------------------------

export function isDepositMethod(method: unknown): method is DepositMethod {
  return (
    typeof method === "string" &&
    (DEPOSIT_METHODS as readonly string[]).includes(method)
  );
}

export function isWithdrawalMethod(method: unknown): method is WithdrawalMethod {
  return (
    typeof method === "string" &&
    method.length <= METHOD_MAX_LEN &&
    (WITHDRAWAL_METHODS as readonly string[]).includes(method)
  );
}

// ---------------------------------------------------------------------------
// Proof validation (Req 5.4/5.7, 6.4)
// ---------------------------------------------------------------------------

export type ProofErrorCode = "bad_type" | "too_large";

export type ValidateProofResult =
  | { ok: true }
  | { ok: false; code: ProofErrorCode };

export function validateProof(meta: {
  mimeType: string;
  byteSize: number;
}): ValidateProofResult {
  if (!(PROOF_MIME as readonly string[]).includes(meta.mimeType)) {
    return { ok: false, code: "bad_type" };
  }
  if (
    !Number.isFinite(meta.byteSize) ||
    meta.byteSize <= 0 ||
    meta.byteSize > PROOF_MAX_BYTES
  ) {
    return { ok: false, code: "too_large" };
  }
  return { ok: true };
}

/** Map a proof MIME type to a file extension for storage object naming. */
export function proofExtension(mimeType: ProofMime): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "application/pdf":
      return "pdf";
  }
}

// ---------------------------------------------------------------------------
// Zod schemas (field-shape validation; amount semantics via parseAmount)
// ---------------------------------------------------------------------------

export const depositInput = z.object({
  amount: z.string(),
  method: z.enum(DEPOSIT_METHODS),
});

export const withdrawalInput = z.object({
  amount: z.string(),
  method: z.enum(WITHDRAWAL_METHODS),
});

export const listInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(20),
});

export type ListInput = z.infer<typeof listInput>;
