import type { Email } from './types';
import {
  button,
  escapeHtml,
  layout,
  muted,
  paragraph,
  paragraphHtml,
  strong,
} from '../common/layout';

/**
 * Bank email-ownership confirmation (#2288): sent to whatever address was entered in the bank
 * form, so it is transactional — no settings link, no unsubscribe.
 */
export function emailBankEmailConfirmation({
  ownerLabel,
  verifyLink,
  appUrl,
}: {
  ownerLabel: string;
  verifyLink: string;
  appUrl?: string;
}): Email {
  const subject = `Authorize your email for bank integration – ${ownerLabel}`;
  const preheader = `Confirm this email address to continue bank setup for ${ownerLabel}.`;

  const body = layout({
    title: 'Authorize your email for bank integration',
    preheader,
    greeting: null,
    appUrl,
    contentHtml: [
      paragraphHtml(
        `${strong(ownerLabel)} on Hypha has requested to register this email address with their banking provider (Bridge).`,
      ),
      paragraph('Click the button below to confirm.'),
      button('Authorize email', verifyLink),
      muted(
        `Or copy and paste this link into your browser:<br />${escapeHtml(verifyLink)}`,
      ),
      paragraph(
        'If you were not expecting this email or do not recognize the name above, you can safely ignore it — no action is required.',
      ),
    ].join(''),
  });

  return { subject, preheader, body };
}
