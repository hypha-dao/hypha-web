import type { Push } from './types';
import type { ProposalSettlementProps } from '../common';

/** Dashboard: "[PUSH] Proposal - Accepted - for Members". */
export function pushProposalExecutionForMembers({
  creatorName,
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Push {
  const space = spaceTitle?.trim() || 'your space';

  if (proposalLabel === 'Invite') {
    return {
      headings: { en: `New member in ${space}` },
      contents: {
        en: `${creatorName?.trim() || 'Someone'} successfully joined ${space}.`,
      },
    };
  }

  const title = proposalTitle?.trim();
  return {
    headings: { en: `A proposal was accepted in ${space}` },
    contents: {
      en: `A proposal${title ? ` “${title}”` : ''} was accepted.`,
    },
  };
}
