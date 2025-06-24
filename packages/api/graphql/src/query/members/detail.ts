import { data } from './list.mock';
import { MemberItem } from './types';

export const getMemberBySlug = async (
  slug: string,
): Promise<MemberItem | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data.find((member) => member.slug === slug));
    }, 100);
  });
};
