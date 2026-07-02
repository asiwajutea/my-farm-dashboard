// Supabase Auth "Send Email" hook that delivers all auth emails via Resend.
// Deploy to your own Supabase project:
//   supabase functions deploy auth-email-hook --no-verify-jwt
// Set the following function secrets in Supabase:
//   RESEND_API_KEY       - your Resend API key
//   SEND_EMAIL_HOOK_SECRET - the "v1,whsec_..." secret shown when you create
//                            the Send Email hook in Auth → Hooks
//   EMAIL_FROM           - e.g. "VFarmers <no-reply@vfarmers.app>"
//
// Then in Supabase Dashboard → Authentication → Hooks → "Send Email hook",
// point it at this function's URL and paste the same secret.

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "https://esm.sh/resend@4.6.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string).replace(
  /^v1,whsec_/,
  "",
);
const FROM = Deno.env.get("EMAIL_FROM") ?? "VFarmers <no-reply@vfarmers.app>";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

type EmailActionType =
  | "signup"
  | "login"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email_change_current"
  | "email_change_new"
  | "reauthentication";

interface HookPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function subjectFor(type: EmailActionType): string {
  switch (type) {
    case "signup":
      return "Confirm your VFarmers account";
    case "magiclink":
      return "Your VFarmers sign-in link";
    case "recovery":
      return "Reset your VFarmers password";
    case "invite":
      return "You're invited to VFarmers";
    case "email_change":
    case "email_change_current":
    case "email_change_new":
      return "Confirm your new VFarmers email";
    case "reauthentication":
      return "VFarmers verification code";
    default:
      return "VFarmers";
  }
}

function headingFor(type: EmailActionType): string {
  switch (type) {
    case "signup":
      return "Welcome to VFarmers 🌱";
    case "magiclink":
      return "Sign in to VFarmers";
    case "recovery":
      return "Reset your password";
    case "invite":
      return "You've been invited";
    case "reauthentication":
      return "Verify it's you";
    default:
      return "Confirm your email";
  }
}

function ctaFor(type: EmailActionType): string {
  switch (type) {
    case "signup":
      return "Confirm email";
    case "magiclink":
      return "Sign in";
    case "recovery":
      return "Reset password";
    case "invite":
      return "Accept invite";
    default:
      return "Confirm";
  }
}

function renderHtml(params: {
  heading: string;
  cta: string;
  actionUrl: string;
  token: string;
}) {
  return `<!doctype html><html><body style="background:#ffffff;font-family:Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a;">
    <h1 style="font-size:22px;margin:0 0 16px;">${params.heading}</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 24px;">Tap the button below to continue. This link will expire shortly.</p>
    <p style="margin:0 0 24px;">
      <a href="${params.actionUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">${params.cta}</a>
    </p>
    <p style="font-size:13px;color:#475569;margin:0 0 8px;">Or copy this code:</p>
    <p style="font-size:20px;font-weight:700;letter-spacing:3px;margin:0 0 24px;">${params.token}</p>
    <p style="font-size:12px;color:#94a3b8;margin:0;">If you didn't request this, you can safely ignore this email.</p>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let data: HookPayload;
  try {
    const wh = new Webhook(hookSecret);
    data = wh.verify(payload, headers) as HookPayload;
  } catch (err) {
    console.error("Invalid webhook signature", err);
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    user,
    email_data: { token, token_hash, redirect_to, email_action_type, site_url },
  } = data;

  // Always build the verify URL from the project's Supabase URL (not site_url,
  // which can be misconfigured and produce doubled /auth/v1 paths). Include
  // the anon apikey so Supabase's verify endpoint accepts the request.
  const base = SUPABASE_URL || (site_url ?? "").replace(/\/+$/, "");
  const params = new URLSearchParams({
    token: token_hash,
    type: email_action_type,
    redirect_to,
  });
  if (SUPABASE_ANON_KEY) params.set("apikey", SUPABASE_ANON_KEY);
  const actionUrl = `${base}/auth/v1/verify?${params.toString()}`;

  const html = renderHtml({
    heading: headingFor(email_action_type),
    cta: ctaFor(email_action_type),
    actionUrl,
    token,
  });

  const { error } = await resend.emails.send({
    from: FROM,
    to: [user.email],
    subject: subjectFor(email_action_type),
    html,
  });

  if (error) {
    console.error("Resend error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});