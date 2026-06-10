import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicSiteState } from "@/lib/maintenance.functions";

export function useSiteState() {
  const fn = useServerFn(getPublicSiteState);
  return useQuery({
    queryKey: ["site-state"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}
