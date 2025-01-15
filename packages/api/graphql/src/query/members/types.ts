import { AgreementItem } from '../agreements';

export type MemberItem = {
  name: string;
  surname: string;
  nickname: string;
  location: string;
  avatar: string;
  commitment: number;
  status: string;
  isLoading?: boolean;
  about?: string;
  slug: string;
  spaces?: SpaceType[];
  agreements: AgreementItem[];
};

export type SpaceType = {
  name?: string;
  logo?: string;
};
