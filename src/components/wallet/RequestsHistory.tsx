import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyRequests } from "@/lib/api/requests.functions";
import { StatusBadge } from "@/components/wallet/StatusBadge";
import type { RequestType } from "@/lib/requests.shared";
import { Loadable } from "@/components/ui/loadable";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  usdt_trc20: "USDT (TRC20)",
  usdt_erc20: "USDT (ERC20)",
  card: "Card",
};

export function RequestsHistory({ filter }: { filter?: RequestType }) {
  const fn = useServerFn(listMyRequests);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-requests", filter ?? "all"],
    queryFn: () => fn({ data: { limit: 20 } }),
  });

  if (isError) {
    return <p className="text-sm text-destructive">Failed to load history.</p>;
  }

  const items = (data?.items ?? []).filter((r) => !filter || r.type === filter);

  return (
    <Loadable loading={isLoading} skeleton={<ListSkeleton rows={4} leading="none" />}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No requests yet.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {items.map((r) => (
            <li key={`${r.type}-${r.id}`} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="capitalize">{r.type}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {METHOD_LABEL[r.method] ?? r.method}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm tabular-nums">{r.amount}</span>
                <StatusBadge status={r.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Loadable>
  );
}
