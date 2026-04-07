import type { Email } from './types';
import type { ProposalSettlementProps } from '../common';

export function emailProposalRejectionForCreator({
  creatorName,
  proposalLabel,
  proposalState = 'proposal',
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Email {
  const beginning = creatorName
    ? `Dear ${creatorName}, unfortunately,`
    : 'Unfortunately,';
  const space = spaceTitle ? `the space "${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : proposalState;

  switch (proposalLabel) {
    case 'Invite':
      return {
        subject: 'Your request to join a space was rejected',
        body: `${beginning} your request to join ${space} was rejected.`,
      };

    default:
      return {
        subject: `Your ${proposalState} was rejected`,
        body: `${beginning} your ${proposal} was rejected in ${space}.`,
      };
  }
}
