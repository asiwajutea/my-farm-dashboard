import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, User as UserIcon, ShieldCheck } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatarUrl } from "@/lib/avatar";

interface ProfileLite {
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  kyc_status: string | null;
}

export function AppTopbar() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, username, kyc_status")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(prof ?? null);
      setAvatarUrl(await resolveAvatarUrl(prof?.avatar_url ?? null));
    })();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const name = profile?.display_name || email.split("@")[0] || "Farmer";
  const verified = profile?.kyc_status === "verified";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        <Link
          to="/notifications"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </Link>
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-2 py-1.5 transition-colors hover:bg-card"
          >
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-xs font-semibold text-primary">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </div>
            <span className="hidden text-sm sm:inline">{name}</span>
            {verified && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          </button>
          {open && (
            <div className="glass absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl p-1.5 shadow-elegant">
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {profile?.username ? `@${profile.username}` : email}
              </div>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-card"
              >
                <UserIcon className="h-4 w-4" />
                Profile
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
