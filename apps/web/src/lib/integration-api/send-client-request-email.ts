import 'server-only';
import { getAbsoluteAppUrl } from '@hypha-platform/core/server';
import { sendEmailNotificationsToEmails } from '@hypha-platform/notifications/server';
import { emailIntegrationClientRequest } from '@hypha-platform/notifications/template';

type SendClientRequestEmailInput = {
  clientName: string;
  slug: string;
  contactEmail: string;
  description: string | null;
  scopes: string[];
  allowedOrigins: string[];
  requesterName: string;
  requesterSlug: string | null;
};

/**
 * Tells the Hypha team that an integration client was requested (#2515).
 * Rendered in code (#2549 D14/D15). Best effort: the stored `pending` record is
 * the source of truth, so a missing config or a failed send is logged and never
 * fails the request.
 */
export async function sendClientRequestEmail(
  input: SendClientRequestEmailInput,
) {
  const recipientEmail =
    process.env.INTEGRATION_CLIENT_REQUEST_NOTIFY_EMAIL?.trim() ?? '';

  if (!recipientEmail || !process.env.ONESIGNAL_APP_ID?.trim()) {
    console.warn(
      '[integration-client] Skipping request email — INTEGRATION_CLIENT_REQUEST_NOTIFY_EMAIL or ONESIGNAL_APP_ID is not set',
      { slug: input.slug },
    );
    return;
  }

  try {
    const email = emailIntegrationClientRequest({
      ...input,
      appUrl: getAbsoluteAppUrl(''),
    });
    await sendEmailNotificationsToEmails({
      subject: email.subject,
      preheader: email.preheader,
      body: email.body,
      emails: [recipientEmail],
    });
  } catch (error) {
    console.error('[integration-client] Failed to send request email', {
      slug: input.slug,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
