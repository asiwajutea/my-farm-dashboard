import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPrivileges, type Privilege } from "@/lib/privileges.functions";

export const PRIVILEGES_KEY = ["my-privileges"] as const;

export function usePrivileges() {
  const fn = useServerFn(getMyPrivileges);
  return useQuery({
    queryKey: PRIVILEGES_KEY,
    queryFn: () => fn(),
    staleTime: 60_000,
    select: (data) => data.privileges,
  });
}

export function useHasPrivilege(privilege: Privilege | string) {
  const { data: privileges = [] } = usePrivileges();
  return privileges.includes(privilege);
}
