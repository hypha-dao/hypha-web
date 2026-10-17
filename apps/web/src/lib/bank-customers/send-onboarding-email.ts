import 'server-only';
import { sendEmailNotificationsToEmails } from '@hypha-platform/notifications/server';
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
 * Rendered in code (#2549 D14/D15). Without `ONESIGNAL_APP_ID` it logs the payload and skips
 * the send.
 */
export async function sendBankOnboardingEmail({
  recipientEmail,
  spaceTitle,
  legalName,
  kycLink,
  tosLink,
}: SendBankOnboardingEmailInput) {
  if (!process.env.ONESIGNAL_APP_ID?.trim()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        '[bank-kyb] Skipping OneSignal send — ONESIGNAL_APP_ID is not set. Would send:',
        { recipientEmail, spaceTitle, legalName, kycLink, tosLink },
      );
    }
    return;
  }

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

  if (process.env.NODE_ENV !== 'production') {
    console.log('[bank-kyb] OneSignal onboarding email sent', {
      recipientEmail,
    });
  }
}
