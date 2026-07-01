/**
 * POST /api/email/send-confirm
 *
 * Called by a Supabase Auth webhook (trigger: "email.signup") to send a
 * branded confirmation email via Resend instead of Supabase's default.
 *
 * Supabase sends:
 *   POST body: { type: "signup", email: string, data: { confirmation_url: string } }
 *   Header:    x-webhook-secret: <SUPABASE_WEBHOOK_SECRET>
 *
 * Set SUPABASE_WEBHOOK_SECRET in Vercel env vars.
 * Set it in Supabase: Dashboard → Auth → Hooks → Send Email → secret.
 */

import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/email/send-confirm")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // 1. Verify webhook secret
        const secret = process.env.SUPABASE_WEBHOOK_SECRET;
        if (secret) {
          const header = request.headers.get("x-webhook-secret");
          if (header !== secret) {
            return json({ ok: false, error: "unauthorized" }, 401);
          }
        }

        // 2. Parse body
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "invalid_json" }, 400);
        }

        const b = body as Record<string, unknown>;
        const type = b.type as string | undefined;
        const email = b.email as string | undefined;
        const data = (b.data ?? {}) as Record<string, unknown>;
        const confirmationUrl = data.confirmation_url as string | undefined;
        const name = (data.name as string | undefined) ?? email?.split("@")[0] ?? "Farmer";

        if (!email) return json({ ok: false, error: "missing_email" }, 400);

        // 3. Route to correct template
        const { sendConfirmEmail, sendPasswordResetEmail, sendWelcomeEmail } =
          await import("@/lib/email/service");

        let result;

        if (type === "signup" || type === "email_change") {
          if (!confirmationUrl) return json({ ok: false, error: "missing_url" }, 400);
          result = await sendConfirmEmail({ to: email, name, confirmUrl: confirmationUrl });
        } else if (type === "recovery") {
          const resetUrl = confirmationUrl ?? data.reset_url as string;
          if (!resetUrl) return json({ ok: false, error: "missing_url" }, 400);
          result = await sendPasswordResetEmail({ to: email, name, resetUrl });
        } else if (type === "magiclink") {
          // Treat magic link like confirmation
          if (!confirmationUrl) return json({ ok: false, error: "missing_url" }, 400);
          result = await sendConfirmEmail({ to: email, name, confirmUrl: confirmationUrl });
        } else {
          // Unknown type — send a generic welcome
          result = await sendWelcomeEmail({ to: email, name });
        }

        if (!result.ok) {
          console.error("[email webhook] send failed:", result.error);
          return json({ ok: false, error: result.error }, 500);
        }

        return json({ ok: true, id: (result as { id: string }).id });
      },
    },
  },
});
