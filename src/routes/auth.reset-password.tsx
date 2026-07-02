import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Sprout } from "lucide-react";
import logo from "@/assets/vfarm-logo.png";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password · VFarmers" },
      { name: "description", content: "Choose a new password for your VFarmers account." },
    ],
  }),
  component: ResetPasswordPage,
});

type PageState = "loading" | "ready" | "success" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settled = useRef(false);

  // Supabase fires SIGNED_IN with type=recovery when it exchanges the hash tokens.
  // We wait for that event before showing the form.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled.current) return;

      if (event === "SIGNED_IN" && session) {
        // Confirm this is a password recovery session, not a normal sign-in
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const isRecovery = hash.includes("type=recovery");
        if (isRecovery) {
          settled.current = true;
          setPageState("ready");
        }
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        // Some Supabase versions fire this event specifically for recovery flows
        settled.current = true;
        setPageState("ready");
      }
    });

    // Fallback: if the page already has a session with a recovery token
    // (e.g. user refreshed the page), check manually
    const timer = setTimeout(async () => {
      if (settled.current) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        settled.current = true;
        setPageState("ready");
      } else {
        settled.current = true;
        setPageState("invalid");
      }
    }, 4000);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPageState("success");
      // Auto-navigate to dashboard after a moment
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password. Please try again.");
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

          {/* ── Loading ── */}
          {pageState === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
            </div>
          )}

          {/* ── Invalid / expired link ── */}
          {pageState === "invalid" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Link expired or invalid</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  This password reset link has expired or already been used.
                  Request a new one below.
                </p>
              </div>
              <Link
                to="/forgot-password"
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01]"
              >
                Request a new link
              </Link>
              <Link to="/auth" className="text-xs text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          )}

          {/* ── Success ── */}
          {pageState === "success" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Password updated!</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Your password has been changed. Redirecting you to the dashboard…
                </p>
              </div>
              <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
            </div>
          )}

          {/* ── New password form ── */}
          {pageState === "ready" && (
            <>
              <div className="text-center">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                  <Sprout className="h-3.5 w-3.5" />
                  New Password
                </div>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight">Set a new password</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Choose something strong — at least 6 characters.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                {/* New password */}
                <label className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 focus-within:border-primary/60">
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </label>

                {/* Confirm password */}
                <label className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 focus-within:border-primary/60">
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
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
                    "Update password"
                  )}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
