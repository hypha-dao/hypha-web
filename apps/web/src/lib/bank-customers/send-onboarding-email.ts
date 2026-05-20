import { sendEmailNotificationsTemplate } from '@hypha-platform/notifications/server';

type SendBankOnboardingEmailInput = {
  personSlug: string;
  recipientEmail: string;
  spaceTitle: string;
  legalName: string;
  kycLink: string;
  tosLink?: string | null;
};

/**
 * Sends the banking KYB onboarding email via OneSignal template.
 * When `NEXT_PUBLIC_EMAIL_TEMPLATE_BANK_KYB_ONBOARDING` is unset, logs payload
 * and skips send (temporary until the OneSignal template is configured).
 */
export async function sendBankOnboardingEmail({
  personSlug,
  recipientEmail,
  spaceTitle,
  legalName,
  kycLink,
  tosLink,
}: SendBankOnboardingEmailInput) {
  const templateId =
    process.env.NEXT_PUBLIC_EMAIL_TEMPLATE_BANK_KYB_ONBOARDING?.trim() ?? '';

  const customData: Record<string, string> = {
    space_title: spaceTitle,
    legal_name: legalName,
    kyc_link: kycLink,
    contact_email: recipientEmail,
  };

  if (tosLink) {
    customData.tos_link = tosLink;
  }

  if (!templateId) {
    console.log(
      '[bank-kyb] Email bypass — NEXT_PUBLIC_EMAIL_TEMPLATE_BANK_KYB_ONBOARDING is not set. Would send:',
      {
        personSlug,
        recipientEmail,
        templateId: '(not configured)',
        customData,
      },
    );
    return;
  }

  await sendEmailNotificationsTemplate({
    templateId,
    customData,
    usernames: [personSlug],
  });
}
