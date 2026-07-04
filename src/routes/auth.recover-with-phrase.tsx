/**
 * /auth/recover-with-phrase
 *
 * Account recovery using the 12-word recovery phrase.
 * No session required — available from the forgot-password page.
 *
 * Flow:
 *   1. User enters email
 *   2. System randomly challenges 3 word positions
 *   3. User fills in those 3 words AND the remaining 9 (hidden/dimmed)
 *      — actually we ask for ALL 12 to verify the full hash,
 *        but only show 3 input boxes; the others are auto-filled
 *        by the user completing the set
 *   4. On success → navigate to the Supabase recovery link
 *      (which lands on /auth/reset-password to set a new password)
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, AlertCircle, CheckCircle2, Sprout } from "lucide-react";
import logo from "@/assets/vfarm-logo.png";
import { verifyRecoveryPhrase } from "@/lib/recovery-phrase.functions";

export const Route = createFileRoute("/auth/recover-with-phrase")({
  head: () => ({
    meta: [
      { title: "Recover with phrase · VFarmers" },
      { name: "description", content: "Recover your VFarmers account using your 12-word recovery phrase." },
    ],
  }),
  component: RecoverWithPhrasePage,
});

/** Pick 3 unique random positions (0-indexed) out of 12 */
function pickChallengePositions(): [number, number, number] {
  const positions = Array.from({ length: 12 }, (_, i) => i);
  const chosen: number[] = [];
  while (chosen.length < 3) {
    const idx = Math.floor(Math.random() * positions.length);
    chosen.push(positions[idx]);
    positions.splice(idx, 1);
  }
  return [chosen[0], chosen[1], chosen[2]];
}

type PageStep = "email" | "challenge" | "success";

function RecoverWithPhrasePage() {
  const verifyFn = useServerFn(verifyRecoveryPhrase);

  const [step, setStep] = useState<PageStep>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Challenge state
  const [positions] = useState<[number, number, number]>(() => pickChallengePositions());
  // All 12 word answers — only the 3 challenged ones are shown as inputs
  const [answers, setAnswers] = useState<string[]>(Array(12).fill(""));

  const setAnswer = (idx: number, val: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setStep("challenge");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate that all 3 challenged positions have input
    const missing = positions.filter((p) => !answers[p].trim());
    if (missing.length > 0) {
      setError(`Please enter word${missing.length > 1 ? "s" : ""} ${missing.map((p) => `#${p + 1}`).join(", ")}.`);
      return;
    }

    setLoading(true);
    try {
      // Send only the filled-in answers; unchalleneged positions are empty string.
      // The server fn expects all 12 — for unchallenged positions we send a
      // placeholder that will be hashed differently from the real words.
      // Wait — we need the full 12 to reconstruct the hash. So we must ask
      // the user to enter all 12. The challenge just highlights 3 to reduce
      // friction (the user only truly needs to recall those 3 are correct,
      // since the full hash verification happens server-side).
      //
      // UX: the user sees all 12 labeled slots. The 3 challenged ones are
      // active inputs. The 9 others are also inputs but visually dimmed,
      // letting the user fill all 12 from their written copy.
      const { recoveryToken } = await verifyFn({
        data: { email: email.trim(), words: answers },
      });
      // Navigate to the Supabase recovery link directly
      window.location.href = recoveryToken;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
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

          {/* ── Step 1: Email ── */}
          {step === "email" && (
            <>
              <div className="text-center">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Recovery Phrase
                </div>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight">Recover your account</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Enter your email address to get started.
                </p>
              </div>

              <form onSubmit={handleEmailSubmit} className="mt-6 space-y-3">
                <label className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 focus-within:border-primary/60">
                  <Sprout className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01]"
                >
                  Continue
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-muted-foreground">
                <Link to="/forgot-password" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ArrowLeft className="h-3 w-3" />
                  Use email reset instead
                </Link>
              </div>
            </>
          )}

          {/* ── Step 2: Challenge ── */}
          {step === "challenge" && (
            <>
              <div className="text-center">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Enter Recovery Phrase
                </div>
                <h1 className="mt-4 text-xl font-semibold tracking-tight">Enter your 12 words</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Fill in all 12 words from your recovery phrase. The{" "}
                  <span className="font-semibold text-primary">highlighted</span> positions are required.
                </p>
              </div>

              <form onSubmit={handleVerify} className="mt-5">
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 12 }, (_, i) => {
                    const isChallenged = positions.includes(i);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className="w-5 shrink-0 text-center text-[10px] font-bold"
                          style={{ color: isChallenged ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
                        >
                          {i + 1}
                        </span>
                        <input
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={answers[i]}
                          onChange={(e) => setAnswer(i, e.target.value)}
                          required={isChallenged}
                          placeholder={`word ${i + 1}`}
                          className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs bg-background/40 outline-none placeholder:text-muted-foreground/50 transition-colors focus:border-primary/60"
                          style={{
                            borderColor: isChallenged
                              ? "oklch(0.72 0.20 142 / 0.5)"
                              : "var(--color-border)",
                            opacity: isChallenged ? 1 : 0.6,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {error && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {loading ? "Verifying…" : "Verify & recover account"}
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(null); }}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Change email
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Success (briefly shown before redirect) ── */}
          {step === "success" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Verified!</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Redirecting you to set a new password…
                </p>
              </div>
              <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
