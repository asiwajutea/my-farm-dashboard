import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { hasPasscode } from "@/lib/passcode.functions";
import { PasscodeSetupDialog } from "./PasscodeSetupDialog";

/**
 * Blocking modal shown to authenticated users who haven't set a transaction
 * passcode yet. Mounted once inside the authenticated layout.
 */
export function PasscodeGate() {
  const hasFn = useServerFn(hasPasscode);
  const { data } = useQuery({
    queryKey: ["has-passcode"],
    queryFn: () => hasFn(),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (data && !data.has) setOpen(true);
  }, [data]);

  if (!data || data.has) return null;
  return (
    <PasscodeSetupDialog
      open={open}
      onOpenChange={setOpen}
      forceSet
      onDone={() => setOpen(false)}
    />
  );
}