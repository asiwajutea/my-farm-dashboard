import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Loader2, UploadCloud, Clock, FileText } from "lucide-react";

import { getMyKycStatus, submitKyc } from "@/lib/kyc.functions";
import {
  KYC_DOCUMENT_TYPES,
  KYC_DOCUMENT_TYPE_LABELS,
  KYC_FILE_MIME,
  KYC_FILE_MAX_BYTES,
  validateKycFile,
  type KycDocumentType,
} from "@/lib/kyc.shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/verify")({
  head: () => ({ meta: [{ title: "Verify identity · VFarmers" }] }),
  component: VerifyPage,
});

const ACCEPT = KYC_FILE_MIME.join(",");

function VerifyPage() {
  const statusFn = useServerFn(getMyKycStatus);
  const submitFn = useServerFn(submitKyc);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["my-kyc"], queryFn: () => statusFn() });

  const [fullName, setFullName] = useState("");
  const [docType, setDocType] = useState<KycDocumentType>("passport");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.set("full_name", fullName.trim());
      fd.set("document_type", docType);
      if (docFile) fd.set("document", docFile);
      if (selfieFile) fd.set("selfie", selfieFile);
      return submitFn({ data: fd });
    },
    onSuccess: () => {
      toast.success("Verification submitted — we'll review it shortly.");
      setFullName("");
      setDocFile(null);
      setSelfieFile(null);
      qc.invalidateQueries({ queryKey: ["my-kyc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pickFile = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const check = validateKycFile({ type: file.type, size: file.size });
      if (!check.ok) {
        toast.error(
          check.code === "bad_type"
            ? "File must be a JPG, PNG, or PDF."
            : "File must be under 10 MB.",
        );
        e.target.value = "";
        return;
      }
    }
    setter(file);
  };

  const status = q.data?.status ?? "unverified";
  const latest = q.data?.latest ?? null;
  const canSubmit =
    fullName.trim().length >= 2 && !!docFile && !!selfieFile && !submit.isPending;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="text-xs uppercase tracking-[0.2em] text-primary">Compliance</div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Identity verification</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Verify your identity to unlock higher limits and full platform access. Your documents are
        stored privately and reviewed by the VFarmers compliance team.
      </p>

      {q.isLoading ? (
        <div className="glass mt-6 space-y-5 rounded-3xl p-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : status === "verified" ? (
        <StateCard
          tone="primary"
          icon={<ShieldCheck className="h-6 w-6" />}
          title="You're verified"
          body="Your identity has been confirmed. You have full access to VFarmers."
        />
      ) : status === "pending" ? (
        <StateCard
          tone="gold"
          icon={<Clock className="h-6 w-6" />}
          title="Verification under review"
          body="Thanks — we've received your documents. Reviews usually complete within 1–2 business days, and you'll get a notification when it's done."
        >
          {latest && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Meta label="Submitted" value={new Date(latest.created_at).toLocaleString()} />
              <Meta label="Document" value={KYC_DOCUMENT_TYPE_LABELS[latest.document_type as KycDocumentType] ?? latest.document_type} />
            </dl>
          )}
        </StateCard>
      ) : (
        <>
          {status === "rejected" && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <div className="font-medium text-destructive">Your last submission was rejected.</div>
                {latest?.admin_note && (
                  <p className="mt-0.5 text-muted-foreground">Reason: {latest.admin_note}</p>
                )}
                <p className="mt-0.5 text-muted-foreground">Please review the details and submit again.</p>
              </div>
            </div>
          )}

          <form
            className="glass mt-6 space-y-5 rounded-3xl p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) submit.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Full legal name</Label>
              <Input
                id="full_name"
                value={fullName}
                maxLength={120}
                placeholder="As written on your document"
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc_type">Document type</Label>
              <select
                id="doc_type"
                value={docType}
                onChange={(e) => setDocType(e.target.value as KycDocumentType)}
                className="w-full rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-sm outline-none focus:border-primary/60"
              >
                {KYC_DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {KYC_DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <FileField
              label="Photo of your document"
              hint="Front of your ID, clearly readable."
              file={docFile}
              inputRef={docRef}
              onPick={pickFile(setDocFile)}
              accept={ACCEPT}
            />

            <FileField
              label="Selfie"
              hint="A clear photo of your face. Hold your document if you can."
              file={selfieFile}
              inputRef={selfieRef}
              onPick={pickFile(setSelfieFile)}
              accept={ACCEPT}
            />

            <p className="text-xs text-muted-foreground">
              By submitting you confirm the documents are genuine and belong to you, and you agree to
              our{" "}
              <a href="/terms" className="text-primary underline" target="_blank" rel="noreferrer">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-primary underline" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              . Max file size {Math.round(KYC_FILE_MAX_BYTES / (1024 * 1024))} MB (JPG, PNG, or PDF).
            </p>

            <Button type="submit" disabled={!canSubmit} className="w-full">
              {submit.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              Submit for verification
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

function FileField({
  label,
  hint,
  file,
  inputRef,
  onPick,
  accept,
}: {
  label: string;
  hint: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-background/40 px-4 py-3 text-left transition-colors hover:border-primary/50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {file ? <FileText className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{file ? file.name : "Choose a file"}</div>
          <div className="truncate text-xs text-muted-foreground">{file ? "Tap to replace" : hint}</div>
        </div>
      </button>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onPick} />
    </div>
  );
}

function StateCard({
  tone,
  icon,
  title,
  body,
  children,
}: {
  tone: "primary" | "gold";
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const toneCls =
    tone === "primary" ? "bg-primary/10 text-primary" : "bg-gold/10 text-gold";
  return (
    <div className="glass mt-7 rounded-3xl p-8 text-center">
      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${toneCls}`}>
        {icon}
      </div>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3 text-left">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
