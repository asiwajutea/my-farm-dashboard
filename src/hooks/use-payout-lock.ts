import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PAYOUT_ANCHOR,
  DEFAULT_PAYOUT_TIMEZONE,
  getPayoutLockState,
  type PayoutLockState,
} from "@/lib/payout";

/**
 * Reads the payout schedule from app_settings (publicly readable) and derives
 * the current withdrawal lock state. Re-evaluates every minute so the portal
 * locks/reopens at the Thursday/Saturday boundaries without a manual reload.
 */
export function usePayoutLock() {
  return useQuery<PayoutLockState>({
    queryKey: ["payout-lock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("payout_anchor, payout_lock_enabled, payout_timezone")
        .maybeSingle();
      return getPayoutLockState(new Date(), {
        anchor: data?.payout_anchor ?? DEFAULT_PAYOUT_ANCHOR,
        lockEnabled: data?.payout_lock_enabled ?? true,
        timeZone: data?.payout_timezone ?? DEFAULT_PAYOUT_TIMEZONE,
      });
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
