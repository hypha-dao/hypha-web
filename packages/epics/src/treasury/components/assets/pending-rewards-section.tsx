'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import { type Person, usePendingRewards } from '@hypha-platform/core/client';
import { AssetCard } from './asset-card';
import { useUserAssetsSection } from '../../hooks';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import { Empty } from '../../../common';
import { useTranslations } from 'next-intl';

const HYPHA_TOKEN_ADDRESS = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
const MIN_REWARD_CLAIM_VALUE = 0.01;

const HYPHA_REWARDS_FALLBACK = {
  icon: '/placeholder/hypha-token-icon.svg',
  name: 'Hypha',
  symbol: 'HYPHA',
  value: 0,
  address: HYPHA_TOKEN_ADDRESS,
};

type PendingRewardsSectionProps = {
  person: Person;
  isMyProfile?: boolean;
};

export const PendingRewardsSection: FC<PendingRewardsSectionProps> = ({
  person,
  isMyProfile,
}) => {
  const tProfile = useTranslations('Profile');
  const { isAuthenticated } = useAuthentication();
  const {
    filteredAssets,
    updateUserAssets,
    isLoading: isLoadingAssets,
  } = useUserAssetsSection({
    personSlug: person?.slug,
  });

  const hyphaTokenAddress =
    filteredAssets?.find(
      (a) => a.symbol === 'HYPHA' || a.address === HYPHA_TOKEN_ADDRESS,
    )?.address ?? HYPHA_TOKEN_ADDRESS;

  const {
    pendingRewards,
    isLoading,
    claim,
    waitForClaimReceipt,
    isClaiming,
    updatePendingRewards,
  } = usePendingRewards({
    user: person?.address as `0x${string}`,
    hyphaTokenAddress: hyphaTokenAddress as `0x${string}`,
  });

  const [hasClaimed, setHasClaimed] = useState(false);

  const originalAsset = filteredAssets?.find(
    (a) => a.address?.toLowerCase() === hyphaTokenAddress.toLowerCase(),
  );

  const parsedRewardValue =
    pendingRewards !== undefined ? Number(pendingRewards) / 1e18 : 0;

  const hyphaTokenAsset =
    pendingRewards !== undefined
      ? originalAsset
        ? { ...originalAsset, value: parsedRewardValue }
        : {
            ...HYPHA_REWARDS_FALLBACK,
            address: hyphaTokenAddress,
            value: parsedRewardValue,
          }
      : undefined;
  useEffect(() => {
    if (parsedRewardValue >= MIN_REWARD_CLAIM_VALUE) {
      setHasClaimed(false);
    }
  }, [parsedRewardValue]);

  const disableClaimButton =
    hasClaimed ||
    !(parsedRewardValue >= MIN_REWARD_CLAIM_VALUE) ||
    isClaiming ||
    pendingRewards === undefined;

  const onHandleClaim = useCallback(async () => {
    try {
      const txHash = await claim();
      await waitForClaimReceipt(txHash as `0x${string}`);
      await updatePendingRewards(0n, { revalidate: true });
      await updateUserAssets();
      setHasClaimed(true);
    } catch (error) {
      console.error('Claim failed:', error);
    }
  }, [claim, waitForClaimReceipt, updatePendingRewards, updateUserAssets]);

  return (
    <div className="flex w-full flex-col items-stretch gap-3">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <header className="craft-page-header min-w-0 flex-1">
          <h2 className="craft-page-title text-4 font-medium">
            {tProfile('rewards')}
            <span className="ml-2 text-3 font-normal text-muted-foreground tabular-nums">
              | {formatCurrencyValue(parsedRewardValue)} HYPHA
            </span>
          </h2>
        </header>
        <Button
          title={
            !isMyProfile
              ? tProfile('claimOnlyOnPersonalPage')
              : disableClaimButton
              ? tProfile('rewardValueMustBeGreaterThanZero')
              : ''
          }
          disabled={!isMyProfile || disableClaimButton}
          onClick={onHandleClaim}
        >
          {isClaiming && <Loader2 className="animate-spin w-4 h-4" />}
          {tProfile('claim')}
        </Button>
      </div>
      <div className="w-full">
        {isLoading ? (
          <div className="mt-1 w-full max-w-sm">
            <AssetCard isLoading layout="solo" />
          </div>
        ) : !isAuthenticated ? (
          <Empty>
            <p>{tProfile('noRewardsFoundForUser')}</p>
          </Empty>
        ) : (
          <div className="mt-1 w-full max-w-sm">
            <AssetCard
              {...(hyphaTokenAsset ?? {
                ...HYPHA_REWARDS_FALLBACK,
                address: hyphaTokenAddress,
                value: 0,
              })}
              isLoading={isLoadingAssets}
              layout="solo"
            />
          </div>
        )}
      </div>
    </div>
  );
};
