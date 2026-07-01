import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ArrowRight, Building2, Eye, EyeOff, Loader2, Lock, Mail, Phone, MapPin } from "lucide-react";
import logo from "@/assets/vfarm-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { registerMerchant } from "@/lib/merchant.functions";

const searchSchema = z.object({}).optional();

export const Route = createFileRoute("/merchant-signup")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Merchant Sign Up · VFarmers" }] }),
  component: MerchantSignupPage,
});

type Step = "account" | "business";

function MerchantSignupPage() {
  const navigate = useNavigate();
  const registerFn = useServerFn(registerMerchant);

  const [step, setStep] = useState<Step>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccountStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep("business");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // 1. Sign up with Supabase auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/merchant/dashboard`,
          data: { display_name: contactName, full_name: contactName },
        },
      });
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error("Signup failed");

      // 2. Register merchant profile (session required)
      // Wait for session if user is immediately confirmed
      if (data.session) {
        await registerFn({ data: { businessName, contactName, phone: phone || undefined, city: city || undefined, country: country || undefined } });
        navigate({ to: "/merchant/dashboard" });
      } else {
        // Email confirmation required — redirect to verify page
        navigate({ to: "/verify-email", search: { email } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-10">
        <Link to="/merchant" className="mb-8 flex flex-col items-center gap-1">
          <img src={logo} alt="VFarmers" className="h-10 w-10" />
          <span className="text-xl font-semibold tracking-tight">
            V<span className="text-primary">Farmers</span>
          </span>
          <span className="text-xs text-amber-400 font-medium">Merchant Portal</span>
        </Link>

        <div className="glass w-full rounded-3xl p-7 shadow-elegant">
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            {["account", "business"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  step === s ? "bg-primary text-primary-foreground" :
                  (step === "business" && s === "account") ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>{i + 1}</div>
                <span className={`text-xs ${step === s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {s === "account" ? "Account" : "Business info"}
                </span>
                {i === 0 && <div className="h-px w-6 bg-border" />}
              </div>
            ))}
          </div>

          <div className="text-center mb-5">
            <h1 className="text-2xl font-semibold tracking-tight">
              {step === "account" ? "Create merchant account" : "Business details"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === "account" ? "Set up your login credentials." : "Tell us about your business."}
            </p>
          </div>

          {step === "account" ? (
            <form onSubmit={handleAccountStep} className="space-y-3">
              <Field icon={Mail} type="email" placeholder="you@business.com" value={email} onChange={setEmail} required />
              <Field icon={Lock} type={showPassword ? "text" : "password"} placeholder="Password (min 6 chars)" value={password} onChange={setPassword} required minLength={6} onToggleVisibility={() => setShowPassword(v => !v)} visible={showPassword} />
              {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
              <button type="submit" className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01]">
                Next <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field icon={Building2} type="text" placeholder="Business name *" value={businessName} onChange={setBusinessName} required />
              <Field icon={Building2} type="text" placeholder="Contact person name *" value={contactName} onChange={setContactName} required />
              <Field icon={Phone} type="tel" placeholder="Phone number" value={phone} onChange={setPhone} />
              <Field icon={MapPin} type="text" placeholder="City" value={city} onChange={setCity} />
              <Field icon={MapPin} type="text" placeholder="Country" value={country} onChange={setCountry} />
              {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep("account")} className="flex-1 rounded-xl border border-border bg-card/60 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-card">
                  Back
                </button>
                <button type="submit" disabled={loading} className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create account <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            </form>
          )}

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Already a merchant?{" "}
            <Link to="/auth" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          By signing up you agree to VFarmers'{" "}
          <a href="/terms" className="underline hover:text-foreground">Terms</a> and{" "}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, type, placeholder, value, onChange, required, minLength, onToggleVisibility, visible }: {
  icon: React.ComponentType<{ className?: string }>; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; required?: boolean; minLength?: number;
  onToggleVisibility?: () => void; visible?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 focus-within:border-primary/60">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} minLength={minLength}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      {onToggleVisibility && (
        <button type="button" onClick={onToggleVisibility} className="shrink-0 text-muted-foreground hover:text-foreground">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </label>
  );
}
