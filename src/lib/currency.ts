// Shared Seed <-> USDT conversion + formatting helpers.
//
// The platform ledger is denominated in **Seed**. `app_settings.seed_to_usdt`
// is the USDT value of 1 Seed, so:
//   usdt = seed * rate
//   seed = usdt / rate
//
// Pure module (no I/O) — safe to import from both client and server code.

/** USDT value of a Seed amount. */
export function seedToUsdt(seed: number, rate: number): number {
  return seed * rate;
}

/** Seed value of a USDT amount. Guards against a zero/invalid rate. */
export function usdtToSeed(usdt: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return usdt / rate;
}

/** Format a number with thousands separators and fixed decimals. */
export function fmtAmount(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return (0).toFixed(decimals);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** `123.45 USDT` */
export function fmtUsdt(n: number): string {
  return `${fmtAmount(n, 2)} USDT`;
}

/** `1,234.56 Seed` (Seed shown to 2 dp for UI consistency). */
export function fmtSeed(n: number, decimals = 2): string {
  return `${fmtAmount(n, decimals)} Seed`;
}

/**
 * Convert a USDT amount to a Seed amount string rounded to 2 decimals, suitable
 * for submitting to the Seed-denominated request APIs (which accept a 2-dp
 * string and validate via parseAmount).
 */
export function usdtToSeedString(usdt: number, rate: number): string {
  return usdtToSeed(usdt, rate).toFixed(2);
}
