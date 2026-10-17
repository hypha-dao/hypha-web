import type { Push } from './types';
import type { ProposalSettlementProps } from '../common';

/**
 * No dashboard template exists for this one; it mirrors "[PUSH] Proposal - Accepted - for
 * Members" so the set stays consistent.
 */
export function pushProposalRejectionForMembers({
  creatorName,
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Push {
  const space = spaceTitle?.trim() || 'your space';

  if (proposalLabel === 'Invite') {
    return {
      headings: { en: `Join request was rejected in ${space}` },
      contents: {
        en: `${creatorName?.trim() || 'Someone'}’s join request was rejected.`,
      },
    };
  }

  const title = proposalTitle?.trim();
  return {
    headings: { en: `A proposal was rejected in ${space}` },
    contents: {
      en: `A proposal${title ? ` “${title}”` : ''} was rejected.`,
    },
  };
}
