import { FC } from 'react';
import { AssetCard } from './asset-card';
import Link from 'next/link';
import { AssetItem } from '@hypha-platform/graphql/rsc';

type AssetsListProps = {
  assets: AssetItem[];
  activeFilter: string;
  basePath: string;
  isLoading?: boolean;
};

export const AssetsList: FC<AssetsListProps> = ({
  assets,
  activeFilter,
  basePath,
  isLoading,
}) => {
  return (
    <div className="w-full">
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        {assets.map((asset, index) => (
          <Link
            key={`${asset.slug}_${index}`}
            href={`${basePath}/${asset.slug}`}
            scroll={false}
          >
            <AssetCard {...asset} isLoading={isLoading} />
          </Link>
        ))}
      </div>

      {isLoading && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <AssetCard isLoading />
          <AssetCard isLoading />
        </div>
      )}
    </div>
  );
};
