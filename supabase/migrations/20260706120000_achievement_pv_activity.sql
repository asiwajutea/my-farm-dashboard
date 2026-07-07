-- =========================================================
-- Seed the 'achievement_unlock' PV activity so that
-- fn_claim_achievement can insert into pv_ledger without
-- violating the activity_code foreign key constraint.
-- =========================================================

INSERT INTO public.pv_activities (code, label, description, self_points, g1_points, g2_points, g3_points, active)
VALUES (
  'achievement_unlock',
  'Achievement Unlocked',
  'Awarded when a user successfully claims an achievement reward.',
  0,   -- self_points: managed directly by fn_claim_achievement, not via award_pv
  0,   -- g1_points
  0,   -- g2_points
  0,   -- g3_points
  true
)
ON CONFLICT (code) DO NOTHING;
