'use client';

import { FC } from 'react';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';
import { useUserAssetsSection } from '../../hooks/use-user-assets-section';
import { Button } from '../../../../../ui/src/button';
import Link from 'next/link';
import { AssetsList } from './assets-list';
import { Input } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type UserAssetsSectionProps = {
  personSlug: string;
  basePath?: string;
  isMyProfile?: boolean;
  showActionButtons?: boolean;
};

export const UserAssetsSection: FC<UserAssetsSectionProps> = ({
  personSlug,
  basePath,
  isMyProfile,
  showActionButtons = true,
}) => {
  const tTreasury = useTranslations('TreasuryTab');
  const tProfile = useTranslations('Profile');
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
  } = useUserAssetsSection({ personSlug });

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <div
        className={`flex w-full flex-col gap-2 ${
          showActionButtons
            ? 'md:flex-row md:items-center md:justify-between'
            : ''
        }`}
      >
        <SectionFilter
          count={totalBalance || 0}
          label={tTreasury('balance')}
          hasSearch
          inlineLabel={showActionButtons ? undefined : false}
          searchPlaceholder={tTreasury('searchTokens')}
          onChangeSearch={setSearchTerm}
        >
          <label className="flex items-center gap-1">
            <Input
              type="checkbox"
              checked={hideSmallBalances}
              onChange={(e) => setHideSmallBalances(e.target.checked)}
              className="h-4 w-4 accent-accent-9"
            />
            <span>{tTreasury('hideSmallBalances')}</span>
          </label>
        </SectionFilter>
        {showActionButtons ? (
          <div className="flex justify-end gap-2">
            {isMyProfile ? (
              <Button asChild>
                <Link
                  href={`${basePath}/actions/buy-space-tokens`}
                  scroll={false}
                >
                  {tProfile('buySpaceTokens')}
                </Link>
              </Button>
            ) : (
              <Button disabled>{tProfile('buySpaceTokens')}</Button>
            )}
            {isMyProfile ? (
              <Button asChild>
                <Link
                  href={`${basePath}/actions/purchase-hypha-tokens`}
                  scroll={false}
                >
                  {tProfile('buyHypha')}
                </Link>
              </Button>
            ) : (
              <Button disabled>{tProfile('buyHypha')}</Button>
            )}
            {isMyProfile ? (
              <Button asChild>
                <Link href={`${basePath}/actions`} scroll={false}>
                  {tProfile('actions')}
                </Link>
              </Button>
            ) : (
              <Button disabled>{tProfile('actions')}</Button>
            )}
          </div>
        ) : null}
      </div>
      {filteredAssets.length === 0 && !isLoading ? (
        <Empty>
          <p>{tProfile('noAssetsFoundForUser')}</p>
        </Empty>
      ) : (
        <AssetsList
          assets={filteredAssets}
          activeFilter={activeFilter}
          isLoading={isLoading}
        />
      )}
      {hasMore && filteredAssets.length >= 9 && !searchTerm.trim() && (
        <SectionLoadMore
          onClick={loadMore}
          disabled={!hasMore}
          isLoading={isLoading}
        >
          {tTreasury('loadMoreAssets')}
        </SectionLoadMore>
      )}
    </div>
  );
};
