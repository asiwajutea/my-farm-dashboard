import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { lookupReferrer, type ReferrerInfo } from "@/lib/affiliate.functions";

export function ReferrerPreview({ code }: { code: string }) {
  const fn = useServerFn(lookupReferrer);
  const [state, setState] = useState<{ loading: boolean; data: ReferrerInfo; err: boolean }>({
    loading: false,
    data: null,
    err: false,
  });

  useEffect(() => {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setState({ loading: false, data: null, err: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, err: false }));
    const t = setTimeout(async () => {
      try {
        const data = await fn({ data: { code: trimmed } });
        if (!cancelled) setState({ loading: false, data, err: !data });
      } catch {
        if (!cancelled) setState({ loading: false, data: null, err: true });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [code, fn]);

  if (!code.trim()) return null;
  if (state.loading)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking code…
      </div>
    );
  if (state.err || !state.data)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <XCircle className="h-3.5 w-3.5" /> Code not found
      </div>
    );
  const name = state.data.display_name || state.data.username || "Farmer";
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
      <CheckCircle2 className="h-4 w-4 text-primary" />
      <div className="flex items-center gap-2">
        {state.data.avatar_url ? (
          <img src={state.data.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <span>
          Referred by <span className="font-semibold text-foreground">{name}</span>
          {state.data.username && <span className="text-muted-foreground"> @{state.data.username}</span>}
        </span>
      </div>
    </div>
  );
}
