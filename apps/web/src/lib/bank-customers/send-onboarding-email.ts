import 'server-only';
import {
  sendEmailNotificationsTemplateToEmails,
  sendEmailNotificationsToEmails,
} from '@hypha-platform/notifications/server';
import { emailBankKybOnboarding } from '@hypha-platform/notifications/template';
import { getAbsoluteAppUrl } from '@hypha-platform/core/server';

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
 * setup).
 *
 * Rendered in code (#2549 D14/D15). While `EMAIL_TEMPLATE_BANK_KYB_ONBOARDING` is
 * still set, the OneSignal dashboard template is used instead (rollout fallback,
 * D12). Without `ONESIGNAL_APP_ID` it logs the payload and skips the send.
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

  if (!templateId && !process.env.ONESIGNAL_APP_ID?.trim()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        '[bank-kyb] Skipping OneSignal send — ONESIGNAL_APP_ID is not set. Would send:',
        { recipientEmail, spaceTitle, legalName, kycLink, tosLink },
      );
    }
    return;
  }

  if (templateId) {
    /** OneSignal template keys: space_title, legal_name, kyc_link, optional tos_link */
    const customData: Record<string, string> = {
      space_title: spaceTitle,
      legal_name: legalName,
      kyc_link: kycLink,
    };
    if (tosLink) customData.tos_link = tosLink;

    await sendEmailNotificationsTemplateToEmails({
      templateId,
      customData,
      emails: [recipientEmail],
    });
  } else {
    const email = emailBankKybOnboarding({
      spaceTitle,
      legalName,
      kycLink,
      tosLink,
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
    console.log('[bank-kyb] OneSignal onboarding email sent', {
      recipientEmail,
      templateId: templateId || 'code',
    });
  }
}
