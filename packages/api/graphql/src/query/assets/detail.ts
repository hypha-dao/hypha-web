import { data } from './list.mock';
import { AssetItem } from './types';

export const getAssetBySlug = async (
  slug: string
): Promise<AssetItem | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data.find((asset) => asset.slug === slug));
    }, 100);
  });
};
