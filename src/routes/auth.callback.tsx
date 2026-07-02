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
 * The SDK auto-exchanges the hash and fires either:
 *   - INITIAL_SESSION (with a valid session) — most common path
 *   - SIGNED_IN — also fired after exchange
 *
 * We capture the hash BEFORE subscribing because the SDK clears it
 * immediately when it processes the tokens.
 */
function AuthCallbackPage() {
  const navigate = useNavigate();
  const sendWelcomeFn = useServerFn(sendWelcomeEmailFn);
  const settled = useRef(false);
  const welcomeSent = useRef(false);

  useEffect(() => {
    // Must capture hash synchronously — SDK strips it before the first event fires.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const isSignup = hash.includes("type=signup");
    const hasTokens = hash.includes("access_token");

    async function handleSession(session: { access_token: string; refresh_token: string; user: { email_confirmed_at?: string | null } } | null) {
      if (settled.current) return;
      if (!session) return; // wait for a session-carrying event

      settled.current = true;

      if (isSignup && !welcomeSent.current) {
        welcomeSent.current = true;
        try {
          // Explicitly persist tokens so attachSupabaseAuth reads them via getSession()
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          await sendWelcomeFn();
        } catch (err) {
          console.warn("[auth/callback] Welcome email failed:", err);
        }
      }

      navigate({ to: "/dashboard", replace: true });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // INITIAL_SESSION fires first when the SDK exchanges the hash tokens.
        // SIGNED_IN fires right after. Handle both.
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
          await handleSession(session);
          return;
        }

        if (event === "SIGNED_OUT") {
          if (!settled.current) {
            settled.current = true;
            navigate({ to: "/auth", replace: true });
          }
        }
      },
    );

    // Safety timeout — if the hash had no tokens (e.g. user navigated here directly),
    // or no event fires within 6 s, fall back to a manual session check.
    const timer = setTimeout(async () => {
      if (settled.current) return;
      settled.current = true;
      subscription.unsubscribe();

      if (!hasTokens) {
        // No tokens in URL — just check if they already have a session
        const { data } = await supabase.auth.getSession();
        if (data.session?.user?.email_confirmed_at) {
          navigate({ to: "/dashboard", replace: true });
        } else {
          navigate({ to: "/auth", replace: true });
        }
        return;
      }

      // Had tokens but no event — something went wrong
      navigate({ to: "/auth", replace: true });
    }, 6000);

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
