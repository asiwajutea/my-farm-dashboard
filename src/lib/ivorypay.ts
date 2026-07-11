/**
 * IvoryPay — server-only API client.
 * Docs: https://ivorypay.gitbook.io/ivorypay-api-documentation/merchant-endpoints/transactions
 *
 * We use CHECKOUT mode so IvoryPay hosts the payment page.
 * The customer selects crypto/network on their side; we just redirect.
 *
 * Base URL: https://api.ivorypay.io/api/v1
 */

import { createHmac } from "node:crypto";

const BASE_URL = "https://api.ivorypay.io/api/v1";

function getSecretKey(): string {
  const key = process.env.IVORYPAY_SECRET_KEY;
  if (!key) throw new Error("IVORYPAY_SECRET_KEY is not configured");
  return key;
}

function authHeaders(): HeadersInit {
  return {
    "Authorization": getSecretKey(),
    "Content-Type":  "application/json",
    "Accept":        "application/json",
  };
}

// ── Types ──────────────────────────────────────────────────────────────────

export type CreateTransactionInput = {
  /** Amount in baseFiat currency (e.g. USD) */
  amount:        number;
  email:         string;
  firstName:     string;
  lastName:      string;
  /** ISO-4217 fiat base currency for amount (e.g. "USD") */
  baseFiat:      string;
  /** Crypto token to collect in (e.g. "USDT") */
  crypto:        string;
  /** Your 32-char reference — stored as the deposit_requests.id */
  reference:     string;
  /** URL to redirect customer after successful payment */
  redirect_url?: string;
};

export type CheckoutTransaction = {
  reference:   string;
  checkoutUrl: string;   // redirect customer here
  channel:     "CRYPTO";
  status:      "PENDING";
};

export type VerifyResult = {
  reference:              string;
  status:                 "SUCCESS" | "FAILED" | "EXPIRED" | "PENDING" | "PROCESSING" | "CONFIRMING" | "MISMATCH";
  channel:                "CRYPTO" | "FIAT";
  settledAmountInCrypto?: number;
  currency?:              string;
  completedAt?:           string;
};

export type IvoryPayWebhookPayload = {
  event: string;  // e.g. "cryptoCollection.success"
  data: {
    reference:               string;
    status:                  string;
    token?:                  string;
    settledAmountInCrypto?:  number;
    receivedAmountInCrypto?: number;
    expectedAmountInCrypto?: number;
    environment?:            string;
    completedAt?:            string;
    failureReason?:          string | null;
    metadata?:               Record<string, unknown>;
  };
};

// ── API calls ──────────────────────────────────────────────────────────────

/**
 * Create a CHECKOUT-mode transaction.
 * Returns a `checkoutUrl` — redirect the user there.
 */
export async function createCheckoutTransaction(
  input: CreateTransactionInput,
): Promise<CheckoutTransaction> {
  const body = {
    amount:      input.amount,
    email:       input.email,
    firstName:   input.firstName,
    lastName:    input.lastName,
    type:        "CRYPTO",
    mode:        "CHECKOUT",
    baseFiat:    input.baseFiat,
    crypto:      input.crypto,
    reference:   input.reference,
    ...(input.redirect_url ? { redirect_url: input.redirect_url } : {}),
  };

  const res = await fetch(`${BASE_URL}/transactions`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });

  const json = await res.json() as { success: boolean; message: string; data: CheckoutTransaction };

  if (!res.ok || !json.success) {
    throw new Error(`IvoryPay createTransaction failed: ${json.message ?? res.statusText}`);
  }

  return json.data;
}

/**
 * Verify transaction status by reference (no auth required by IvoryPay).
 */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const res = await fetch(`${BASE_URL}/transactions/${encodeURIComponent(reference)}/verify`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  const json = await res.json() as { success: boolean; message: string; data: VerifyResult };

  if (!res.ok || !json.success) {
    throw new Error(`IvoryPay verifyTransaction failed: ${json.message ?? res.statusText}`);
  }

  return json.data;
}

/**
 * Verify the `x-ivorypay-signature` webhook header.
 *
 * IvoryPay signs with HMAC-SHA512 of JSON.stringify(payload.data)
 * using your secret key.
 */
export function verifyWebhookSignature(
  dataPayload: unknown,
  signatureHeader: string | null | undefined,
): boolean {
  if (!signatureHeader) return false;
  const secretKey = process.env.IVORYPAY_SECRET_KEY;
  if (!secretKey) return false;

  const body = JSON.stringify(dataPayload);
  const expected = createHmac("sha512", secretKey).update(body).digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}
