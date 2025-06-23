import { FC } from 'react';
import { AssetCard } from './asset-card';
import { useAssets } from '../../hooks/use-assets';
import Link from 'next/link';

type AssetsListProps = {
  page: number;
  activeFilter: string;
  basePath: string;
};

export const AssetsList: FC<AssetsListProps> = ({
  page,
  activeFilter,
  basePath,
}) => {
  const { assets, isLoading } = useAssets({
    page,
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });
  return (
    <div className="w-full">
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        {assets.map((asset) => (
          <Link
            key={asset.slug}
            href={`${basePath}/${asset.slug}`}
            scroll={false}
          >
            <AssetCard {...asset} isLoading={isLoading} />
          </Link>
        ))}
      </div>
      <div>
        {isLoading ? (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <AssetCard isLoading={isLoading} />
            <AssetCard isLoading={isLoading} />
          </div>
        ) : null}
      </div>
    </div>
  );
};
