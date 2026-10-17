import type { Push } from './types';
import type { ProposalSettlementProps } from '../common';

/** Dashboard: "[PUSH] Proposal - Rejected - for Creator". */
export function pushProposalRejectionForCreator({
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Push {
  const space = spaceTitle?.trim() || 'your space';

  if (proposalLabel === 'Invite') {
    return {
      headings: { en: 'Your join request was rejected' },
      contents: { en: `Your request to join ${space} was rejected.` },
    };
  }

  const title = proposalTitle?.trim();
  return {
    headings: { en: 'Your proposal was rejected' },
    contents: {
      en: `Your proposal${
        title ? ` “${title}”` : ''
      } was rejected in ${space}.`,
    },
  };
}
