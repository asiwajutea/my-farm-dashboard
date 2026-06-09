// Shared KYC validation contract — imported by BOTH client (verify UI) and
// server (server fns). MUST stay pure: constants, types, and pure validators
// only; no `process.env` and no I/O.

export const KYC_DOCUMENT_TYPES = ["passport", "national_id", "drivers_license"] as const;
export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

export const KYC_DOCUMENT_TYPE_LABELS: Record<KycDocumentType, string> = {
  passport: "Passport",
  national_id: "National ID card",
  drivers_license: "Driver's license",
};

// Accepted upload types/size — images or PDF, max 10 MB (mirrors `proofs`).
export const KYC_FILE_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
export type KycFileMime = (typeof KYC_FILE_MIME)[number];
export const KYC_FILE_MAX_BYTES = 10 * 1024 * 1024;

export const KYC_NAME_MIN = 2;
export const KYC_NAME_MAX = 120;

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";

export type KycFileErrorCode = "bad_type" | "too_large" | "missing";

export function isKycDocumentType(v: unknown): v is KycDocumentType {
  return typeof v === "string" && (KYC_DOCUMENT_TYPES as readonly string[]).includes(v);
}

/** Validate one uploaded KYC file (selfie or document image/PDF). */
export function validateKycFile(file: { type: string; size: number } | null):
  | { ok: true }
  | { ok: false; code: KycFileErrorCode } {
  if (!file) return { ok: false, code: "missing" };
  if (!(KYC_FILE_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, code: "bad_type" };
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > KYC_FILE_MAX_BYTES) {
    return { ok: false, code: "too_large" };
  }
  return { ok: true };
}

/** Map a KYC file MIME type to a storage extension. */
export function kycFileExtension(mime: KycFileMime): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "application/pdf":
      return "pdf";
  }
}
