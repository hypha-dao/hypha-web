import type { Email } from './types';
import type { ProposalSettlementProps } from '../common';

export function emailProposalRejectionForMembers({
  creatorName = 'Someone',
  proposalLabel,
  proposalState = 'proposal',
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Email {
  const space = spaceTitle ? `the space "${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : proposalState;

  switch (proposalLabel) {
    case 'Invite':
      return {
        subject: 'Join request was rejected in one of your spaces',
        body: `${creatorName}'s join request to ${space} was rejected.`,
      };

    default:
      return {
        subject: `A ${proposalState} was rejected in one of your spaces`,
        body: `${creatorName}'s ${proposal} was rejected in ${space}.`,
      };
  }
}
