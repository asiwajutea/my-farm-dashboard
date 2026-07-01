/**
 * VFarmers HTML email templates.
 * All emails use the same base layout: dark background (#0a0a0a), green accent (#22c55e),
 * gold secondary (#f59e0b), hosted logo, and responsive single-column layout.
 *
 * Inline styles only — email clients don't support <style> blocks reliably.
 */

const LOGO_URL = "https://vfarmers.app/icons/icon-192.png";
const SITE_URL = process.env.SITE_URL ?? "https://vfarmers.app";
const PRIMARY = "#22c55e";
const GOLD = "#f59e0b";
const BG = "#0d1117";
const CARD_BG = "#161b22";
const BORDER = "#30363d";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

// ── Base layout ─────────────────────────────────────────────────────────────

function base(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VFarmers</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${TEXT};">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;color:${BG};">${preheader}&nbsp;‌‌‌‌‌‌‌‌‌‌‌‌‌‌‌</div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <a href="${SITE_URL}" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px;">
                <img src="${LOGO_URL}" alt="VFarmers" width="40" height="40" style="border-radius:10px;display:block;" />
                <span style="font-size:22px;font-weight:700;color:${TEXT};letter-spacing:-0.5px;">V<span style="color:${PRIMARY};">Farmers</span></span>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;padding:36px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;padding-bottom:8px;">
              <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.6;">
                © ${new Date().getFullYear()} VFarmers · Grow Together. Earn Together.<br/>
                <a href="${SITE_URL}/terms" style="color:${MUTED};text-decoration:underline;">Terms</a>
                &nbsp;·&nbsp;
                <a href="${SITE_URL}/privacy" style="color:${MUTED};text-decoration:underline;">Privacy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string, color = PRIMARY): string {
  return `<a href="${href}" style="display:inline-block;background-color:${color};color:#000000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.2px;">${label}</a>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:24px 0;" />`;
}

function badge(text: string, color = PRIMARY): string {
  return `<span style="display:inline-block;background-color:${color}1a;border:1px solid ${color}4d;color:${color};font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:4px 12px;border-radius:20px;">${text}</span>`;
}

// ── Templates ────────────────────────────────────────────────────────────────

/** Supabase confirmation email override */
export function confirmEmailTemplate(params: {
  name: string;
  confirmUrl: string;
}): { subject: string; html: string } {
  const subject = "Confirm your VFarmers account";
  const html = base(
    `${badge("Email Confirmation", PRIMARY)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:${TEXT};">Welcome to VFarmers, ${params.name}! 🌱</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${MUTED};line-height:1.7;">
      You're one step away from planting your first Seed. Confirm your email address to activate your Farmer account.
    </p>
    <div style="text-align:center;margin:28px 0;">
      ${btn(params.confirmUrl, "Confirm Email Address")}
    </div>
    ${divider()}
    <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6;">
      This link expires in <strong style="color:${TEXT};">24 hours</strong>. If you didn't create a VFarmers account, you can safely ignore this email.
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:${MUTED};">
      Button not working? Copy and paste this link:<br/>
      <a href="${params.confirmUrl}" style="color:${PRIMARY};word-break:break-all;">${params.confirmUrl}</a>
    </p>`,
    "Confirm your email to start farming on VFarmers.",
  );
  return { subject, html };
}

/** Welcome email sent after confirmed signup */
export function welcomeEmailTemplate(params: {
  name: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const subject = `Welcome to VFarmers, ${params.name}! 🌱`;
  const html = base(
    `${badge("Welcome", PRIMARY)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:${TEXT};">Your farm is ready, ${params.name}!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${MUTED};line-height:1.7;">
      You've joined the VFarmers community. Deposit Seeds, start farming cycles, and watch your rewards grow.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
      ${[
        ["🌱", "Start a farming cycle", "Lock Seeds and earn rewards when cycles mature."],
        ["💰", "Deposit funds", "Add USDT to your Primary wallet and convert to Seeds."],
        ["🤝", "Grow your network", "Share your affiliate link and earn from 3 generations."],
      ]
        .map(
          ([icon, title, desc]) => `
      <tr>
        <td style="padding:8px 0;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:36px;vertical-align:top;font-size:20px;padding-top:2px;">${icon}</td>
              <td>
                <p style="margin:0;font-size:14px;font-weight:600;color:${TEXT};">${title}</p>
                <p style="margin:2px 0 0;font-size:13px;color:${MUTED};">${desc}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
        )
        .join("")}
    </table>

    <div style="text-align:center;">
      ${btn(params.dashboardUrl, "Go to My Dashboard")}
    </div>`,
    `Welcome! Your VFarmers account is ready to go.`,
  );
  return { subject, html };
}

/** Password reset email */
export function resetPasswordTemplate(params: {
  name: string;
  resetUrl: string;
}): { subject: string; html: string } {
  const subject = "Reset your VFarmers password";
  const html = base(
    `${badge("Password Reset", GOLD)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:${TEXT};">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${MUTED};line-height:1.7;">
      Hi ${params.name}, we received a request to reset the password for your VFarmers account. Click the button below to choose a new password.
    </p>
    <div style="text-align:center;margin:28px 0;">
      ${btn(params.resetUrl, "Reset Password", GOLD)}
    </div>
    ${divider()}
    <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6;">
      This link expires in <strong style="color:${TEXT};">1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password won't change.
    </p>`,
    "Reset your VFarmers password.",
  );
  return { subject, html };
}

/** Deposit approved */
export function depositApprovedTemplate(params: {
  name: string;
  amount: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const subject = `Deposit approved · ${params.amount} credited`;
  const html = base(
    `${badge("Deposit Approved", PRIMARY)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:${TEXT};">Your deposit was approved 🎉</h1>
    <p style="margin:0 0 16px;font-size:15px;color:${MUTED};line-height:1.7;">
      Hi ${params.name}, your deposit of <strong style="color:${TEXT};">${params.amount}</strong> has been approved and credited to your Primary Wallet.
    </p>
    <div style="background-color:${BG};border:1px solid ${BORDER};border-radius:12px;padding:20px;margin:16px 0 24px;text-align:center;">
      <p style="margin:0;font-size:13px;color:${MUTED};text-transform:uppercase;letter-spacing:0.8px;">Amount Credited</p>
      <p style="margin:8px 0 0;font-size:32px;font-weight:700;color:${PRIMARY};">${params.amount}</p>
    </div>
    <div style="text-align:center;">
      ${btn(params.dashboardUrl, "View My Wallet")}
    </div>`,
    `Your deposit of ${params.amount} has been approved.`,
  );
  return { subject, html };
}

/** Cycle reaped */
export function cycleReapedTemplate(params: {
  name: string;
  total: string;
  reward: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const subject = `Harvest time! ${params.reward} earned 🌾`;
  const html = base(
    `${badge("Cycle Complete", GOLD)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:${TEXT};">Your cycle has matured, ${params.name}! 🌾</h1>
    <p style="margin:0 0 16px;font-size:15px;color:${MUTED};line-height:1.7;">
      Great news! Your farming cycle has matured. You've earned <strong style="color:${GOLD};">${params.reward}</strong> in rewards.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${BG};border:1px solid ${BORDER};border-radius:12px;margin:16px 0 24px;">
      <tr>
        <td align="center" style="padding:20px;border-right:1px solid ${BORDER};">
          <p style="margin:0;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.8px;">Reward Earned</p>
          <p style="margin:6px 0 0;font-size:24px;font-weight:700;color:${GOLD};">${params.reward}</p>
        </td>
        <td align="center" style="padding:20px;">
          <p style="margin:0;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.8px;">Total Received</p>
          <p style="margin:6px 0 0;font-size:24px;font-weight:700;color:${PRIMARY};">${params.total}</p>
        </td>
      </tr>
    </table>
    <div style="text-align:center;">
      ${btn(params.dashboardUrl, "View My Farm", GOLD)}
    </div>`,
    `You earned ${params.reward} — your farming cycle has matured!`,
  );
  return { subject, html };
}

/** Merchant welcome */
export function merchantWelcomeTemplate(params: {
  businessName: string;
  contactName: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const subject = `Welcome to the VFarmers Merchant Network, ${params.businessName}!`;
  const html = base(
    `${badge("Merchant Partner", GOLD)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:${TEXT};">Welcome, ${params.businessName}! 🏪</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${MUTED};line-height:1.7;">
      Hi ${params.contactName}, your merchant account is now active. You can redeem coupons to fund your wallet, and transfer USDT directly to farmers' wallets at the live conversion rate.
    </p>
    ${[
      ["🎟️", "Redeem coupons", "Top up your merchant USDT wallet with merchant-issued coupons."],
      ["⚡", "Fund farmers instantly", "Transfer USDT to any farmer — it converts to Seed at the live rate."],
      ["💼", "Lower cost, higher margin", "Buy at exclusive merchant pricing and set your own resale rate."],
    ]
      .map(
        ([icon, title, desc]) => `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:12px;">
      <tr>
        <td style="width:36px;font-size:20px;vertical-align:top;padding-top:2px;">${icon}</td>
        <td>
          <p style="margin:0;font-size:14px;font-weight:600;color:${TEXT};">${title}</p>
          <p style="margin:2px 0 0;font-size:13px;color:${MUTED};">${desc}</p>
        </td>
      </tr>
    </table>`,
      )
      .join("")}
    <div style="text-align:center;margin-top:24px;">
      ${btn(params.dashboardUrl, "Go to Merchant Dashboard", GOLD)}
    </div>`,
    `Your VFarmers merchant account is active. Partner. Profit. Prosper.`,
  );
  return { subject, html };
}
