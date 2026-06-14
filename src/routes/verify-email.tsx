import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, RefreshCw, Sprout, CheckCircle2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import logo from "@/assets/vfarm-logo.png";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ email: z.string().optional() });

export const Route = createFileRoute("/verify-email")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Verify your email · VFarmers" },
      { name: "description", content: "Check your inbox and confirm your email address to start farming." },
    ],
  }),
  component: VerifyEmailPage,
});

const RESEND_COOLDOWN_SECS = 60;

function VerifyEmailPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/verify-email" });
  const email = search.email ?? "";

  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // If already confirmed, go straight to dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email_confirmed_at) {
        navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  // Countdown timer for the resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setResending(true);
    setResendError(null);
    setResendSuccess(false);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      setResendSuccess(true);
      setCooldown(RESEND_COOLDOWN_SECS);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-10">
        {/* Logo */}
        <Link to="/" className="mb-8 flex items-center gap-2.5">
          <img src={logo} alt="VFarmers" className="h-10 w-10" />
          <span className="text-xl font-semibold tracking-tight">
            V<span className="text-primary">Farmers</span>
          </span>
        </Link>

        <div className="glass w-full rounded-3xl p-8 shadow-elegant">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Heading */}
          <div className="mt-5 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Sprout className="h-3.5 w-3.5" />
              Almost there, Farmer!
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to
            </p>
            {email && (
              <p className="mt-1 font-semibold text-foreground break-all">{email}</p>
            )}
          </div>

          {/* Steps */}
          <div className="mt-6 space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4">
            <Step n={1} text="Open the email from VFarmers." />
            <Step n={2} text='Click the "Confirm your email" button inside.' />
            <Step n={3} text="You'll be brought straight to your dashboard." />
          </div>

          {/* Spam notice — prominent, best practice */}
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-300/90 leading-relaxed">
              <span className="font-semibold text-amber-300">Can't find it?</span> Check your{" "}
              <span className="font-medium">spam</span>,{" "}
              <span className="font-medium">junk</span>, or{" "}
              <span className="font-medium">promotions</span> folder. Sometimes confirmation emails land there.
            </p>
          </div>

          {/* Resend section */}
          <div className="mt-5 border-t border-border/40 pt-5">
            {resendSuccess ? (
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                New confirmation email sent. Check your inbox again.
              </div>
            ) : resendError ? (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {resendError}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0 || !email}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : resending
                  ? "Sending…"
                  : "Resend confirmation email"}
            </button>
            {!email && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Email address not available — please{" "}
                <Link to="/auth" className="text-primary hover:underline">
                  sign up again
                </Link>
                .
              </p>
            )}
          </div>

          {/* Already confirmed */}
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Already confirmed?{" "}
            <Link to="/auth" className="inline-flex items-center gap-1 text-primary hover:underline">
              Sign in <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Wrong email address?{" "}
          <Link to="/auth" className="text-primary hover:underline">
            Start over
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
        {n}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}
