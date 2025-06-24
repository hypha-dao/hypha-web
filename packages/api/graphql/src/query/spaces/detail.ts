import { data } from './list.mock';
import { SpaceType } from './types';

export const getSubspaceBySlug = async (
  slug: string,
): Promise<SpaceType | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data.find((space) => space.slug === slug));
    }, 100);
  });
};
