'use client';
import { FC } from 'react';
import { AssetsList } from './assets-list';
import { Text } from '@radix-ui/themes';
import { useAssetsSection } from '../../hooks/use-assets-section';
import { SectionLoadMore } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { CopyIcon, RadiobuttonIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { Empty } from '../../../common';
import { Input } from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import { useSpaceMember } from '../../../spaces';
import { useFundWallet } from '../../hooks';
import {
  useSpaceDetailsWeb3Rpc,
  useIsDelegate,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { SearchIcon } from 'lucide-react';

type AssetSectionProps = {
  basePath: string;
  web3SpaceId?: number;
};

export const AssetsSection: FC<AssetSectionProps> = ({
  basePath,
  web3SpaceId,
}) => {
  const tCommon = useTranslations('Common');
  const tTreasury = useTranslations('TreasuryTab');
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId as number,
  });
  const { fundWallet } = useFundWallet({
    address: spaceDetails?.executor as `0x${string}`,
  });
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });

  const {
    filteredAssets,
    activeFilter,
    isLoading,
    loadMore,
    hasMore,
    totalBalance,
    searchTerm,
    setSearchTerm,
    hideSmallBalances,
    setHideSmallBalances,
    visibleCount,
  } = useAssetsSection();

  const { isAuthenticated } = useAuthentication();

  const isDisabled = !(isAuthenticated && (isMember || isDelegate));
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : '';

  const renderFilterAndButtons = () => (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
      <div className="shrink-0 whitespace-nowrap text-4 text-foreground">
        {tTreasury('balance')} | {totalBalance}
      </div>
      <Input
        className="w-full lg:min-w-0 lg:flex-1"
        placeholder={tTreasury('searchTokens')}
        leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto lg:shrink-0">
        <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-foreground">
          <Input
            type="checkbox"
            checked={hideSmallBalances}
            onChange={(e) => setHideSmallBalances(e.target.checked)}
            className="h-4 w-4 accent-accent-9"
          />
          <span>{tTreasury('hideSmall')}</span>
        </label>
        {isDisabled ? (
          <Button
            colorVariant="accent"
            variant="outline"
            disabled
            title={tooltipMessage || ''}
          >
            <RadiobuttonIcon />
            {tTreasury('newToken')}
          </Button>
        ) : (
          <Button
            asChild
            colorVariant="accent"
            variant="outline"
            title={tooltipMessage || ''}
          >
            <Link
              href={`${basePath}/create/issue-new-token?hideBack=true`}
              scroll={false}
            >
              <RadiobuttonIcon />
              {tTreasury('newToken')}
            </Link>
          </Button>
        )}

        <Button
          className={cn(isDisabled && 'cursor-not-allowed')}
          title={tooltipMessage || ''}
          onClick={fundWallet}
          disabled={isDisabled}
        >
          <CopyIcon />
          {tTreasury('depositFunds')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <div className="w-full">{renderFilterAndButtons()}</div>
      {filteredAssets.length === 0 && !isLoading ? (
        <Empty>
          <p>
            {searchTerm.trim()
              ? tTreasury('emptyAssetsSearch')
              : tTreasury('emptyAssetsTreasury')}
          </p>
        </Empty>
      ) : (
        <AssetsList
          basePath={`${basePath}/token`}
          assets={filteredAssets}
          activeFilter={activeFilter}
          isLoading={isLoading}
        />
      )}
      {hasMore &&
        !searchTerm.trim() &&
        filteredAssets.length >= visibleCount && (
          <SectionLoadMore
            onClick={loadMore}
            disabled={!hasMore}
            isLoading={isLoading}
          >
            <Text>{tTreasury('loadMoreAssets')}</Text>
          </SectionLoadMore>
        )}
    </div>
  );
};
