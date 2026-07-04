import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowLeft, Loader2, CheckCircle2, Sprout, ShieldCheck } from "lucide-react";
import logo from "@/assets/vfarm-logo.png";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password · VFarmers" },
      { name: "description", content: "Reset your VFarmers account password." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // Supabase will append #access_token=...&type=recovery to this URL
        redirectTo: "https://vfarmers.app/auth/reset-password",
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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

        <div className="glass w-full rounded-3xl p-7 shadow-elegant">
          {sent ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  We sent a password reset link to{" "}
                  <span className="font-semibold text-foreground">{email}</span>.
                  <br />
                  The link expires in 1 hour.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Can't find it? Check your spam or junk folder.
              </p>
              <Link
                to="/auth"
                className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Request form ── */
            <>
              <div className="text-center">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                  <Sprout className="h-3.5 w-3.5" />
                  Password Reset
                </div>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight">Forgot your password?</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <label className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 focus-within:border-primary/60">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </label>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send reset link"
                  )}
                </button>
              </form>

              <div className="mt-5 text-center text-xs text-muted-foreground">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </Link>
              </div>

              <div className="mt-3 border-t border-border/40 pt-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Set up a recovery phrase?{" "}
                  <Link
                    to="/auth/recover-with-phrase"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Recover with phrase instead
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
