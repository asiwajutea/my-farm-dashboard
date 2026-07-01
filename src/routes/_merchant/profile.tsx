import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UserCircle } from "lucide-react";
import { getMyMerchantProfile, updateMerchantProfile } from "@/lib/merchant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_merchant/profile")({
  head: () => ({ meta: [{ title: "Merchant Profile · VFarmers" }] }),
  component: MerchantProfilePage,
});

function MerchantProfilePage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyMerchantProfile);
  const updateFn = useServerFn(updateMerchantProfile);
  const profileQ = useQuery({ queryKey: ["merchant-profile"], queryFn: () => profileFn() });
  const initialised = useRef(false);

  const [form, setForm] = useState({ businessName: "", contactName: "", phone: "", city: "", country: "" });

  useEffect(() => {
    if (profileQ.data && !initialised.current) {
      initialised.current = true;
      setForm({
        businessName: profileQ.data.business_name,
        contactName: profileQ.data.contact_name,
        phone: profileQ.data.phone ?? "",
        city: profileQ.data.city ?? "",
        country: profileQ.data.country ?? "",
      });
    }
  }, [profileQ.data]);

  const updateMut = useMutation({
    mutationFn: () => updateFn({ data: {
      businessName: form.businessName,
      contactName: form.contactName,
      phone: form.phone || undefined,
      city: form.city || undefined,
      country: form.country || undefined,
    }}),
    onSuccess: () => { toast.success("Profile updated."); qc.invalidateQueries({ queryKey: ["merchant-profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Merchant Profile</h1>
        <p className="text-sm text-muted-foreground">Update your business information.</p>
      </div>

      <div className="glass rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserCircle className="h-7 w-7" />
          </div>
          <div>
            <div className="font-semibold">{form.businessName || "—"}</div>
            <div className="text-xs text-muted-foreground">{form.contactName || "—"}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Business Name *</Label>
            <Input value={form.businessName} onChange={(e) => set("businessName")(e.target.value)} placeholder="Acme Seeds Ltd." required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Contact Name *</Label>
            <Input value={form.contactName} onChange={(e) => set("contactName")(e.target.value)} placeholder="John Doe" required />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="+234 800 000 0000" />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => set("city")(e.target.value)} placeholder="Lagos" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Country</Label>
            <Input value={form.country} onChange={(e) => set("country")(e.target.value)} placeholder="Nigeria" />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => updateMut.mutate()}
          disabled={updateMut.isPending || !form.businessName.trim() || !form.contactName.trim()}
        >
          {updateMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Profile
        </Button>
      </div>

      {profileQ.data && (
        <div className="rounded-xl border border-border bg-card/40 px-4 py-3 text-xs text-muted-foreground">
          Merchant since {new Date(profileQ.data.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </div>
      )}
    </div>
  );
}
