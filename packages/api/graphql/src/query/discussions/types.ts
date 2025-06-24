import { PaginationMetadata } from '../types';

type Creator = { avatar: string; name: string; surname: string };

export type DiscussionItem = {
  comments?: number;
  content?: string;
  creator?: Creator;
  description?: string;
  image?: string;
  isLoading?: boolean | undefined;
  slug?: string;
  status: string;
  title?: string;
  views?: number;
};

export type PaginatedDiscussionsResponse = {
  discussions: DiscussionItem[];
  pagination: PaginationMetadata;
};
