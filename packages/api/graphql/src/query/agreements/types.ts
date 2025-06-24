import { PaginationMetadata } from '../types';

export type Creator = { avatar: string; name: string; surname: string };

type CommentProps = {
  comment: string;
  author: Creator;
  likes: number;
  id: string;
};

export type AgreementItem = {
  id: string;
  slug: string;
  title: string;
  creator: Creator;
  commitment: number;
  status: string;
  views: number;
  comments: CommentProps[];
  content: string;
};

export type PaginatedAgreementsResponse = {
  agreements: AgreementItem[];
  pagination: PaginationMetadata;
};
