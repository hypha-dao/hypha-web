'use client';

import { FC, useState } from 'react';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';
import { useUserAssetsSection } from '../../hooks/use-user-assets-section';
import { Button } from '../../../../../ui/src/button';
import Link from 'next/link';
import { AssetsList } from './assets-list';
import { Input } from '@hypha-platform/ui';

type UserAssetsSectionProps = {
  personSlug: string;
  basePath?: string;
  isMyProfile?: boolean;
};

export const UserAssetsSection: FC<UserAssetsSectionProps> = ({
  personSlug,
  basePath,
  isMyProfile,
}) => {
  const {
    visibleAssets,
    activeFilter,
    isLoading,
    loadMore,
    hasMore,
    totalBalance,
  } = useUserAssetsSection({
    personSlug,
  });

  const [hideSmallBalances, setHideSmallBalances] = useState(false);

  const filteredAssets = hideSmallBalances
    ? visibleAssets.filter((asset) => asset.value >= 1)
    : visibleAssets;

  const renderFilterAndButtons = () => (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-2">
      <SectionFilter count={totalBalance || 0} label="Balance">
        <label className="flex items-center gap-1">
          <Input
            type="checkbox"
            checked={hideSmallBalances}
            onChange={(e) => setHideSmallBalances(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Hide small balances</span>
        </label>
      </SectionFilter>
      <div className="flex gap-2 justify-end">
        <Link
          className={!isMyProfile ? 'cursor-not-allowed' : ''}
          href={isMyProfile ? `${basePath}/actions/purchase-hypha-tokens` : {}}
          scroll={false}
        >
          <Button disabled={!isMyProfile}>Buy HYPHA</Button>
        </Link>
        <Link href={isMyProfile ? `${basePath}/actions` : {}} scroll={false}>
          <Button disabled={!isMyProfile}>Actions</Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <div className="w-full">{renderFilterAndButtons()}</div>
      {filteredAssets.length === 0 && !isLoading ? (
        <Empty>
          <p>No assets found for this user</p>
        </Empty>
      ) : (
        <AssetsList
          assets={filteredAssets}
          activeFilter={activeFilter}
          isLoading={isLoading}
        />
      )}
      <SectionLoadMore
        onClick={loadMore}
        disabled={!hasMore}
        isLoading={isLoading}
      >
        {hasMore ? 'Load more assets' : 'No more assets'}
      </SectionLoadMore>
    </div>
  );
};
