import type { Push } from './types';
import type { ProposalCreationProps } from '../common';

export function pushProposalCreationForCreator({
  proposalState = 'proposal',
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalCreationProps): Push {
  const space = spaceTitle ? `"${spaceTitle}"` : 'a space';
  const proposal = proposalTitle
    ? `the ${proposalState} "${proposalTitle}"`
    : `a ${proposalState}`;

  switch (proposalLabel) {
    case 'Invite':
      return {
        headings: { en: 'You successfully created a join request' },
        contents: { en: `Your request to join ${space} was created.` },
      };

    default:
      return {
        headings: {
          en: `You successfully created ${proposal}`,
        },
        contents: {
          en: `Your ${proposal} was successfully created in ${space}.`,
        },
      };
  }
}
