import type { Email } from './types';
import type { ProposalSettlementProps } from '../common';

export function emailProposalExecutionForMembers({
  creatorName = 'Someone',
  proposalLabel,
  proposalState = 'proposal',
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Email {
  const space = spaceTitle ? `the space "${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : `a ${proposalState}`;

  switch (proposalLabel) {
    case 'Invite':
      return {
        subject: 'New member in one of your spaces',
        body: `${creatorName} successfully joined ${space}.`,
      };

    default:
      return {
        subject: `Successful ${proposalState} execution in one of your spaces`,
        body: `${proposal} was successfully executed in ${space}.`,
      };
  }
}
