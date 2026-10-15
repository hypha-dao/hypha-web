import type { Email } from './types';
import type { ProposalSettlementProps } from '../common';
import { proposalEmail, quotedTitleHtml, strong } from './proposal-email';

export function emailProposalExecutionForCreator({
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
      subject: `You joined ${space}`,
      preheader: 'See the outcome.',
      statementHtml: `You&rsquo;ve successfully joined ${strong(space)}. ✅`,
      ...links,
    });
  }

  return proposalEmail({
    subject: `Your proposal was accepted in ${space}`,
    preheader: proposalTitle?.trim() || 'See the outcome.',
    statementHtml: `Your proposal${quotedTitleHtml(proposalTitle)} was ${strong(
      'accepted',
    )} in ${strong(space)}. ✅`,
    ...links,
  });
}
