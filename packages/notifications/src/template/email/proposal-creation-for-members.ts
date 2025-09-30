import type { Email } from './types';
import type { ProposalCreationProps } from '../common';

export function emailProposalCreationForMembers({
  creatorName = 'Someone',
  proposalLabel,
  proposalState = 'proposal',
  proposalTitle,
  spaceTitle,
}: ProposalCreationProps): Email {
  const space = spaceTitle ? `the space "${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : `a ${proposalState}`;

  switch (proposalLabel) {
    case 'Invite':
      return {
        subject: 'New join request to one of your spaces',
        body: `${creatorName} wants to join ${space}.`,
      };

    default:
      return {
        subject: `New ${proposalState} has been created in one of your spaces`,
        body: `${creatorName} has created ${proposal} in ${space}.`,
      };
  }
}
