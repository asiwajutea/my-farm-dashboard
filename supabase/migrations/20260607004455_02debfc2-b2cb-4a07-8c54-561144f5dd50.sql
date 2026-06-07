-- Trigger-only / internal helpers — no client should call these directly.
REVOKE ALL ON FUNCTION public.generate_referral_code()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_profile_fields()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column()       FROM PUBLIC, anon, authenticated;

-- Money mutators — service role only (server functions).
REVOKE ALL ON FUNCTION public.wallet_transfer(uuid, uuid, numeric, public.ledger_kind, public.ledger_kind, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_adjust(uuid, numeric, public.ledger_kind, text, text, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.wallet_transfer(uuid, uuid, numeric, public.ledger_kind, public.ledger_kind, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_adjust(uuid, numeric, public.ledger_kind, text, text, uuid) TO service_role;

-- find_profile_by_handle stays open to signed-in users (P2P handle lookup is
-- the whole point of this function). Re-grant explicitly for clarity.
REVOKE ALL ON FUNCTION public.find_profile_by_handle(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_profile_by_handle(text) TO authenticated, service_role;