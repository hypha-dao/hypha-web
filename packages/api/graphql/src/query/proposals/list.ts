import { PaginatedProposalResponse } from './types';
import { PaginationParams } from '../types';
import { data } from './list.mock';
import { ProposalItem } from './types';

export const fetchProposals = async ({
  page = 1,
  pageSize = 4,
  filter,
}: PaginationParams<ProposalItem>): Promise<PaginatedProposalResponse> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filteredData = filter
        ? data.filter((proposal) => proposal.status === filter.status)
        : data;

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const proposals = filteredData.slice(start, end);
      const total = filteredData.length;
      const totalPages = Math.ceil(total / pageSize);

      resolve({
        proposals,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    }, 1000);
  });
};
