/**
 * VFarmers transactional email service — powered by Resend.
 *
 * Server-only module. Never import from client code.
 * All emails are sent from: VFarmers <no-reply@vfarmers.app>
 */

import { Resend } from "resend";
import {
  confirmEmailTemplate,
  welcomeEmailTemplate,
  resetPasswordTemplate,
  depositApprovedTemplate,
  cycleReapedTemplate,
  merchantWelcomeTemplate,
} from "./templates";

const FROM = "VFarmers <no-reply@vfarmers.app>";
const SITE_URL = process.env.SITE_URL ?? "https://vfarmers.app";

function getResend(): Resend {
  const key = process.env.RESEND_API;
  if (!key) throw new Error("RESEND_API environment variable is not set");
  return new Resend(key);
}

// ── Send helpers ─────────────────────────────────────────────────────────────

type SendResult = { ok: true; id: string } | { ok: false; error: string };

async function send(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) return { ok: false, error: error.message ?? "Send failed" };
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[email] send error:", msg);
    return { ok: false, error: msg };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendConfirmEmail(params: {
  to: string;
  name: string;
  confirmUrl: string;
}): Promise<SendResult> {
  const { subject, html } = confirmEmailTemplate({
    name: params.name,
    confirmUrl: params.confirmUrl,
  });
  return send(params.to, subject, html);
}

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
}): Promise<SendResult> {
  const { subject, html } = welcomeEmailTemplate({
    name: params.name,
    dashboardUrl: `${SITE_URL}/dashboard`,
  });
  return send(params.to, subject, html);
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<SendResult> {
  const { subject, html } = resetPasswordTemplate({
    name: params.name,
    resetUrl: params.resetUrl,
  });
  return send(params.to, subject, html);
}

export async function sendDepositApprovedEmail(params: {
  to: string;
  name: string;
  amount: string;
}): Promise<SendResult> {
  const { subject, html } = depositApprovedTemplate({
    name: params.name,
    amount: params.amount,
    dashboardUrl: `${SITE_URL}/wallet`,
  });
  return send(params.to, subject, html);
}

export async function sendCycleReapedEmail(params: {
  to: string;
  name: string;
  total: string;
  reward: string;
}): Promise<SendResult> {
  const { subject, html } = cycleReapedTemplate({
    name: params.name,
    total: params.total,
    reward: params.reward,
    dashboardUrl: `${SITE_URL}/farm`,
  });
  return send(params.to, subject, html);
}

export async function sendMerchantWelcomeEmail(params: {
  to: string;
  businessName: string;
  contactName: string;
}): Promise<SendResult> {
  const { subject, html } = merchantWelcomeTemplate({
    businessName: params.businessName,
    contactName: params.contactName,
    dashboardUrl: `${SITE_URL}/merchant/dashboard`,
  });
  return send(params.to, subject, html);
}
