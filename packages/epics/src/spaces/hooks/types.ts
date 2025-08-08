import {
  FilterParams,
  PaginationMetadata,
  // TODO: #594 declare UI interface separately
  Person,
} from '@hypha-platform/core/client';

export type UseMembersReturn = {
  members: Person[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};

export type UseMembersProps = {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<Person>;
  spaceSlug?: string;
  searchTerm?: string;
  refreshInterval?: number;
  paginationDisabled?: boolean;
};

export type UseMembers = (props: UseMembersProps) => UseMembersReturn;

export type UseMemberSpacesReturn = {
  members: Person[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};
export type UseMemberSpaces = () => UseMemberSpacesReturn;
