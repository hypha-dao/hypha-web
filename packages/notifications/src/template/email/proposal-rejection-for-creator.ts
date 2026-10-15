import type { Email } from './types';
import type { ProposalSettlementProps } from '../common';
import { proposalEmail, quotedTitleHtml, strong } from './proposal-email';

export function emailProposalRejectionForCreator({
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
      subject: `Your request to join ${space} was rejected`,
      preheader: 'See the outcome.',
      statementHtml: `Your request to join ${strong(space)} was ${strong(
        'rejected',
      )}. ❌`,
      ...links,
    });
  }

  return proposalEmail({
    subject: `Your proposal was rejected in ${space}`,
    preheader: proposalTitle?.trim() || 'See the outcome.',
    statementHtml: `Your proposal${quotedTitleHtml(proposalTitle)} was ${strong(
      'rejected',
    )} in ${strong(space)}. ❌`,
    ...links,
  });
}
