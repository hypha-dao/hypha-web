import type { Email } from './types';
import type { ProposalSettlementProps } from '../common';

export function emailProposalExecutionForCreator({
  creatorName,
  proposalLabel,
  proposalState = 'proposal',
  proposalTitle,
  spaceTitle,
}: ProposalSettlementProps): Email {
  const congratulation = creatorName
    ? `Congratulations, ${creatorName},`
    : 'Congratulations,';
  const space = spaceTitle ? `the space "${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : proposalState;

  switch (proposalLabel) {
    case 'Invite':
      return {
        subject: 'Successful joined a space',
        body: `${congratulation} you've successfully joined ${space}.`,
      };

    default:
      return {
        subject: `Successful ${proposalState} execution`,
        body: `${congratulation} your ${proposal} was successfully executed in ${space}.`,
      };
  }
}
