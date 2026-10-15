import 'server-only';
import {
  sendEmailNotificationsTemplateToEmails,
  sendEmailNotificationsToEmails,
} from '@hypha-platform/notifications/server';
import { emailBankEmailConfirmation } from '@hypha-platform/notifications/template';
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
 * Rendered in code (#2549 D14/D15). While `EMAIL_TEMPLATE_BANK_EMAIL_CONFIRMATION` is still set,
 * the OneSignal dashboard template is used instead (rollout fallback, D12). Without OneSignal
 * configured outside production the link is logged for local testing.
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

  if (!templateId && !process.env.ONESIGNAL_APP_ID?.trim()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ONESIGNAL_APP_ID is not set — cannot send the bank email confirmation link',
      );
    }
    // Structurally unreachable in production (the throw above always fires there), so the token
    // can only land in a developer's local console — which is the point: it is the supported way
    // to test the confirmation flow without OneSignal.
    console.log(
      '[bank-email-confirmation] Skipping OneSignal send — ONESIGNAL_APP_ID is not set. Would send:',
      { recipientEmail, ownerLabel, verifyLink },
    );
    return;
  }

  if (templateId) {
    /** OneSignal template keys: owner_label, verify_link */
    await sendEmailNotificationsTemplateToEmails({
      templateId,
      customData: { owner_label: ownerLabel, verify_link: verifyLink },
      emails: [recipientEmail],
    });
  } else {
    const email = emailBankEmailConfirmation({
      ownerLabel,
      verifyLink,
      appUrl: getAbsoluteAppUrl(''),
    });
    await sendEmailNotificationsToEmails({
      subject: email.subject,
      preheader: email.preheader,
      body: email.body,
      emails: [recipientEmail],
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[bank-email-confirmation] OneSignal confirmation email sent', {
      recipientEmail,
      templateId: templateId || 'code',
      verifyLink: redactedVerifyLink,
    });
  }
}
