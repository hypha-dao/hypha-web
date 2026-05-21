import { sendEmailNotificationsTemplateToEmails } from '@hypha-platform/notifications/server';

type SendBankOnboardingEmailInput = {
  recipientEmail: string;
  spaceTitle: string;
  legalName: string;
  kycLink: string;
  tosLink?: string | null;
};

/**
 * Sends the banking KYB onboarding email to the contact address entered in the
 * form (often a compliance officer or treasurer, not the Hypha member who started
 * setup). When `EMAIL_TEMPLATE_BANK_KYB_ONBOARDING` is unset, logs the payload
 * and skips the API call.
 */
export async function sendBankOnboardingEmail({
  recipientEmail,
  spaceTitle,
  legalName,
  kycLink,
  tosLink,
}: SendBankOnboardingEmailInput) {
  const templateId =
    process.env.EMAIL_TEMPLATE_BANK_KYB_ONBOARDING?.trim() ?? '';

  /** OneSignal template keys: space_title, legal_name, kyc_link, optional tos_link */
  const customData: Record<string, string> = {
    space_title: spaceTitle,
    legal_name: legalName,
    kyc_link: kycLink,
  };

  if (tosLink) {
    customData.tos_link = tosLink;
  }

  if (!templateId) {
    console.log(
      '[bank-kyb] Skipping OneSignal send — EMAIL_TEMPLATE_BANK_KYB_ONBOARDING is not set. Would send:',
      {
        recipientEmail,
        customData,
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
    console.log('[bank-kyb] OneSignal onboarding email sent', {
      recipientEmail,
      templateId,
      customData,
    });
  }
}
