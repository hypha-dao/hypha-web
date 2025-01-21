import { data } from './list.mock';
import { InnerSpaceType } from './types';

export const getSubspaceBySlug = async (
  slug: string
): Promise<InnerSpaceType | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('data', data);
      resolve(data.find((space) => space.slug === slug));
    }, 100);
  });
};
