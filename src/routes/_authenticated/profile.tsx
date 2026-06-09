import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Check, CheckCircle2, Copy, Loader2, ShieldCheck, ShieldAlert, AtSign,
  Sparkles, Globe, MapPin, Phone, FileText, X, Pencil,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { resolveAvatarUrl } from "@/lib/avatar";
import { PRESET_AVATARS, findPresetAvatar } from "@/lib/avatars";
import { checkUsernameAvailable } from "@/lib/profile.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileHeaderSkeleton } from "@/components/skeletons/DetailSkeleton";
import { COUNTRIES, COUNTRY_BY_CODE, detectCountry, findCountryByName, type Country } from "@/lib/countries";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile · VFarmers" }] }),
  component: ProfilePage,
});

type UsernameStatus = "idle" | "invalid" | "checking" | "available" | "taken";

const KYC_META = {
  unverified: { label: "Not verified", icon: ShieldAlert, color: "text-muted-foreground bg-muted/40 border-border" },
  pending: { label: "Verification pending", icon: Loader2, color: "text-gold bg-gold/10 border-gold/30" },
  verified: { label: "Verified Farmer", icon: ShieldCheck, color: "text-primary bg-primary/10 border-primary/30" },
  rejected: { label: "Verification rejected", icon: ShieldAlert, color: "text-destructive bg-destructive/10 border-destructive/30" },
} as const;

/** Split a stored phone string like "+1 555 0100" into dial + local parts. */
function splitPhone(stored: string | null): { dial: string; local: string } {
  if (!stored) return { dial: "", local: "" };
  const trimmed = stored.trim();
  // Try longest-prefix dial match (dials are 2–5 chars incl. "+").
  const dials = Array.from(new Set(COUNTRIES.map((c) => c.dial))).sort(
    (a, b) => b.length - a.length,
  );
  for (const d of dials) {
    if (trimmed.startsWith(d)) {
      return { dial: d, local: trimmed.slice(d.length).trim() };
    }
  }
  return { dial: "", local: trimmed };
}

function ProfilePage() {
  const router = useRouter();
  const checkUsernameFn = useServerFn(checkUsernameAvailable);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [countryCode, setCountryCode] = useState<string>(""); // ISO2
  const [phoneDial, setPhoneDial] = useState<string>("");
  const [phoneLocal, setPhoneLocal] = useState<string>("");
  const [bio, setBio] = useState("");
  const [autoDetected, setAutoDetected] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setSelectedAvatar(data.avatar_url ?? null);
        setAvatarUrl(await resolveAvatarUrl(data.avatar_url));

        const existing = findCountryByName(data.country);
        const { dial, local } = splitPhone(data.phone);
        setPhoneLocal(local);

        if (existing) {
          setCountryCode(existing.code);
          setPhoneDial(dial || existing.dial);
        } else {
          // Auto-detect when country not yet set.
          const detected = await detectCountry();
          if (detected) {
            setCountryCode(detected.code);
            setPhoneDial(dial || detected.dial);
            setAutoDetected(true);
          } else if (dial) {
            setPhoneDial(dial);
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  const country = useMemo<Country | undefined>(
    () => (countryCode ? COUNTRY_BY_CODE[countryCode] : undefined),
    [countryCode],
  );

  // Live username availability — debounced, with stale-response guarding.
  useEffect(() => {
    const u = username.trim().toLowerCase();
    const current = (profile?.username ?? "").toLowerCase();
    if (!u || u === current) {
      setUsernameStatus("idle");
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(u)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await checkUsernameFn({ data: { username: u } });
        if (cancelled) return;
        setUsernameStatus(!r.valid ? "invalid" : r.available ? "available" : "taken");
      } catch {
        if (!cancelled) setUsernameStatus("idle");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, profile?.username, checkUsernameFn]);

  // Unique dial codes for the phone-code dropdown (e.g. "+1 🇺🇸 🇨🇦").
  const dialOptions = useMemo(() => {
    const map = new Map<string, Country[]>();
    for (const c of COUNTRIES) {
      const list = map.get(c.dial) ?? [];
      list.push(c);
      map.set(c.dial, list);
    }
    return Array.from(map.entries())
      .map(([dial, list]) => ({ dial, list }))
      .sort((a, b) => Number(a.dial.slice(1)) - Number(b.dial.slice(1)));
  }, []);

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    setAutoDetected(false);
    const c = COUNTRY_BY_CODE[code];
    // Update dial when empty or it matched the previous country's dial.
    if (c) {
      const prev = country;
      if (!phoneDial || (prev && phoneDial === prev.dial)) {
        setPhoneDial(c.dial);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const u = username.trim().toLowerCase();
    if (u && !/^[a-z0-9_]{3,24}$/.test(u)) {
      setError("Username must be 3–24 chars: a-z, 0-9, underscore.");
      return;
    }
    if (usernameStatus === "taken") {
      setError("That username is already taken.");
      return;
    }
    if (displayName.trim().length > 60) {
      setError("Display name must be under 60 characters.");
      return;
    }
    if (bio.length > 280) {
      setError("Bio must be under 280 characters.");
      return;
    }
    const localDigits = phoneLocal.replace(/\D/g, "");
    if (phoneLocal && localDigits.length < 4) {
      setError("Phone number looks too short.");
      return;
    }
    const phoneCombined = phoneLocal
      ? `${phoneDial || ""} ${phoneLocal.trim()}`.trim()
      : null;

    setSaving(true);
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        username: u || null,
        phone: phoneCombined,
        country: country?.name ?? null,
        bio: bio.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);

    if (upErr) {
      if (upErr.code === "23505") setError("That username is already taken.");
      else setError(upErr.message);
      return;
    }
    toast.success("Profile saved.");
    setAutoDetected(false);
    router.invalidate();
  };

  const selectAvatar = async (url: string) => {
    if (!userId || url === selectedAvatar) return;
    setError(null);
    setSavingAvatar(true);
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", userId);
    setSavingAvatar(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setSelectedAvatar(url);
    setAvatarUrl(await resolveAvatarUrl(url));
    setEditingAvatar(false);
    toast.success("Avatar updated.");
  };

  const copyReferral = async () => {
    if (!profile?.referral_code) return;
    await navigator.clipboard.writeText(profile.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-9 w-72" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-7">
          <ProfileHeaderSkeleton />
        </div>
        <div className="glass mt-5 space-y-4 rounded-3xl p-7">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </main>
    );
  }

  const kyc = profile?.kyc_status ?? "unverified";
  const kycMeta = KYC_META[kyc as keyof typeof KYC_META] ?? KYC_META.unverified;

  // Collapse the picker once a Farmer has an avatar — only re-open when they
  // explicitly choose to change it. This keeps the section compact.
  const selectedAvatarMeta = findPresetAvatar(selectedAvatar);
  const showAvatarGrid = editingAvatar || !selectedAvatar;

  return (
    <div className="animate-fade-in">
      <main className="mx-auto max-w-3xl px-5 py-8">

        <div className="text-xs uppercase tracking-[0.2em] text-primary">Identity</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Your Farmer profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          How you appear to other Farmers and how we recognize you.
        </p>

        {/* Avatar + status */}
        <section className="glass mt-7 rounded-3xl p-7">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-semibold text-primary">
                  {(displayName || email || "F").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="text-lg font-semibold">{displayName || "Farmer"}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
              <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${kycMeta.color}`}>
                <kycMeta.icon className={`h-3.5 w-3.5 ${kyc === "pending" ? "animate-spin" : ""}`} />
                {kycMeta.label}
              </div>
            </div>
            {profile?.referral_code && (
              <button
                type="button"
                onClick={copyReferral}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 text-left transition-colors hover:border-primary/40"
              >
                <Sparkles className="h-4 w-4 text-gold" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Referral code</div>
                  <div className="font-mono text-sm font-semibold tracking-wider">{profile.referral_code}</div>
                </div>
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            )}
          </div>

          {/* Preset avatar chooser (no uploads — keeps storage/bandwidth at zero) */}
          <div className="mt-6 border-t border-border/40 pt-5">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {showAvatarGrid ? "Choose your avatar" : "Your avatar"}
              </div>
              {savingAvatar && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>

            {showAvatarGrid ? (
              <>
                <div className="mt-3 grid grid-cols-6 gap-2.5 sm:grid-cols-12">
                  {PRESET_AVATARS.map((a) => {
                    const active = selectedAvatar === a.url;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => selectAvatar(a.url)}
                        disabled={savingAvatar}
                        title={a.label}
                        aria-label={a.label}
                        aria-pressed={active}
                        className={`relative overflow-hidden rounded-xl border transition-all disabled:opacity-60 ${
                          active
                            ? "border-primary ring-2 ring-primary/50"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <img src={a.url} alt="" className="h-full w-full" />
                        {active && (
                          <span className="absolute inset-0 flex items-center justify-center bg-primary/20">
                            <Check className="h-4 w-4 text-white drop-shadow" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedAvatar && (
                  <button
                    type="button"
                    onClick={() => setEditingAvatar(false)}
                    className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Done
                  </button>
                )}
              </>
            ) : (
              // Collapsed: show only the chosen avatar to save space. Farmers can
              // re-open the full picker any time to change it.
              <div className="mt-3 flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-primary ring-2 ring-primary/40">
                  <img
                    src={selectedAvatar ?? PRESET_AVATARS[0].url}
                    alt={selectedAvatarMeta?.label ?? "Selected avatar"}
                    className="h-full w-full"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {selectedAvatarMeta?.label ?? "Selected"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Your current avatar
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAvatar(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-xs font-medium transition-colors hover:border-primary/40"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Change avatar
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Edit form */}
        <form onSubmit={handleSave} className="glass mt-5 space-y-4 rounded-3xl p-7">
          <h2 className="text-base font-semibold">Edit details</h2>
          <Field
            label="Display name"
            icon={Sparkles}
            value={displayName}
            onChange={setDisplayName}
            placeholder="Your name on VFarmers"
            maxLength={60}
          />
          {/* Username with live availability feedback */}
          <label className="block">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <AtSign className="h-3.5 w-3.5" />
              Username (handle)
            </div>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="e.g. sage_farmer"
                maxLength={24}
                autoComplete="off"
                className={`w-full rounded-xl border bg-background/40 px-3.5 py-2.5 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60 ${
                  usernameStatus === "taken" || usernameStatus === "invalid"
                    ? "border-destructive/60"
                    : usernameStatus === "available"
                      ? "border-primary/60"
                      : "border-border"
                }`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {usernameStatus === "available" && <CheckCircle2 className="h-5 w-5 text-primary" />}
                {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </span>
            </div>
            <div className="mt-1 text-[11px]">
              {usernameStatus === "checking" && (
                <span className="text-muted-foreground">Checking availability…</span>
              )}
              {usernameStatus === "available" && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  “{username.trim().toLowerCase()}” is available.
                </span>
              )}
              {usernameStatus === "taken" && (
                <span className="text-destructive">“{username.trim().toLowerCase()}” is already taken.</span>
              )}
              {usernameStatus === "invalid" && (
                <span className="text-destructive">Use 3–24 characters: a–z, 0–9, underscore.</span>
              )}
              {usernameStatus === "idle" && (
                <span className="text-muted-foreground">
                  Other Farmers can find you by @handle for P2P transfers.
                </span>
              )}
            </div>
          </label>

          {/* Country */}
          <label className="block">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              Country
              {autoDetected && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                  <MapPin className="h-3 w-3" />
                  auto-detected
                </span>
              )}
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base">
                {country?.flag ?? "🌐"}
              </span>
              <select
                value={countryCode}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full appearance-none rounded-xl border border-border bg-background/40 py-2.5 pl-10 pr-9 text-sm outline-none focus:border-primary/60"
              >
                <option value="">Select your country…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.dial})
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                ▾
              </span>
            </div>
          </label>

          {/* Phone with dial code */}
          <label className="block">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              Phone
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <select
                  value={phoneDial}
                  onChange={(e) => setPhoneDial(e.target.value)}
                  aria-label="Country dial code"
                  className="h-full appearance-none rounded-xl border border-border bg-background/40 py-2.5 pl-3 pr-7 text-sm outline-none focus:border-primary/60"
                >
                  <option value="">+--</option>
                  {dialOptions.map(({ dial, list }) => (
                    <option key={dial} value={dial}>
                      {dial} {list.slice(0, 2).map((c) => c.flag).join(" ")}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  ▾
                </span>
              </div>
              <input
                type="tel"
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value)}
                placeholder="555 0100"
                maxLength={20}
                className="flex-1 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Dial code updates automatically when you change country.
            </div>
          </label>

          <label className="block">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Bio
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Tell other Farmers about yourself"
              className="w-full rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
            />
            <div className="mt-1 text-right text-[11px] text-muted-foreground">{bio.length}/280</div>
          </label>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || usernameStatus === "checking" || usernameStatus === "taken" || usernameStatus === "invalid"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save changes
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({
  label, icon: Icon, value, onChange, placeholder, hint, type = "text", maxLength,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
      />
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </label>
  );
}
