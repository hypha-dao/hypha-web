'use client';

import { FC } from 'react';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';
import { useUserAssetsSection } from '../../hooks/use-user-assets-section';
import { Button } from '../../../../../ui/src/button';
import Link from 'next/link';
import { AssetsList } from './assets-list';

type UserAssetsSectionProps = {
  personSlug: string;
  basePath?: string;
};

export const UserAssetsSection: FC<UserAssetsSectionProps> = ({
  personSlug,
  basePath,
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
      <SectionFilter count={totalBalance || 0} label="Balance">
        <Button asChild className="ml-2">
          <Link href={`${basePath}/actions`} scroll={false}>
            Actions
          </Link>
        </Button>
      </SectionFilter>
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
