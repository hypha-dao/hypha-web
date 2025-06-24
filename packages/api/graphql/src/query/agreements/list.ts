import { PaginationParams } from '../types';
import { PaginatedAgreementsResponse } from './types';
import { data } from './list.mock';
import { AgreementItem } from './types';

export const fetchAgreements = async ({
  page = 1,
  pageSize = 4,
  filter,
}: PaginationParams<AgreementItem>): Promise<PaginatedAgreementsResponse> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filteredData = filter
        ? data.filter((agreement) => agreement.status === filter.status)
        : data;

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const agreements = filteredData.slice(start, end);
      const total = filteredData.length;
      const totalPages = Math.ceil(total / pageSize);

      resolve({
        agreements,
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
