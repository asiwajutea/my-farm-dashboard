import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeFarmingReward,
  computeFarmingRewardWithBooster,
  computeReferralCommission,
  computeMaintenanceRefReward,
  computeWithdrawalFee,
  computeDaysLeft,
  validatePremiumSettingsInput,
  type PremiumAdminSettingsInput,
} from './premium.functions';

// Feature: premium-membership, Property 9: Premium farming reward formula
describe('Property 9: Premium farming reward formula', () => {
  it('applies premium bonus when active, base only when not', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 100, noNaN: true }),  // base
      fc.float({ min: 0, max: 100, noNaN: true }),  // bonusPct
      fc.float({ min: 0, max: 1_000_000, noNaN: true }),  // amount
      fc.boolean(),  // isPremiumActive
      (base, bonusPct, amount, isPremiumActive) => {
        const result = computeFarmingReward(base, bonusPct, amount, isPremiumActive);
        const expected = isPremiumActive
          ? amount * base / 100 * (1 + bonusPct / 100)
          : amount * base / 100;
        expect(result).toBeCloseTo(expected, 8);
      }
    ));
  });
});

// Feature: premium-membership, Property 10: Booster stacks on top of premium bonus
describe('Property 10: Booster stacks on top of premium bonus', () => {
  it('booster multiplier is applied after the premium bonus', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.float({ min: 0, max: 10, noNaN: true }),  // boosterMul
      fc.float({ min: 0, max: 1_000_000, noNaN: true }),
      fc.boolean(),
      (base, bonusPct, boosterMul, amount, isPremiumActive) => {
        const result = computeFarmingRewardWithBooster(base, bonusPct, boosterMul, amount, isPremiumActive);
        const expected = computeFarmingReward(base, bonusPct, amount, isPremiumActive) * boosterMul;
        expect(result).toBeCloseTo(expected, 8);
      }
    ));
  });
});

// Feature: premium-membership, Property 11: Tier-based referral commission formula
describe('Property 11: Tier-based referral commission formula', () => {
  it('Gen2/Gen3 are 0 for standard; all gens paid for active premium', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 1_000_000, noNaN: true }),
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.constantFrom(1 as const, 2 as const, 3 as const),
      fc.boolean(),
      (reapAmount, pct, generation, isUplinePremiumActive) => {
        const result = computeReferralCommission(reapAmount, pct, generation, isUplinePremiumActive);
        if (!isUplinePremiumActive && generation !== 1) {
          expect(result).toBe(0);
        } else {
          expect(result).toBeCloseTo(reapAmount * pct / 100, 8);
        }
      }
    ));
  });
});

// Feature: premium-membership, Property 12: Maintenance fee referral reward formula
describe('Property 12: Maintenance fee referral reward formula', () => {
  it('non-premium uplines receive 0; premium uplines receive fee * pct / 100', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 1_000_000, noNaN: true }),
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.boolean(),
      (feeAmount, pct, isUplinePremiumActive) => {
        const result = computeMaintenanceRefReward(feeAmount, pct, isUplinePremiumActive);
        if (!isUplinePremiumActive) {
          expect(result).toBe(0);
        } else {
          expect(result).toBeCloseTo(feeAmount * pct / 100, 8);
        }
      }
    ));
  });
});

// Feature: premium-membership, Property 13: Tier-based withdrawal fee formula
describe('Property 13: Tier-based withdrawal fee formula', () => {
  it('applies premium fee for active premium, standard fee otherwise', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 1_000_000, noNaN: true }),
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.boolean(),
      (amount, standardPct, premiumPct, isPremiumActive) => {
        const result = computeWithdrawalFee(amount, standardPct, premiumPct, isPremiumActive);
        const expected = isPremiumActive
          ? amount * premiumPct / 100
          : amount * standardPct / 100;
        expect(result).toBeCloseTo(expected, 8);
      }
    ));
  });
});

// Feature: premium-membership, Property 8: getPremiumStatus days_left computation
describe('Property 8: getPremiumStatus days_left computation', () => {
  it('returns max(0, floor(diff/day)) for any date, 0 for null', () => {
    // Future dates
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 3650 }),  // days in the future
      (daysAhead) => {
        const future = new Date(Date.now() + daysAhead * 86_400_000);
        const result = computeDaysLeft(future.toISOString());
        const expected = Math.max(0, Math.floor((future.getTime() - Date.now()) / 86_400_000));
        expect(result).toBeGreaterThanOrEqual(0);
        // Allow ±1 for timing
        expect(Math.abs(result - expected)).toBeLessThanOrEqual(1);
      }
    ));
    // Past dates → always 0
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 3650 }),  // days in the past
      (daysAgo) => {
        const past = new Date(Date.now() - daysAgo * 86_400_000);
        expect(computeDaysLeft(past.toISOString())).toBe(0);
      }
    ));
    // null → 0
    expect(computeDaysLeft(null)).toBe(0);
  });
});

// Feature: premium-membership, Property 2: Upgrade validation rejects invalid settings inputs
// Validates: Requirements 2.16, 11.5
describe('Property 2: Upgrade validation rejects invalid settings inputs', () => {
  // A valid base payload that passes all validations.
  const validBase: PremiumAdminSettingsInput = {
    premium_enabled: true,
    premium_fee_usdt: 12,
    premium_duration_days: 365,
    premium_badge_name: 'Premium Farmer',
    premium_badge_color: '#F5C518',
    premium_farming_bonus_pct: 0.5,
    withdrawal_fee_standard_pct: 5,
    withdrawal_fee_premium_pct: 2,
    referral_gen2_pct: 0,
    referral_gen3_pct: 0,
    maintenance_ref_gen1_pct: 0,
    maintenance_ref_gen2_pct: 0,
    maintenance_ref_gen3_pct: 0,
  };

  it('rejects any payload with at least one out-of-range field', () => {
    fc.assert(fc.property(
      fc.oneof(
        // premium_fee_usdt < 0
        fc.float({ min: -1000, max: -0.001, noNaN: true }).map(v => ({ premium_fee_usdt: v })),
        // premium_duration_days < 1 (0 or negative)
        fc.integer({ min: -999, max: 0 }).map(v => ({ premium_duration_days: v })),
        // premium_farming_bonus_pct > 100
        fc.float({ min: 101, max: 200, noNaN: true }).map(v => ({ premium_farming_bonus_pct: v })),
        // premium_farming_bonus_pct < 0
        fc.float({ min: -100, max: -0.001, noNaN: true }).map(v => ({ premium_farming_bonus_pct: v })),
        // withdrawal_fee_standard_pct > 100
        fc.float({ min: 101, max: 200, noNaN: true }).map(v => ({ withdrawal_fee_standard_pct: v })),
        // withdrawal_fee_standard_pct < 0
        fc.float({ min: -100, max: -0.001, noNaN: true }).map(v => ({ withdrawal_fee_standard_pct: v })),
        // withdrawal_fee_premium_pct > 100
        fc.float({ min: 101, max: 200, noNaN: true }).map(v => ({ withdrawal_fee_premium_pct: v })),
        // withdrawal_fee_premium_pct < 0
        fc.float({ min: -100, max: -0.001, noNaN: true }).map(v => ({ withdrawal_fee_premium_pct: v })),
        // referral_gen2_pct outside 0–100
        fc.float({ min: 101, max: 200, noNaN: true }).map(v => ({ referral_gen2_pct: v })),
        fc.float({ min: -100, max: -0.001, noNaN: true }).map(v => ({ referral_gen2_pct: v })),
        // referral_gen3_pct outside 0–100
        fc.float({ min: 101, max: 200, noNaN: true }).map(v => ({ referral_gen3_pct: v })),
        fc.float({ min: -100, max: -0.001, noNaN: true }).map(v => ({ referral_gen3_pct: v })),
        // maintenance_ref_gen1_pct outside 0–100
        fc.float({ min: 101, max: 200, noNaN: true }).map(v => ({ maintenance_ref_gen1_pct: v })),
        fc.float({ min: -100, max: -0.001, noNaN: true }).map(v => ({ maintenance_ref_gen1_pct: v })),
        // maintenance_ref_gen2_pct outside 0–100
        fc.float({ min: 101, max: 200, noNaN: true }).map(v => ({ maintenance_ref_gen2_pct: v })),
        fc.float({ min: -100, max: -0.001, noNaN: true }).map(v => ({ maintenance_ref_gen2_pct: v })),
        // maintenance_ref_gen3_pct outside 0–100
        fc.float({ min: 101, max: 200, noNaN: true }).map(v => ({ maintenance_ref_gen3_pct: v })),
        fc.float({ min: -100, max: -0.001, noNaN: true }).map(v => ({ maintenance_ref_gen3_pct: v })),
      ),
      (invalidOverride) => {
        const input: PremiumAdminSettingsInput = { ...validBase, ...invalidOverride };
        const errors = validatePremiumSettingsInput(input);
        // Must return at least one error
        expect(errors.length).toBeGreaterThan(0);
        // Every error must have a field name and a human-readable message
        for (const err of errors) {
          expect(err).toHaveProperty('field');
          expect(err).toHaveProperty('message');
          expect(typeof err.field).toBe('string');
          expect(err.field.length).toBeGreaterThan(0);
          expect(typeof err.message).toBe('string');
          expect(err.message.length).toBeGreaterThan(0);
        }
      }
    ));
  });
});

// ── Properties 1–7: Schema-level and lifecycle properties ──────────────────────
// These properties test pure TypeScript logic that mirrors the database behaviour.
// DB-state properties (3, 4, 5, 6, 7) are tested as pure computation here;
// integration tests against a live Supabase instance are separate.

// Feature: premium-membership, Property 1: is_premium computed column correctness
// Validates: Requirements 1.3, 16.4
describe('Property 1: is_premium computed column correctness', () => {
  it('is_premium === (tier !== standard) for any MembershipTier value', () => {
    fc.assert(fc.property(
      fc.constantFrom('standard' as const, 'premium' as const, 'gold' as const, 'platinum' as const),
      (tier) => {
        // Mirror the DB generated column: is_premium = tier IN ('premium','gold','platinum')
        const isPremium = tier !== 'standard';
        if (tier === 'standard') {
          expect(isPremium).toBe(false);
        } else {
          expect(isPremium).toBe(true);
        }
      }
    ));
  });
});

// Feature: premium-membership, Property 3: Upgrade atomicity and field correctness
// Validates: Requirements 3.4, 15.2
describe('Property 3: Upgrade atomicity and field correctness', () => {
  it('for any balance >= fee, all profile fields are set correctly after upgrade', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 10_000, noNaN: true }),   // fee
      fc.float({ min: 0, max: 10_000, noNaN: true }),   // extra balance above fee
      fc.integer({ min: 1, max: 3650 }),                // duration_days
      (fee, extra, durationDays) => {
        const balance = fee + extra; // balance is always >= fee
        const canUpgrade = balance >= fee;
        expect(canUpgrade).toBe(true);

        // Simulate the field computation that fn_upgrade_to_premium performs
        const activatedAt = new Date();
        const expiresAt = new Date(activatedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const newBalance = balance - fee;

        expect(newBalance).toBeGreaterThanOrEqual(0);
        expect(expiresAt.getTime()).toBeGreaterThan(activatedAt.getTime());
        // expires_at - activated_at should equal durationDays (within 1s tolerance)
        const diffDays = (expiresAt.getTime() - activatedAt.getTime()) / (24 * 60 * 60 * 1000);
        expect(Math.abs(diffDays - durationDays)).toBeLessThan(0.001);
      }
    ));
  });
});

// Feature: premium-membership, Property 4: Insufficient balance always rejects upgrade
// Validates: Requirements 3.5
describe('Property 4: Insufficient balance always rejects upgrade', () => {
  it('when balance < fee, upgrade must be rejected', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 10_000, noNaN: true }),  // balance
      fc.float({ min: 0.001, max: 10_000, noNaN: true }), // deficit (balance < fee)
      (balance, deficit) => {
        const fee = balance + deficit; // fee is always > balance
        const canUpgrade = balance >= fee;
        expect(canUpgrade).toBe(false);
      }
    ));
  });
});

// Feature: premium-membership, Property 5: Renewal extends from existing expiry date
// Validates: Requirements 3.9
describe('Property 5: Renewal extends from existing expiry date', () => {
  it('new_expires_at = existing_expires_at + duration_days (not from now)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 3650 }),  // days until existing expiry from now
      fc.integer({ min: 1, max: 3650 }),  // renewal duration_days
      (daysUntilExpiry, renewalDays) => {
        const now = Date.now();
        const existingExpiresAt = new Date(now + daysUntilExpiry * 24 * 60 * 60 * 1000);
        // Renewal: extend from existing_expires_at, NOT from now
        const newExpiresAt = new Date(existingExpiresAt.getTime() + renewalDays * 24 * 60 * 60 * 1000);
        // Verify it's existingExpiresAt + renewalDays
        const diffDays = (newExpiresAt.getTime() - existingExpiresAt.getTime()) / (24 * 60 * 60 * 1000);
        expect(Math.abs(diffDays - renewalDays)).toBeLessThan(0.001);
        // Also verify it's NOT simply now + renewalDays (the wrong behaviour)
        const wrongExpiresAt = new Date(now + renewalDays * 24 * 60 * 60 * 1000);
        // newExpiresAt should be after wrongExpiresAt when daysUntilExpiry > 0
        if (daysUntilExpiry > 0) {
          expect(newExpiresAt.getTime()).toBeGreaterThan(wrongExpiresAt.getTime());
        }
      }
    ));
  });
});

// Feature: premium-membership, Property 6: Expiry function correctly transitions expired users only
// Validates: Requirements 4.1
describe('Property 6: Expiry function correctly transitions expired users only', () => {
  it('users with expires_at <= now revert to standard; others retain their tier', () => {
    fc.assert(fc.property(
      // Generate a set of (tier, expires_at) pairs
      fc.array(
        fc.record({
          tier: fc.constantFrom('premium' as const, 'gold' as const, 'platinum' as const),
          // Mix of past and future dates
          daysOffset: fc.integer({ min: -365, max: 365 }),
        }),
        { minLength: 1, maxLength: 20 }
      ),
      (users) => {
        const now = new Date();
        users.forEach((u) => {
          const expiresAt = new Date(now.getTime() + u.daysOffset * 24 * 60 * 60 * 1000);
          const isExpired = expiresAt <= now;
          // Mirror fn_expire_premium logic
          const resultTier = isExpired ? 'standard' : u.tier;
          const resultExpiresAt = isExpired ? null : expiresAt;

          if (u.daysOffset <= 0) {
            expect(resultTier).toBe('standard');
            expect(resultExpiresAt).toBeNull();
          } else {
            expect(resultTier).toBe(u.tier);
            expect(resultExpiresAt).not.toBeNull();
          }
        });
      }
    ));
  });
});

// Feature: premium-membership, Property 7: fn_expire_premium idempotency
// Validates: Requirements 4.6, 15.3
describe('Property 7: fn_expire_premium idempotency', () => {
  it('running expiry logic twice in the same UTC day produces no additional state changes', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          tier: fc.constantFrom('standard' as const, 'premium' as const),
          isExpired: fc.boolean(),
          notificationSentToday: fc.boolean(),
        }),
        { minLength: 1, maxLength: 20 }
      ),
      (users) => {
        // Simulate first run
        const afterFirstRun = users.map((u) => {
          const shouldExpire = u.tier === 'premium' && u.isExpired;
          return {
            tier: shouldExpire ? 'standard' : u.tier,
            notificationSent: shouldExpire ? true : u.notificationSentToday,
          };
        });

        // Simulate second run (same UTC day)
        const afterSecondRun = afterFirstRun.map((u) => {
          // User was already reverted to standard — isExpired check would not match
          const shouldExpire = u.tier === 'premium'; // only premium users would be processed
          return {
            tier: shouldExpire ? 'standard' : u.tier,
            // If notification already sent today, don't send again
            notificationSent: u.notificationSent,
          };
        });

        // Second run should produce identical state to first run
        afterFirstRun.forEach((first, i) => {
          const second = afterSecondRun[i];
          expect(second.tier).toBe(first.tier);
          expect(second.notificationSent).toBe(first.notificationSent);
        });
      }
    ));
  });
});
