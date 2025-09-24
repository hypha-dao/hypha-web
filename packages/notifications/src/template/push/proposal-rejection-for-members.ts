import type { Push } from './types';
import type { ProposalSettlementProps } from '../common';

export function pushProposalRejectionForMembers({
  creatorName = 'Someone',
  proposalState = 'proposal',
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Push {
  const space = spaceTitle ? `the space "${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : `a ${proposalState}`;

  switch (proposalLabel) {
    case 'Invite':
      return {
        headings: { en: 'A join request in one of your spaces' },
        contents: {
          en: `${creatorName}'s join request was rejected in ${space}.`,
        },
      };

    default:
      return {
        headings: {
          en: `A ${proposalState} was rejected in one of your spaces`,
        },
        contents: { en: `${proposal} was rejected in ${space}.` },
      };
  }
}
