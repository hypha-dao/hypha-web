'use client';

import { FC } from 'react';
import { AssetCard } from './asset-card';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import type { AssetItem } from '../../hooks/use-user-assets';
import { walletAssetActionHref } from '../../../wallet/components/wallet-asset-action';

export type { AssetItem };

type AssetsListProps = {
  assets: AssetItem[];
  activeFilter: string;
  basePath?: string;
  isLoading?: boolean;
};

export const AssetsList: FC<AssetsListProps> = ({
  assets,
  basePath,
  isLoading,
}) => {
  const { lang } = useParams<{ lang: Locale }>();
  return (
    <div className="w-full">
      <div className="mt-2 grid w-full grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {assets.map((asset, index) => (
          <AssetCard
            key={`${asset.slug}_${index}`}
            {...asset}
            isLoading={isLoading}
            lang={lang}
            href={basePath ? walletAssetActionHref(basePath, asset) : undefined}
          />
        ))}
      </div>

      {isLoading && (
        <div className="mt-2 grid w-full grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AssetCard isLoading />
          <AssetCard isLoading />
          <AssetCard isLoading />
        </div>
      )}
    </div>
  );
};
