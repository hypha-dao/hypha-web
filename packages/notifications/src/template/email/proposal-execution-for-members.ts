import type { Email } from './types';
import type { ProposalSettlementProps } from '../common';
import { proposalEmail, quotedTitleHtml, strong } from './proposal-email';

export function emailProposalExecutionForMembers({
  creatorName = 'Someone',
  proposalLabel,
  proposalTitle,
  spaceTitle,
  url,
  settingsUrl,
  appUrl,
}: ProposalSettlementProps): Email {
  const space = spaceTitle?.trim() || 'your space';
  const links = { url, settingsUrl, appUrl };

  if (proposalLabel === 'Invite') {
    return proposalEmail({
      subject: `New member in ${space}`,
      preheader: 'See the outcome.',
      statementHtml: `${strong(creatorName)} successfully joined ${strong(
        space,
      )}.`,
      ...links,
    });
  }

  return proposalEmail({
    subject: `A proposal was accepted in ${space}`,
    preheader: proposalTitle?.trim() || 'See the outcome.',
    statementHtml: `The proposal${quotedTitleHtml(proposalTitle)} was ${strong(
      'accepted',
    )} in ${strong(space)}.`,
    ...links,
  });
}
