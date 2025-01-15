import { Creator } from '../agreements';

export type ProposalItem = {
  commitment: number;
  creator: Creator;
  content: string;
  slug: string;
  status: string;
  title: string;
};

type PaginationMetadata = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedProposalResponse = {
  proposals: ProposalItem[];
  pagination: PaginationMetadata;
};
