import { AgreementItem } from '../agreements/types';
export type MemberType = {
  avatar: string;
  name: string;
  surname: string;
};

export type SpaceType = {
  image?: string;
  title?: string;
  description?: string;
  members?: MemberType[];
  joinedStatus?: boolean;
  slug?: string;
  projects: number;
  agreements?: AgreementItem[];
  createdDate?: string;
};

export type SortParams = {
  sort?: string;
};
