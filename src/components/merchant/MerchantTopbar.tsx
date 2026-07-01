import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function MerchantTopbar() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/40 bg-background/60 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Store className="h-4 w-4 text-amber-400" />
        <span className="font-medium text-foreground">Merchant Portal</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/20 text-[10px] font-semibold text-amber-400">
          {email.charAt(0).toUpperCase()}
        </div>
        <span className="hidden text-sm sm:inline text-muted-foreground truncate max-w-[160px]">{email}</span>
      </div>
    </header>
  );
}
