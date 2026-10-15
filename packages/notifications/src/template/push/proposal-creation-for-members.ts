import type { Push } from './types';
import type { ProposalCreationProps } from '../common';

/** Dashboard: "[PUSH] Proposal - Created - for Members". */
export function pushProposalCreationForMembers({
  creatorName,
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalCreationProps): Push {
  const creator = creatorName?.trim() || 'Someone';
  const space = spaceTitle?.trim() || 'your space';

  if (proposalLabel === 'Invite') {
    return {
      headings: { en: `New join request in ${space}` },
      contents: { en: `${creator} wants to join ${space}.` },
    };
  }

  const title = proposalTitle?.trim();
  return {
    headings: { en: `New proposal in ${space}` },
    contents: {
      en: `${creator} created a new proposal${
        title ? ` “${title}”` : ''
      }. Have a look and vote.`,
    },
  };
}
