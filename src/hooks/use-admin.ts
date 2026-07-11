import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/is-admin.functions";
import { getMyPrivileges } from "@/lib/privileges.functions";

export function useIsAdmin() {
  const fn = useServerFn(checkIsAdmin);
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}

export function useMyPrivileges() {
  const fn = useServerFn(getMyPrivileges);
  return useQuery({
    queryKey: ["my-privileges"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}

export function useHasPrivilege(privilege: string): boolean {
  const { data } = useMyPrivileges();
  return data?.privileges.includes(privilege) ?? false;
}
