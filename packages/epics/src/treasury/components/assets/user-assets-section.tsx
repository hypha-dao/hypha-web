'use client';

import { FC } from 'react';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';
import { useUserAssetsSection } from '../../hooks/use-user-assets-section';
import { Button } from '../../../../../ui/src/button';
import Link from 'next/link';
import { AssetsList } from './assets-list';
import { Input } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

type UserAssetsSectionProps = {
  personSlug: string;
  basePath?: string;
  isMyProfile?: boolean;
  /** Wallet page: stacked toolbar and single-column cards until wider viewports. */
  variant?: 'profile' | 'wallet';
};

export const UserAssetsSection: FC<UserAssetsSectionProps> = ({
  personSlug,
  basePath,
  isMyProfile,
  variant = 'profile',
}) => {
  const isWalletVariant = variant === 'wallet';
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

  const renderFilterAndButtons = () => (
    <div className="flex w-full flex-col gap-3 min-[720px]:flex-row min-[720px]:items-start min-[720px]:justify-between min-[720px]:gap-4">
      <SectionFilter
        count={totalBalance || 0}
        label={tTreasury('balance')}
        hasSearch
        searchPlaceholder={tTreasury('searchTokens')}
        onChangeSearch={setSearchTerm}
        inlineLabel={!isWalletVariant}
      >
        <label className="flex items-center gap-2 text-sm">
          <Input
            type="checkbox"
            checked={hideSmallBalances}
            onChange={(e) => setHideSmallBalances(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-accent-9"
          />
          <span className="text-wrap">{tTreasury('hideSmallBalances')}</span>
        </label>
      </SectionFilter>
      <div className="flex w-full flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap min-[720px]:w-auto min-[720px]:justify-end">
        <Link
          className={cn(
            'w-full min-[480px]:w-auto',
            !isMyProfile && 'cursor-not-allowed',
          )}
          href={isMyProfile ? `${basePath}/actions/buy-space-tokens` : {}}
          scroll={false}
        >
          <Button className="w-full min-[480px]:w-auto" disabled={!isMyProfile}>
            {tProfile('buySpaceTokens')}
          </Button>
        </Link>
        <Link
          className={cn(
            'w-full min-[480px]:w-auto',
            !isMyProfile && 'cursor-not-allowed',
          )}
          href={isMyProfile ? `${basePath}/actions/purchase-hypha-tokens` : {}}
          scroll={false}
        >
          <Button className="w-full min-[480px]:w-auto" disabled={!isMyProfile}>
            {tProfile('buyHypha')}
          </Button>
        </Link>
        {!isWalletVariant ? (
          <Link
            className={cn(
              'w-full min-[480px]:w-auto',
              !isMyProfile && 'cursor-not-allowed',
            )}
            href={isMyProfile ? `${basePath}/actions` : {}}
            scroll={false}
          >
            <Button
              className="w-full min-[480px]:w-auto"
              disabled={!isMyProfile}
            >
              {tProfile('actions')}
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <div className="w-full">{renderFilterAndButtons()}</div>
      {filteredAssets.length === 0 && !isLoading ? (
        <Empty>
          <p>{tProfile('noAssetsFoundForUser')}</p>
        </Empty>
      ) : (
        <AssetsList
          assets={filteredAssets}
          activeFilter={activeFilter}
          isLoading={isLoading}
          gridClassName={
            isWalletVariant ? 'grid-cols-1 min-[720px]:grid-cols-2' : undefined
          }
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
