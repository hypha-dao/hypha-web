import type { Push } from './types';
import type { ProposalSettlementProps } from '../common';

export function pushProposalRejectionForCreator({
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
        contents: { en: `Your request to join ${space} was rejected.` },
        headings: { en: 'Your request to join a space was rejected' },
      };

    default:
      return {
        contents: { en: `Your ${proposal} was rejected in ${space}.` },
        headings: { en: `Your ${proposalState} was rejected` },
      };
  }
}
