import type { Push } from './types';
import type { ProposalSettlementProps } from '../common';

/** Dashboard: "[PUSH] Proposal - Accepted - for Creator". */
export function pushProposalExecutionForCreator({
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Push {
  const space = spaceTitle?.trim() || 'your space';

  if (proposalLabel === 'Invite') {
    return {
      headings: { en: `You joined ${space}` },
      contents: { en: `You’ve successfully joined ${space}.` },
    };
  }

  const title = proposalTitle?.trim();
  return {
    headings: { en: 'Your proposal was accepted' },
    contents: {
      en: `Your proposal${
        title ? ` “${title}”` : ''
      } was accepted in ${space}.`,
    },
  };
}
