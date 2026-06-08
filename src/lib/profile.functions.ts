import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const usernameInput = z.object({ username: z.string().min(1).max(40) });

// Live username-availability check. profiles RLS only lets a Farmer read their
// own row, so the lookup goes through a SECURITY DEFINER RPC that checks every
// profile (case-insensitively) while excluding the caller's own handle.
export const checkUsernameAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => usernameInput.parse(d))
  .handler(async ({ data, context }): Promise<{ available: boolean; valid: boolean }> => {
    const handle = data.username.trim().toLowerCase();
    const valid = /^[a-z0-9_]{3,24}$/.test(handle);
    if (!valid) return { available: false, valid: false };
    const { data: available, error } = await context.supabase.rpc("is_username_available", {
      p_username: handle,
    });
    if (error) throw new Error(error.message);
    return { available: available === true, valid: true };
  });
