import {
  FilterParams,
  PaginationMetadata,
  // TODO: #594 declare UI interface separately
  Person,
  Space,
} from '@hypha-platform/core/client';

export type UseMembersReturn = {
  persons: {
    data: Person[];
    pagination?: PaginationMetadata;
  };
  spaces: {
    data: Space[];
    pagination?: PaginationMetadata;
  };
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
