'use client';
import { FC } from 'react';
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
import { useSpaceMember } from '../../../spaces';
import { useFundWallet } from '../../hooks';
import {
  useSpaceDetailsWeb3Rpc,
  useIsDelegate,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

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

  const isDisabled = !(isAuthenticated || isMember || isDelegate);
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : '';

  const renderFilterAndButtons = () => (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-2">
      <SectionFilter
        count={totalBalance || 0}
        label={tTreasury('balance')}
        hasSearch
        searchPlaceholder={tTreasury('searchTokens')}
        onChangeSearch={setSearchTerm}
      >
        <label className="flex items-center gap-1">
          <Input
            type="checkbox"
            checked={hideSmallBalances}
            onChange={(e) => setHideSmallBalances(e.target.checked)}
            className="h-4 w-4"
          />
          <span>{tTreasury('hideSmallBalances')}</span>
        </label>
      </SectionFilter>
      <div className="flex gap-2 justify-end">
        {isDisabled ? (
          <Button
            colorVariant="accent"
            variant="outline"
            disabled
            title={tooltipMessage || ''}
            className="cursor-not-allowed"
          >
            <RadiobuttonIcon />
            {tTreasury('newToken')}
          </Button>
        ) : (
          <Link
            href={`${basePath}/create/issue-new-token?hideBack=true`}
            scroll={false}
            title={tooltipMessage || ''}
          >
            <Button colorVariant="accent" variant="outline">
              <RadiobuttonIcon />
              {tTreasury('newToken')}
            </Button>
          </Link>
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
          <p>{tTreasury('listIsEmpty')}</p>
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
