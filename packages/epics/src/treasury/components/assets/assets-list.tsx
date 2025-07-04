import { FC } from 'react';
import { AssetCard } from './asset-card';
import Link from 'next/link';

type OneChartPoint = {
  month: string;
  value: number;
  date: string;
};

type TransactionCardProps = {
  id: string;
  title: string;
  description: string;
  amount: number;
  withUsdSymbol?: boolean;
  badges: {
    label: string;
    variant: 'solid' | 'soft' | 'outline' | 'surface';
  }[];
  author: {
    name: string;
    surname: string;
  };
  isLoading?: boolean;
  viewCount?: number;
  commentCount?: number;
};

type AssetItem = {
  icon: string;
  name: string;
  symbol: string;
  value: number;
  usdEqual: number;
  status: string;
  chartData: OneChartPoint[];
  transactions: TransactionCardProps[];
  closeUrl: string;
  slug: string;
};

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
          // <Link
          //   key={`${asset.slug}_${index}`}
          //   href={`${basePath}/${asset.slug}`}
          //   scroll={false}
          // > // TODO: planned to be returned after adding correct data in asset details page
          <AssetCard
            key={`${asset.slug}_${index}`}
            {...asset}
            isLoading={isLoading}
          />
          // </Link>
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
