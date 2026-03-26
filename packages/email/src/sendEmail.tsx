import { render } from "@react-email/render";
import { createLogger } from "@kan/logger";

const log = createLogger("email");

import JoinWorkspaceTemplate from "./templates/join-workspace";
import MagicLinkTemplate from "./templates/magic-link";
import MentionTemplate from "./templates/mention";
import ResetPasswordTemplate from "./templates/reset-password";

type Templates = "MAGIC_LINK" | "JOIN_WORKSPACE" | "RESET_PASSWORD" | "MENTION";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- template props vary per template
const emailTemplates: Record<Templates, React.ComponentType<any>> = {
  MAGIC_LINK: MagicLinkTemplate,
  JOIN_WORKSPACE: JoinWorkspaceTemplate,
  RESET_PASSWORD: ResetPasswordTemplate,
  MENTION: MentionTemplate,
};

export const sendEmail = async (
  to: string,
  subject: string,
  template: Templates,
  data: Record<string, string>,
) => {
  log.info({ to, subject, template }, "Sending email");
  try {
    const EmailTemplate = emailTemplates[template];

    const html = await render(<EmailTemplate {...data} />, { pretty: true });

    const apiKey = process.env.EMAIL_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey) {
      log.warn({ to, subject, template }, "EMAIL_API_KEY not set, skipping email");
      return;
    }

    // Uses Resend API (https://resend.com/docs/api-reference/emails/send-email)
    // Can be swapped for any HTTP-based email API (SendGrid, Mailgun, etc.)
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Email API error ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    log.info({ to, subject, template, id: (result as Record<string, unknown>).id }, "Email sent");
    return result;
  } catch (error) {
    log.error({ err: error, to, from: process.env.EMAIL_FROM, subject, template }, "Email sending failed");
    throw error;
  }
};
