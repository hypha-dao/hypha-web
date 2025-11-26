import type { Push } from './types';
import type { ProposalCreationProps } from '../common';

export function pushProposalCreationForMembers({
  creatorName = 'Someone',
  proposalState = 'proposal',
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalCreationProps): Push {
  const space = spaceTitle ? `"${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : `a ${proposalState}`;

  switch (proposalLabel) {
    case 'Invite':
      return {
        headings: { en: 'New join request to one of your spaces' },
        contents: { en: `${creatorName} created a join request to ${space}.` },
      };

    default:
      return {
        headings: {
          en: `New ${proposalState} was created in one of your spaces`,
        },
        contents: { en: `A new ${proposal} was just created in ${space}.` },
      };
  }
}
