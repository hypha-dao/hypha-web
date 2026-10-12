import 'server-only';
import { sendEmailNotificationsTemplateToEmails } from '@hypha-platform/notifications/server';

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
 * Tells the Hypha team that an integration client was requested (#2515). Best
 * effort: the stored `pending` record is the source of truth, so a missing
 * config or a failed send is logged and never fails the request.
 *
 * OneSignal template keys (escape every one of them in the template — they come
 * from a requester): client_name, slug, contact_email, description, scopes,
 * allowed_origins, requester_name, requester_slug.
 */
export async function sendClientRequestEmail(
  input: SendClientRequestEmailInput,
) {
  const templateId =
    process.env.EMAIL_TEMPLATE_INTEGRATION_CLIENT_REQUEST?.trim() ?? '';
  const recipientEmail =
    process.env.INTEGRATION_CLIENT_REQUEST_NOTIFY_EMAIL?.trim() ?? '';

  if (!templateId || !recipientEmail) {
    console.warn(
      '[integration-client] Skipping request email — EMAIL_TEMPLATE_INTEGRATION_CLIENT_REQUEST or INTEGRATION_CLIENT_REQUEST_NOTIFY_EMAIL is not set',
      { slug: input.slug },
    );
    return;
  }

  try {
    await sendEmailNotificationsTemplateToEmails({
      templateId,
      customData: {
        client_name: input.clientName,
        slug: input.slug,
        contact_email: input.contactEmail,
        description: input.description ?? '',
        scopes: input.scopes.join(', '),
        allowed_origins: input.allowedOrigins.join(', ') || '—',
        requester_name: input.requesterName,
        requester_slug: input.requesterSlug ?? '',
      },
      emails: [recipientEmail],
    });
  } catch (error) {
    console.error('[integration-client] Failed to send request email', {
      slug: input.slug,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
