'use client';

import { FC } from 'react';
import { AssetCard } from './asset-card';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import { cn } from '@hypha-platform/ui-utils';
import type { AssetItem } from '../../hooks/use-user-assets';

export type { AssetItem };

type AssetsListProps = {
  assets: AssetItem[];
  activeFilter: string;
  basePath?: string;
  isLoading?: boolean;
  gridClassName?: string;
};

const defaultGridClassName =
  'grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

export const AssetsList: FC<AssetsListProps> = ({
  assets,
  activeFilter,
  isLoading,
  gridClassName,
}) => {
  const { lang } = useParams<{ lang: Locale }>();
  const gridClasses = cn(
    'mt-2 grid w-full',
    gridClassName ?? defaultGridClassName,
  );

  return (
    <div className="w-full min-w-0">
      <div className={gridClasses}>
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
            lang={lang}
          />
          // </Link>
        ))}
      </div>

      {isLoading && (
        <div className={gridClasses}>
          <AssetCard isLoading />
          <AssetCard isLoading />
          <AssetCard isLoading />
        </div>
      )}
    </div>
  );
};
