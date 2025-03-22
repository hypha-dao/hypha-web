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
  filter?: FilterParams<Person>;
};

export type UseMembers = (props: UseMembersProps) => UseMembersReturn;

export type UseMemberSpacesReturn = {
  members: Person[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};
export type UseMemberSpaces = () => UseMemberSpacesReturn;
