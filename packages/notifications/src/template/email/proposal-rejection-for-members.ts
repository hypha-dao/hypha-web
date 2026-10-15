import type { Email } from './types';
import type { ProposalSettlementProps } from '../common';
import { proposalEmail, quotedTitleHtml, strong } from './proposal-email';

export function emailProposalRejectionForMembers({
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
      subject: `Join request was rejected in ${space}`,
      preheader: 'See the outcome.',
      statementHtml: `${strong(creatorName)}&rsquo;s join request to ${strong(
        space,
      )} was ${strong('rejected')}. ❌`,
      ...links,
    });
  }

  return proposalEmail({
    subject: `A proposal was rejected in ${space}`,
    preheader: proposalTitle?.trim() || 'See the outcome.',
    statementHtml: `A proposal${quotedTitleHtml(proposalTitle)} was ${strong(
      'rejected',
    )} in ${strong(space)}. ❌`,
    ...links,
  });
}
