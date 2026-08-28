import { sendEmailNotificationsTemplateToEmails } from '@hypha-platform/notifications/server';
import { getAbsoluteAppUrl } from '@hypha-platform/core/server';

type SendBankEmailConfirmationEmailInput = {
  recipientEmail: string;
  ownerLabel: string;
  token: string;
};

/**
 * Sends the #2288 email-ownership confirmation link — a consent step distinct from the KYB
 * onboarding email (`sendBankOnboardingEmail`): this goes to whatever address was entered in the
 * form, to prove the submitter doesn't control an inbox they don't actually own, before Hypha ever
 * calls Bridge with it.
 *
 * Unlike `sendBankOnboardingEmail`, an unset `EMAIL_TEMPLATE_BANK_EMAIL_CONFIRMATION` is only
 * tolerated outside production (logs the payload and skips the API call, for local testing without
 * an OneSignal template) — in production it throws, so a missing template surfaces as a failed
 * request instead of silently leaving the submitter stuck in "pending confirmation" forever with no
 * way to receive the link.
 */
export async function sendBankEmailConfirmationEmail({
  recipientEmail,
  ownerLabel,
  token,
}: SendBankEmailConfirmationEmailInput) {
  const templateId =
    process.env.EMAIL_TEMPLATE_BANK_EMAIL_CONFIRMATION?.trim() ?? '';

  const verifyLink = getAbsoluteAppUrl(
    `/en/verify/banking?token=${encodeURIComponent(token)}`,
  );
  // Never log the token itself — it's a bearer credential for the confirmation.
  const redactedVerifyLink = verifyLink.split('?')[0] + '?token=<redacted>';

  /** OneSignal template keys: owner_label, verify_link */
  const customData: Record<string, string> = {
    owner_label: ownerLabel,
    verify_link: verifyLink,
  };

  if (!templateId) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'EMAIL_TEMPLATE_BANK_EMAIL_CONFIRMATION is not set — cannot send the bank email confirmation link',
      );
    }
    console.log(
      '[bank-email-confirmation] Skipping OneSignal send — EMAIL_TEMPLATE_BANK_EMAIL_CONFIRMATION is not set. Would send:',
      {
        recipientEmail,
        customData: { ...customData, verify_link: redactedVerifyLink },
      },
    );
    return;
  }

  await sendEmailNotificationsTemplateToEmails({
    templateId,
    customData,
    emails: [recipientEmail],
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('[bank-email-confirmation] OneSignal confirmation email sent', {
      recipientEmail,
      templateId,
      verifyLink: redactedVerifyLink,
    });
  }
}
