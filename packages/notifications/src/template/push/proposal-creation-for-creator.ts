import type { Push } from './types';
import type { ProposalCreationProps } from '../common';

/** Dashboard: "[PUSH] Proposal - Created - for Creator". */
export function pushProposalCreationForCreator({
  proposalLabel,
  proposalTitle,
  spaceTitle,
}: ProposalCreationProps): Push {
  const space = spaceTitle?.trim() || 'your space';

  if (proposalLabel === 'Invite') {
    return {
      headings: { en: 'Your invite was created' },
      contents: { en: `Your invite to join ${space} was created.` },
    };
  }

  const title = proposalTitle?.trim();
  return {
    headings: { en: 'Your proposal was created' },
    contents: {
      en: `Your proposal${title ? ` “${title}”` : ''} was created in ${space}.`,
    },
  };
}
