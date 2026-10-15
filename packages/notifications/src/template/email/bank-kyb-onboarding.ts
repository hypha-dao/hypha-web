import type { Email } from './types';
import {
  escapeHtml,
  layout,
  paragraph,
  paragraphHtml,
  steps,
  strong,
} from '../common/layout';

/**
 * Banking KYB onboarding: goes to the contact address entered in the bank form (often a
 * compliance officer, not a Hypha member), so it is transactional — no settings link, no
 * unsubscribe. The Terms-of-Service step is only present when a `tosLink` is supplied.
 */
export function emailBankKybOnboarding({
  spaceTitle,
  legalName,
  kycLink,
  tosLink,
  appUrl,
}: {
  spaceTitle: string;
  legalName: string;
  kycLink: string;
  tosLink?: string | null;
  appUrl?: string;
}): Email {
  const subject = `Complete bank setup for ${spaceTitle}`;
  const preheader = tosLink
    ? `Accept the Terms of Service and complete business verification to enable bank transfers for ${spaceTitle}.`
    : `Complete business verification to enable bank transfers for ${spaceTitle}.`;

  const kycItem = `<a href="${escapeHtml(
    kycLink,
  )}">Complete business verification</a><br /><span class="muted">Organization: ${escapeHtml(
    legalName,
  )}</span>`;

  const stepsHtml = tosLink
    ? steps([
        `<a href="${escapeHtml(tosLink)}">Accept the Terms of Service</a>`,
        kycItem,
      ])
    : paragraphHtml(kycItem);

  const body = layout({
    title: 'Hypha Bank Deposit Setup',
    preheader,
    greeting: null,
    appUrl,
    contentHtml: [
      paragraphHtml(
        `Your space ${strong(
          spaceTitle,
        )} is almost ready to receive bank transfers.`,
      ),
      paragraph('Complete the steps below to finish setup:'),
      stepsHtml,
      paragraph(
        "These links are personal to your organization — if you weren't expecting this, you can safely ignore this email.",
      ),
    ].join(''),
  });

  return { subject, preheader, body };
}
