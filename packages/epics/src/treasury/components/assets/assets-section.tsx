'use client';
import { FC } from 'react';
import { AssetsList } from './assets-list';
import { Text } from '@radix-ui/themes';
import { useAssetsSection } from '../../hooks/use-assets-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { CopyIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { Empty } from "@hypha-platform/epics";

type AssetSectionProps = {
  basePath: string;
};

export const AssetsSection: FC<AssetSectionProps> = ({ basePath }) => {
  const {
    visibleAssets,
    activeFilter,
    isLoading,
    loadMore,
    hasMore,
    totalBalance,
  } = useAssetsSection();

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter count={totalBalance || 0} label="Balance">
        <Button asChild className="ml-2">
          <Link href={`${basePath}/deposit`} scroll={false}>
            <CopyIcon />
            Deposit funds
          </Link>
        </Button>
      </SectionFilter>
      {visibleAssets.length === 0 && !isLoading ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        <AssetsList
          basePath={`${basePath}/token`}
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
