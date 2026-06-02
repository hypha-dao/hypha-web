import { sendEmailNotificationsTemplateToEmails } from '@hypha-platform/notifications/server';
import { getAbsoluteAppUrl } from '@hypha-platform/core/server';

type SendEmailConfirmationInput = {
  recipientEmail: string;
  spaceTitle: string;
  signedJwt: string;
  locale?: string;
};

/**
 * Sends the pre-KYB email ownership confirmation message. When
 * `EMAIL_TEMPLATE_BANK_EMAIL_CONFIRMATION` is unset, logs the payload and skips
 * the API call.
 */
export async function sendEmailConfirmation({
  recipientEmail,
  spaceTitle,
  signedJwt,
  locale = 'en',
}: SendEmailConfirmationInput) {
  const templateId =
    process.env.EMAIL_TEMPLATE_BANK_EMAIL_CONFIRMATION?.trim() ?? '';

  const confirmationLink = getAbsoluteAppUrl(
    `/${locale}/verify/banking?token=${encodeURIComponent(signedJwt)}`,
  );

  /** OneSignal template keys: space_title, confirmation_link, expires_in */
  const customData: Record<string, string> = {
    space_title: spaceTitle,
    confirmation_link: confirmationLink,
    expires_in: '72 hours',
  };

  if (!templateId) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        '[bank-email-confirm] Skipping OneSignal send — EMAIL_TEMPLATE_BANK_EMAIL_CONFIRMATION is not set. Would send:',
        {
          recipientEmail,
          customData,
        },
      );
    }
    return;
  }

  await sendEmailNotificationsTemplateToEmails({
    templateId,
    customData,
    emails: [recipientEmail],
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('[bank-email-confirm] OneSignal confirmation email sent', {
      recipientEmail,
      templateId,
      customData,
    });
  }
}
