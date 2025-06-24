import { data } from './list.mock';
import { ProposalItem } from './types';

export const getProposalBySlug = async (
  slug: string,
): Promise<ProposalItem | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data.find((proposal) => proposal.slug === slug));
    }, 100);
  });
};
