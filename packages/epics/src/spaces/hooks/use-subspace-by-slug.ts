'use client';

import useSWR from 'swr';
import { data } from './use-subspace-by-slug.mock';

type Creator = { avatar: string; name: string; surname: string };

type CommentProps = {
  comment: string;
  author: Creator;
  likes: number;
  id: string;
};

type AgreementItem = {
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

type MemberType = {
  avatar: string;
  name: string;
  surname: string;
};

type SpaceType = {
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

const getSubspaceBySlug = async (
  slug: string,
): Promise<SpaceType | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data.find((space) => space.slug === slug));
    }, 100);
  });
};

export const useSubspaceBySlug = (slug: string) => {
  const { data, isLoading } = useSWR(['subspace-by-slug', slug], ([_, slug]) =>
    getSubspaceBySlug(slug),
  );
  return { data, isLoading };
};
