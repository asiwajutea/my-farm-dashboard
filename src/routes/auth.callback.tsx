import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendWelcomeEmailFn } from "@/lib/email/email.functions";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

/**
 * Landing page for Supabase email confirmation links.
 *
 * Supabase appends session tokens as a URL hash fragment:
 *   /auth/callback#access_token=...&type=signup
 *
 * The SDK processes that hash asynchronously via onAuthStateChange.
 * We subscribe first, then wait for SIGNED_IN before redirecting so
 * the _authenticated route's beforeLoad always finds an established session.
 */
function AuthCallbackPage() {
  const navigate = useNavigate();
  const sendWelcomeFn = useServerFn(sendWelcomeEmailFn);
  const settled = useRef(false);
  const welcomeSent = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (settled.current) return;

        if (event === "SIGNED_IN" && session?.user) {
          settled.current = true;
          subscription.unsubscribe();

          // Send welcome email once for brand-new sign-ups
          const hash = typeof window !== "undefined" ? window.location.hash : "";
          const isSignup = hash.includes("type=signup");
          if (isSignup && !welcomeSent.current) {
            welcomeSent.current = true;
            try { await sendWelcomeFn(); } catch { /* non-fatal */ }
          }

          navigate({ to: "/dashboard", replace: true });
          return;
        }

        // Exchange failed or user not authenticated
        if (event === "SIGNED_OUT") {
          settled.current = true;
          subscription.unsubscribe();
          navigate({ to: "/auth", replace: true });
        }
      },
    );

    // Safety timeout — if no auth event in 5 s, fall back to a manual check
    const timer = setTimeout(async () => {
      if (settled.current) return;
      settled.current = true;
      subscription.unsubscribe();

      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.email_confirmed_at) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        navigate({ to: "/auth", replace: true });
      }
    }, 5000);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [navigate, sendWelcomeFn]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Confirming your account…</p>
      </div>
    </div>
  );
}
