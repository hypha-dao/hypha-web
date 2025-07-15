'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';
import { useUserAssetsSection } from '../../hooks/use-user-assets-section';

import { AssetsList } from './assets-list';

type UserAssetsSectionProps = {
  personSlug: string;
};

export const UserAssetsSection: FC<UserAssetsSectionProps> = ({
  personSlug,
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

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter count={totalBalance || 0} label="Balance" />
      {visibleAssets.length === 0 && !isLoading ? (
        <Empty>
          <p>No assets found for this user</p>
        </Empty>
      ) : (
        <AssetsList
          assets={visibleAssets}
          activeFilter={activeFilter}
          isLoading={isLoading}
        />
      )}
      {hasMore && (
        <SectionLoadMore
          onClick={loadMore}
          disabled={!hasMore}
          isLoading={isLoading}
        >
          <Text>Load more assets</Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
