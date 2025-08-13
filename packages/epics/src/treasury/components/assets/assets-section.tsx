'use client';
import { FC, useState } from 'react';
import { AssetsList } from './assets-list';
import { Text } from '@radix-ui/themes';
import { useAssetsSection } from '../../hooks/use-assets-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { CopyIcon, RadiobuttonIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { Empty } from '../../../common';
import { Input } from '@hypha-platform/ui';

type AssetSectionProps = {
  basePath: string;
  governancePath: string;
};

export const AssetsSection: FC<AssetSectionProps> = ({
  basePath,
  governancePath,
}) => {
  const {
    visibleAssets,
    activeFilter,
    isLoading,
    loadMore,
    hasMore,
    totalBalance,
  } = useAssetsSection();

  const [hideSmallBalances, setHideSmallBalances] = useState(false);

  const filteredAssets = hideSmallBalances
    ? visibleAssets.filter((asset) => asset.value >= 1)
    : visibleAssets;

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
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
        <Button asChild className="ml-2">
          <Link
            href={`${governancePath}/create/issue-new-token?back=${basePath}`}
            scroll={false}
          >
            <RadiobuttonIcon />
            New Token
          </Link>
        </Button>
        <Button asChild className="ml-2">
          <Link href={`${basePath}/deposit`} scroll={false}>
            <CopyIcon />
            Deposit funds
          </Link>
        </Button>
      </SectionFilter>
      {filteredAssets.length === 0 && !isLoading ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        <AssetsList
          basePath={`${basePath}/token`}
          assets={filteredAssets}
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
