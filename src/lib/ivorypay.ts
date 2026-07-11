/**
 * IvoryPay — server-only API client.
 *
 * NEVER import this from client code. The `.ts` extension (not `.server.ts`)
 * is intentional — TanStack Start tree-shakes it correctly because it is only
 * imported by server functions and API route handlers.
 *
 * Docs: https://api.ivorypay.io/api
 */

const BASE_URL = "https://api.ivorypay.io/api";

function getSecretKey(): string {
  const key = process.env.IVORYPAY_SECRET_KEY;
  if (!key) throw new Error("IVORYPAY_SECRET_KEY is not configured");
  return key;
}

function headers(): HeadersInit {
  return {
    "Authorization": getSecretKey(),
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

// ── Types ──────────────────────────────────────────────────────────────────

export type IvoryPayNetwork =
  | "tron"      // USDT TRC20
  | "ethereum"  // USDT ERC20
  | "bsc";      // BEP20

export type IvoryPayToken = "USDT" | "USDC";

export type CreateTransactionInput = {
  /** Amount in the specified token (e.g. 50.00 USDT) */
  amount: number;
  token: IvoryPayToken;
  network: IvoryPayNetwork;
  /** Your internal reference — stored in metadata.reference for webhook matching */
  reference: string;
  /** URL IvoryPay will POST the webhook event to */
  webhookUrl: string;
  /** URL to redirect the user after payment (optional) */
  redirectUrl?: string;
  /** Customer email (optional, improves IvoryPay's risk scoring) */
  customerEmail?: string;
};

export type IvoryPayTransaction = {
  id: string;
  reference: string;
  amount: number;
  token: string;
  network: string;
  status: "pending" | "processing" | "completed" | "failed" | "expired";
  paymentUrl: string;     // checkout page URL — redirect user here
  walletAddress?: string; // crypto address to send to (if direct transfer)
  createdAt: string;
};

export type IvoryPayWebhookEvent = {
  event: "transaction.completed" | "transaction.failed" | "transaction.processing" | string;
  data: {
    id: string;
    reference: string;
    amount: number;
    amountReceived?: number;
    token: string;
    network: string;
    status: string;
    metadata?: { reference?: string; [k: string]: unknown };
  };
};

// ── API calls ──────────────────────────────────────────────────────────────

/**
 * Create a new payment transaction. Returns the IvoryPay transaction object
 * including the `paymentUrl` the user should be redirected to.
 */
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<IvoryPayTransaction> {
  const body = {
    amount: input.amount,
    token: input.token,
    network: input.network,
    webhookUrl: input.webhookUrl,
    redirectUrl: input.redirectUrl,
    metadata: {
      reference: input.reference,
    },
    ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
  };

  const res = await fetch(`${BASE_URL}/v1/transactions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  const json = await res.json() as { status: boolean; message: string; data: IvoryPayTransaction };
  if (!res.ok || !json.status) {
    throw new Error(`IvoryPay createTransaction failed: ${json.message ?? res.statusText}`);
  }

  return json.data;
}

/**
 * Fetch the current status of a transaction by its IvoryPay transaction ID.
 */
export async function getTransaction(transactionId: string): Promise<IvoryPayTransaction> {
  const res = await fetch(`${BASE_URL}/v1/transactions/${transactionId}`, {
    method: "GET",
    headers: headers(),
  });

  const json = await res.json() as { status: boolean; message: string; data: IvoryPayTransaction };
  if (!res.ok || !json.status) {
    throw new Error(`IvoryPay getTransaction failed: ${json.message ?? res.statusText}`);
  }

  return json.data;
}
