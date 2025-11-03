import type { Push } from './types';
import type { ProposalSettlementProps } from '../common';

export function pushProposalExecutionForCreator({
  proposalState = 'proposal',
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Push {
  const space = spaceTitle ? `the space "${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : proposalState;

  switch (proposalLabel) {
    case 'Invite':
      return {
        contents: { en: `You've successfully joined ${space}.` },
        headings: { en: 'Successfully joined a space' },
      };

    default:
      return {
        contents: {
          en: `Your ${proposal} was successfully executed in ${space}.`,
        },
        headings: { en: `Successful ${proposalState} execution` },
      };
  }
}
