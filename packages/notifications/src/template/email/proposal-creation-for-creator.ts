import type { Email } from './types';
import type { ProposalCreationProps } from '../common';

export function emailProposalCreationForCreator({
  creatorName,
  proposalLabel,
  proposalState = 'proposal',
  proposalTitle,
  spaceTitle,
}: ProposalCreationProps): Email {
  const beginning = creatorName
    ? `Dear ${creatorName}, great news,`
    : 'Great news,';
  const space = spaceTitle ? `the space "${spaceTitle}"` : 'a space';
  const proposal = proposalTitle ? `"${proposalTitle}"` : proposalState;

  switch (proposalLabel) {
    case 'Invite':
      return {
        subject: 'Your invite to join a space has been created',
        body: `${beginning} your invite to join ${space} has been created.`,
      };

    default:
      return {
        subject: `Your ${proposalState} has been created`,
        body: `${beginning} your ${proposal} has been created in ${space}.`,
      };
  }
}
