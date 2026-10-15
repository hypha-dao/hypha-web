import type { Email } from './types';
import type { ProposalCreationProps } from '../common';
import { proposalEmail, quotedTitleHtml, strong } from './proposal-email';

export function emailProposalCreationForMembers({
  creatorName = 'Someone',
  proposalLabel,
  proposalTitle,
  spaceTitle,
  url,
  settingsUrl,
  appUrl,
}: ProposalCreationProps): Email {
  const space = spaceTitle?.trim() || 'your space';
  const links = { url, settingsUrl, appUrl };
  const preheader = proposalTitle?.trim() || 'Have a look and cast your vote.';

  if (proposalLabel === 'Invite') {
    return proposalEmail({
      subject: `New join request in ${space}`,
      preheader,
      statementHtml: `${strong(creatorName)} wants to join ${strong(space)}.`,
      ...links,
    });
  }

  return proposalEmail({
    subject: `New proposal in ${space}`,
    preheader,
    statementHtml: `${strong(
      creatorName,
    )} created a new proposal${quotedTitleHtml(proposalTitle)} in ${strong(
      space,
    )}.`,
    followUps: ['Have a look and cast your vote.'],
    ...links,
  });
}
