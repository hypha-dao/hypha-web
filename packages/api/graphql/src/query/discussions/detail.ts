import { data } from './list.mock';
import { DiscussionItem } from './types';

export const getDiscussionBySlug = async (
  slug: string,
): Promise<DiscussionItem | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data.find((discussion) => discussion.slug === slug));
    }, 100);
  });
};
