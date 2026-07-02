import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sprout, Mail, Lock, ArrowRight, Loader2, Ticket, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/vfarm-logo.png";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ReferrerPreview } from "@/components/affiliate/ReferrerPreview";
import { getDefaultReferralCode } from "@/lib/affiliate.functions";

const searchSchema = z.object({ ref: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · VFarmers" },
      { name: "description", content: "Sign in or create your VFarmers Farmer account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<Mode>(search.ref ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState((search.ref ?? "").toUpperCase());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const getDefaultCodeFn = useServerFn(getDefaultReferralCode);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const trimmedFull = fullName.trim();
        const firstName = trimmedFull.split(/\s+/)[0] || trimmedFull || email.split("@")[0];

        // If no affiliate code entered, silently assign the default referrer
        let finalCode = referralCode.trim();
        if (!finalCode) {
          try {
            finalCode = (await getDefaultCodeFn()) ?? "";
          } catch {
            // Non-fatal — proceed without referral if lookup fails
            finalCode = "";
          }
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `https://vfarmers.app/auth/callback`,
            data: {
              full_name: trimmedFull,
              display_name: firstName,
              referral_code: finalCode || undefined,
            },
          },
        });
        if (error) throw error;
        // Email confirmation is currently disabled — go straight to welcome
        const displayName = signUpData.user?.user_metadata?.display_name ?? firstName;
        navigate({ to: "/welcome", search: { name: displayName } });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Check if user has merchant role — show picker if both farmer and merchant
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .in("role", ["farmer", "merchant"]);
        const roleList = (roles ?? []).map((r) => r.role);
        const hasMerchant = roleList.includes("merchant");
        const hasFarmer = roleList.includes("farmer");
        if (hasMerchant && hasFarmer) {
          navigate({ to: "/select-dashboard" });
        } else if (hasMerchant) {
          navigate({ to: "/merchant/dashboard" });
        } else {
          navigate({ to: "/dashboard" });
        }      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Google auth is temporarily disabled
  // const handleGoogle = async () => { ... };

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-10">
        <Link to="/" className="mb-8 flex items-center gap-2.5">
          <img src={logo} alt="VFarmers" className="h-10 w-10" />
          <span className="text-xl font-semibold tracking-tight">
            V<span className="text-primary">Farmers</span>
          </span>
        </Link>

        <div className="glass w-full rounded-3xl p-7 shadow-elegant">
          <div className="text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Sprout className="h-3.5 w-3.5" />
              {mode === "signin" ? "Welcome back, Farmer" : "Become a Farmer"}
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Sign in to VFarmers" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Continue cultivating your Seeds."
                : "Plant your first Seed in seconds."}
            </p>
          </div>
          <br></br>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <Field
                    icon={Sprout}
                    type="text"
                    placeholder="Farmer full name"
                    value={fullName}
                    onChange={setFullName}
                    required
                  />
                  <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
                    Enter your first name and surname — e.g. <span className="font-medium text-foreground/70">John Doe</span>
                  </p>
                </div>
                <Field
                  icon={Ticket}
                  type="text"
                  placeholder="Affiliate code (optional)"
                  value={referralCode}
                  onChange={(v) => setReferralCode(v.toUpperCase())}
                />
                <ReferrerPreview code={referralCode} />
              </>
            )}
            <Field
              icon={Mail}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              required
            />
            <Field
              icon={Lock}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={setPassword}
              required
              minLength={6}
              onToggleVisibility={() => setShowPassword((v) => !v)}
              visible={showPassword}
            />

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
                <>
                  {mode === "signin" ? "Sign in" : "Create account"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
                  Create a Farmer account
                </button>
                {" · "}
                <Link to="/merchant-signup" className="text-amber-400 hover:underline">
                  Become a Merchant
                </Link>
              </>
            ) : (
              <>
                Already a Farmer?{" "}
                <button type="button" onClick={() => setMode("signin")} className="text-primary hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          By continuing you agree to VFarmers's{" "}
          <a href="/terms" className="underline hover:text-foreground" target="_blank" rel="noreferrer">
            Terms
          </a>
          ,{" "}
          <a href="/privacy" className="underline hover:text-foreground" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="/risk-disclosure" className="underline hover:text-foreground" target="_blank" rel="noreferrer">
            Risk Disclosure
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  required,
  minLength,
  onToggleVisibility,
  visible,
}: {
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  onToggleVisibility?: () => void;
  visible?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 focus-within:border-primary/60">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {onToggleVisibility && (
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={visible ? "Hide password" : "Show password"}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </label>
  );
}

