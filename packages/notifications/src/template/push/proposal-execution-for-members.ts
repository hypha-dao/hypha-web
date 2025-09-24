import type { Push } from './types';
import type { ProposalSettlementProps } from '../common';

export function pushProposalExecutionForMembers({
  creatorName = 'Someone',
  proposalState = 'proposal',
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Push {
  const space = spaceTitle ? `the space "${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : `A ${proposalState}`;

  switch (proposalLabel) {
    case 'Invite':
      return {
        headings: { en: 'New successful join in one of your spaces' },
        contents: { en: `${creatorName} successfully joined ${space}.` },
      };

    default:
      return {
        headings: {
          en: `A ${proposalState} was successfully executed in one of your spaces`,
        },
        contents: {
          en: `${proposal} was successfully executed in ${space}.`,
        },
      };
  }
}
