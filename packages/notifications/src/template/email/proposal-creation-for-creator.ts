import type { Email } from './types';
import type { ProposalCreationProps } from '../common';
import { proposalEmail, quotedTitleHtml, strong } from './proposal-email';

export function emailProposalCreationForCreator({
  proposalLabel,
  proposalTitle,
  spaceTitle,
  url,
  settingsUrl,
  appUrl,
}: ProposalCreationProps): Email {
  const space = spaceTitle?.trim() || 'your space';
  const links = { url, settingsUrl, appUrl };

  if (proposalLabel === 'Invite') {
    return proposalEmail({
      subject: 'Your invite to join a space has been created',
      preheader: 'Your invite is ready.',
      statementHtml: `Your invite to join ${strong(space)} has been created.`,
      ...links,
    });
  }

  return proposalEmail({
    subject: `Your proposal has been created in ${space}`,
    preheader: proposalTitle?.trim() || 'Members can now cast their votes.',
    statementHtml: `Your proposal${quotedTitleHtml(
      proposalTitle,
    )} has been created in ${strong(space)}.`,
    ...links,
  });
}
