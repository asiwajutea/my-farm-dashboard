import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPrivileges } from "@/lib/privileges.functions";

export const PRIVILEGES_KEY = ["my-privileges"] as const;

/**
 * Returns the set of privilege codes granted to the current user.
 * Admins automatically have all privileges so no need to check separately —
 * use `useIsAdmin()` for that.
 */
export function usePrivileges() {
  const fn = useServerFn(getMyPrivileges);
  const query = useQuery({
    queryKey: PRIVILEGES_KEY,
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  const privileges = new Set(query.data ?? []);

  return {
    ...query,
    privileges,
    has: (code: string) => privileges.has(code),
  };
}
