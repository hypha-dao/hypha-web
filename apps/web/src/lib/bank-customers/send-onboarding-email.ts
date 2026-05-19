import { sendEmailByAlias } from '@hypha-platform/notifications/server';

type SendBankOnboardingEmailInput = {
  personSlug: string;
  recipientEmail: string;
  spaceTitle: string;
  legalName: string;
  kycLink: string;
  tosLink?: string | null;
};

function buildOnboardingEmailBody({
  spaceTitle,
  legalName,
  kycLink,
  tosLink,
}: Pick<
  SendBankOnboardingEmailInput,
  'spaceTitle' | 'legalName' | 'kycLink' | 'tosLink'
>): string {
  const intro = `<p>Enabling bank transfers to <strong>${spaceTitle}</strong> (${legalName}) requires verification through our banking partner.</p>`;

  if (tosLink) {
    return `${intro}
<ol>
  <li><strong>Accept the Terms of Service first.</strong> <a href="${tosLink}">Open the Terms of Service</a></li>
  <li><strong>Then complete business verification (KYB).</strong> <a href="${kycLink}">Open the verification form</a></li>
</ol>
<p>Please complete both steps in this order. The verification form may not work until you have accepted the terms. These links are unique to your organization.</p>
<p>If you did not request this, you can ignore this email.</p>`;
  }

  return `${intro}
<p><a href="${kycLink}">Open the verification form</a> to continue. This link is unique to your organization.</p>
<p>If you did not request this, you can ignore this email.</p>`;
}

export async function sendBankOnboardingEmail({
  personSlug,
  recipientEmail,
  spaceTitle,
  legalName,
  kycLink,
  tosLink,
}: SendBankOnboardingEmailInput) {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
  if (!appId) {
    throw new Error('Missing NEXT_PUBLIC_ONESIGNAL_APP_ID');
  }

  await sendEmailByAlias({
    app_id: appId,
    alias: {
      include_aliases: { external_id: [personSlug] },
      email_to: [recipientEmail],
    },
    content: {
      email_subject: tosLink
        ? `Complete bank verification for ${legalName}`
        : `Complete KYB for ${legalName}`,
      email_body: buildOnboardingEmailBody({
        spaceTitle,
        legalName,
        kycLink,
        tosLink,
      }),
    },
  });
}
