import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin detection lives in its OWN module, deliberately tiny and free of any
// server-only imports (no `supabaseAdmin` / `client.server`). It is consumed by
// the always-loaded `useIsAdmin` hook + sidebar. Keeping it isolated from the
// large `admin.functions.ts` module prevents an unrelated change there from
// affecting the client reference for this server function.
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (error) return { isAdmin: false };
    return { isAdmin: data === true };
  });
