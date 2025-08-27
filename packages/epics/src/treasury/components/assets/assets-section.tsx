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
import { useAuthentication } from '@hypha-platform/authentication';

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
  const { isAuthenticated } = useAuthentication();

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
          className={!isAuthenticated ? 'cursor-not-allowed' : ''}
          href={
            isAuthenticated
              ? `${governancePath}/create/issue-new-token?back=${basePath}`
              : {}
          }
          scroll={false}
          title={!isAuthenticated ? 'Please sign in to use this feature.' : ''}
        >
          <Button disabled={!isAuthenticated}>
            <RadiobuttonIcon />
            New Token
          </Button>
        </Link>
        <Link
          className={!isAuthenticated ? 'cursor-not-allowed' : ''}
          title={!isAuthenticated ? 'Please sign in to use this feature.' : ''}
          href={isAuthenticated ? `${basePath}/deposit` : {}}
          scroll={false}
        >
          <Button disabled={!isAuthenticated}>
            <CopyIcon />
            Deposit funds
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <div className="w-full">{renderFilterAndButtons()}</div>
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
